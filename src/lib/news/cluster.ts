import { jaccard, properNouns, tokens } from "./text";

// Deduplicação: agrupa itens de fontes diferentes que tratam do mesmo fato.
// Heurística conservadora (prefere NÃO juntar a juntar errado), documentada em docs/NEWSROOM.md.

export type ClusterItem = { id: string; title: string; summary: string; publishedAt: Date };
export type ClusterStory = { id: string; titleKey: string; lastSeenAt: Date };

export const CLUSTER_WINDOW_HOURS = 48;
const JACCARD_STRONG = 0.34;
const JACCARD_WITH_ENTITIES = 0.18;
const MIN_SHARED_ENTITIES = 2;

export function storyKey(title: string, summary: string): string {
  // Título + começo do resumo: dá contexto suficiente sem diluir com o texto todo.
  const head = summary.split(/\s+/).slice(0, 25).join(" ");
  return [...new Set([...tokens(title), ...tokens(head)])].join(" ");
}

export function similarity(aKey: string, bKey: string, aTitle: string, bTitle: string): number {
  const j = jaccard(aKey.split(" "), bKey.split(" "));
  if (j >= JACCARD_STRONG) return j;
  const ea = new Set(properNouns(aTitle));
  const shared = properNouns(bTitle).filter((e) => ea.has(e)).length;
  if (shared >= MIN_SHARED_ENTITIES && j >= JACCARD_WITH_ENTITIES) return j + 0.1 * shared;
  return 0;
}

/**
 * Retorna, para cada item, o id da pauta escolhida (existente) ou null (criar nova).
 * Itens do mesmo lote também podem se juntar entre si: o chamador cria a pauta do
 * primeiro e reaproveita para os seguintes, por isso devolvemos grupos.
 */
export function clusterItems(
  items: ClusterItem[],
  stories: (ClusterStory & { seedTitle: string })[],
): { storyId: string | null; itemIds: string[]; key: string; seedTitle: string }[] {
  const groups: { storyId: string | null; itemIds: string[]; key: string; seedTitle: string; last: Date }[] = stories.map(
    (s) => ({ storyId: s.id, itemIds: [], key: s.titleKey, seedTitle: s.seedTitle, last: s.lastSeenAt }),
  );
  const sorted = [...items].sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
  for (const it of sorted) {
    const key = storyKey(it.title, it.summary);
    let best: (typeof groups)[number] | null = null;
    let bestScore = 0;
    for (const g of groups) {
      const hours = Math.abs(it.publishedAt.getTime() - g.last.getTime()) / 3600_000;
      if (hours > CLUSTER_WINDOW_HOURS) continue;
      const score = similarity(key, g.key, it.title, g.seedTitle);
      if (score > bestScore) {
        best = g;
        bestScore = score;
      }
    }
    if (best) {
      best.itemIds.push(it.id);
      if (it.publishedAt > best.last) best.last = it.publishedAt;
    } else {
      groups.push({ storyId: null, itemIds: [it.id], key, seedTitle: it.title, last: it.publishedAt });
    }
  }
  return groups.filter((g) => g.itemIds.length > 0).map(({ storyId, itemIds, key, seedTitle }) => ({ storyId, itemIds, key, seedTitle }));
}
