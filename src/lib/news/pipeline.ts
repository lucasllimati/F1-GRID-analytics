import type { PrismaClient } from "@prisma/client";
import { robotsAllows, safeFetchText } from "../net/safe-fetch";
import type { AgentResult, EditorialAI } from "./ai";
import { clusterItems, CLUSTER_WINDOW_HOURS } from "./cluster";
import { extractArticleText } from "./extract";
import { decidePublication, exclusionReason, sensitivityReasons, storyEligible, type FactCheckSummary } from "./policy";
import type { PromptSource } from "./prompts";
import { parseFeed } from "./rss";
import { allowedHosts, NEWS_SOURCES, sourceById, type SourceDef } from "./sources";
import type { PublishMode } from "./states";
import { copyOverlap, readingMinutes, slugify, wordCount } from "./text";

export type CycleOptions = {
  db: PrismaClient;
  trigger: "cron" | "admin" | "cli";
  ingestOnly?: boolean;
  mode: PublishMode;
  maxPerRun: number;
  maxPerDay: number;
  fetchFullText: boolean;
  /** Provedor de IA já configurado (null = redação desativada). Ver ai-factory.ts. */
  ai: EditorialAI | null;
  aiUnavailableReason?: string;
  now?: () => Date;
  log?: (msg: string) => void;
};

export type CycleStats = {
  sources: Record<string, { ok: boolean; items: number; created: number; excluded: number; error?: string }>;
  newItems: number;
  storiesCreated: number;
  storiesUpdated: number;
  drafted: number;
  published: number;
  sentToReview: number;
  skipped: number;
  failed: number;
  aiCostUsd: number;
  note?: string;
};

const ITEM_MAX_AGE_DAYS = 7;
const SETTLE_MINUTES = 30; // espera outras fontes repercutirem antes de redigir
export const LOCK_MINUTES = 20;

export async function runNewsCycle(opts: CycleOptions): Promise<{ runId: string; stats: CycleStats }> {
  const { db } = opts;
  const now = opts.now ?? (() => new Date());
  const log = opts.log ?? (() => {});

  // Ciclos que ficaram "running" além da janela da trava foram interrompidos (processo reiniciado).
  await db.ingestionRun.updateMany({
    where: { kind: "news_cycle", status: "running", startedAt: { lte: new Date(now().getTime() - LOCK_MINUTES * 60_000) } },
    data: { status: "error", error: "Interrompido (processo encerrado antes do fim).", finishedAt: new Date() },
  });

  // Trava simples contra execuções sobrepostas (cron + admin, por exemplo).
  const running = await db.ingestionRun.findFirst({
    where: { kind: "news_cycle", status: "running", startedAt: { gt: new Date(now().getTime() - LOCK_MINUTES * 60_000) } },
  });
  if (running) throw new Error("Já existe um ciclo de notícias em execução.");

  const run = await db.ingestionRun.create({ data: { kind: "news_cycle", trigger: opts.trigger, status: "running" } });
  const stats: CycleStats = {
    sources: {},
    newItems: 0,
    storiesCreated: 0,
    storiesUpdated: 0,
    drafted: 0,
    published: 0,
    sentToReview: 0,
    skipped: 0,
    failed: 0,
    aiCostUsd: 0,
  };

  try {
    await ensureSources(db);
    await ingestFeeds(db, stats, now, log);
    await clusterNewItems(db, stats, now);

    if (opts.ingestOnly) {
      stats.note = "Somente monitoramento (ingestOnly).";
    } else if (opts.mode === "manual") {
      stats.note = "Modo manual: pautas agrupadas; nenhuma redação automática.";
    } else if (!opts.ai) {
      stats.note = `${opts.aiUnavailableReason ?? "IA não configurada"}: pautas agrupadas; redação automática desativada.`;
    } else {
      await writeStories(db, opts.ai, opts, stats, now, log);
    }

    const anySourceFailed = Object.values(stats.sources).some((s) => !s.ok);
    await db.ingestionRun.update({
      where: { id: run.id },
      data: { status: anySourceFailed || stats.failed > 0 ? "partial" : "ok", stats: JSON.stringify(stats), finishedAt: new Date() },
    });
    return { runId: run.id, stats };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.ingestionRun.update({
      where: { id: run.id },
      data: { status: "error", error: message.slice(0, 2000), stats: JSON.stringify(stats), finishedAt: new Date() },
    });
    throw err;
  }
}

async function ensureSources(db: PrismaClient) {
  for (const s of NEWS_SOURCES) {
    await db.newsSource.upsert({
      where: { id: s.id },
      // `enabled` é preservado: pode ter sido alterado no painel.
      update: { name: s.name, homepage: s.homepage, feedUrl: s.feedUrl, language: s.language, kind: s.kind },
      create: { id: s.id, name: s.name, homepage: s.homepage, feedUrl: s.feedUrl, language: s.language, kind: s.kind },
    });
  }
}

async function ingestFeeds(db: PrismaClient, stats: CycleStats, now: () => Date, log: (m: string) => void) {
  const enabled = await db.newsSource.findMany({ where: { enabled: true } });
  const hosts = allowedHosts();
  const cutoff = new Date(now().getTime() - ITEM_MAX_AGE_DAYS * 86_400_000);

  await Promise.all(
    enabled.map(async (row) => {
      const def = sourceById(row.id);
      if (!def) return;
      const st = { ok: true, items: 0, created: 0, excluded: 0 } as CycleStats["sources"][string];
      stats.sources[row.id] = st;
      try {
        const { text } = await safeFetchText(def.feedUrl, {
          allowedHosts: hosts,
          accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
          allowedContentTypes: /xml|rss|atom/i,
          maxBytes: 3_000_000,
        });
        const items = parseFeed(text);
        st.items = items.length;
        const existing = new Set(
          (await db.feedItem.findMany({ where: { sourceId: row.id, guid: { in: items.map((i) => i.guid) } }, select: { guid: true } })).map(
            (x) => x.guid,
          ),
        );
        for (const it of items) {
          if (existing.has(it.guid)) continue;
          const publishedAt = it.publishedAt ?? now();
          if (publishedAt < cutoff) continue;
          const reason = exclusionReason(def, it.title, it.summary);
          await db.feedItem.create({
            data: {
              sourceId: row.id,
              guid: it.guid,
              url: it.url,
              title: it.title,
              summary: it.summary,
              publishedAt,
              publishedAtKnown: it.publishedAt !== null,
              excluded: reason !== null,
              excludeReason: reason,
            },
          });
          st.created++;
          if (reason) st.excluded++;
          else stats.newItems++;
        }
        await db.newsSource.update({ where: { id: row.id }, data: { lastFetchedAt: new Date(), lastStatus: "ok", lastError: null } });
        log(`[fonte] ${row.id}: ${st.items} itens, ${st.created} novos`);
      } catch (err) {
        st.ok = false;
        st.error = err instanceof Error ? err.message : String(err);
        await db.newsSource.update({
          where: { id: row.id },
          data: { lastFetchedAt: new Date(), lastStatus: "error", lastError: st.error.slice(0, 500) },
        });
        log(`[fonte] ${row.id}: ERRO ${st.error}`);
      }
    }),
  );
}

async function clusterNewItems(db: PrismaClient, stats: CycleStats, now: () => Date) {
  const since = new Date(now().getTime() - CLUSTER_WINDOW_HOURS * 3600_000);
  const items = await db.feedItem.findMany({
    where: { storyId: null, excluded: false, publishedAt: { gt: since } },
    orderBy: { publishedAt: "asc" },
  });
  if (items.length === 0) return;
  const stories = await db.story.findMany({
    where: { lastSeenAt: { gt: since } },
    include: { items: { orderBy: { publishedAt: "asc" }, take: 1 } },
  });
  const groups = clusterItems(
    items.map((i) => ({ id: i.id, title: i.title, summary: i.summary, publishedAt: i.publishedAt })),
    stories.map((s) => ({ id: s.id, titleKey: s.titleKey, lastSeenAt: s.lastSeenAt, seedTitle: s.items[0]?.title ?? "" })),
  );
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const g of groups) {
    const dates = g.itemIds.map((id) => byId.get(id)!.publishedAt.getTime());
    const first = new Date(Math.min(...dates));
    const last = new Date(Math.max(...dates));
    let storyId = g.storyId;
    if (!storyId) {
      const s = await db.story.create({ data: { titleKey: g.key, firstSeenAt: first, lastSeenAt: last } });
      storyId = s.id;
      stats.storiesCreated++;
    } else {
      const s = stories.find((x) => x.id === storyId)!;
      if (last > s.lastSeenAt) await db.story.update({ where: { id: storyId }, data: { lastSeenAt: last } });
      stats.storiesUpdated++;
    }
    await db.feedItem.updateMany({ where: { id: { in: g.itemIds } }, data: { storyId } });
  }
}

type ItemWithSource = Awaited<ReturnType<PrismaClient["feedItem"]["findMany"]>>[number];

function pickItems(items: ItemWithSource[]): { item: ItemWithSource; def: SourceDef }[] {
  const out: { item: ItemWithSource; def: SourceDef }[] = [];
  const seen = new Set<string>();
  const ordered = [...items].sort((a, b) => {
    const ka = sourceById(a.sourceId)?.kind === "official" ? 0 : 1;
    const kb = sourceById(b.sourceId)?.kind === "official" ? 0 : 1;
    return ka - kb || a.publishedAt.getTime() - b.publishedAt.getTime();
  });
  for (const item of ordered) {
    const def = sourceById(item.sourceId);
    if (!def || seen.has(def.id)) continue;
    seen.add(def.id);
    out.push({ item, def });
    if (out.length >= 5) break;
  }
  return out;
}

async function loadEvidence(db: PrismaClient, item: ItemWithSource, enabled: boolean): Promise<string | null> {
  if (item.evidenceText) return item.evidenceText;
  if (!enabled) return null;
  try {
    const hosts = allowedHosts();
    if (!(await robotsAllows(item.url, hosts))) return null;
    const { text } = await safeFetchText(item.url, {
      allowedHosts: hosts,
      accept: "text/html",
      allowedContentTypes: /text\/html|application\/xhtml/i,
      maxBytes: 4_000_000,
    });
    const extracted = extractArticleText(text);
    if (extracted.length < 200) return null;
    await db.feedItem.update({ where: { id: item.id }, data: { evidenceText: extracted, evidenceFetchedAt: new Date() } });
    return extracted;
  } catch {
    return null;
  }
}

async function recordAgentRun<T>(
  db: PrismaClient,
  agent: "writer" | "fact_checker",
  res: AgentResult<T>,
  storyId: string,
  articleId: string | null,
  stats: CycleStats,
) {
  stats.aiCostUsd += res.usage.costUsd;
  await db.agentRun.create({
    data: {
      agent,
      storyId,
      articleId,
      model: res.model,
      promptVersion: res.promptVersion,
      status: res.ok ? "ok" : res.refused ? "refused" : "error",
      inputTokens: res.usage.inputTokens,
      outputTokens: res.usage.outputTokens,
      costUsd: res.usage.costUsd,
      error: res.ok ? null : res.error.slice(0, 1000),
      finishedAt: new Date(),
    },
  });
}

async function writeStories(
  db: PrismaClient,
  ai: EditorialAI,
  opts: CycleOptions,
  stats: CycleStats,
  now: () => Date,
  log: (m: string) => void,
) {
  const dayAgo = new Date(now().getTime() - 86_400_000);
  const generatedToday = await db.article.count({ where: { origin: "ai", createdAt: { gt: dayAgo } } });
  const budget = Math.max(0, Math.min(opts.maxPerRun, opts.maxPerDay - generatedToday));
  if (budget === 0) {
    stats.note = "Limite de artigos por ciclo/dia atingido.";
    return;
  }

  const candidates = await db.story.findMany({
    where: { status: "open", lastSeenAt: { gt: new Date(now().getTime() - 36 * 3600_000) } },
    include: { items: { where: { excluded: false } } },
    orderBy: { lastSeenAt: "desc" },
    take: 200,
  });

  const ranked = candidates
    .map((s) => {
      const defs = s.items.map((i) => sourceById(i.sourceId)).filter((d): d is SourceDef => !!d);
      const official = defs.some((d) => d.kind === "official");
      const groups = new Set(defs.map((d) => d.group)).size;
      const settled = now().getTime() - s.firstSeenAt.getTime() >= SETTLE_MINUTES * 60_000;
      return { s, defs, official, groups, eligible: storyEligible(defs) && (settled || official) };
    })
    .filter((x) => x.eligible)
    .sort((a, b) => b.groups - a.groups || Number(b.official) - Number(a.official) || b.s.lastSeenAt.getTime() - a.s.lastSeenAt.getTime())
    .slice(0, budget);

  for (const { s } of ranked) {
    await db.story.update({ where: { id: s.id }, data: { status: "queued" } });
    try {
      await processStory(db, ai, opts, s.id, s.items, stats, now, log);
    } catch (err) {
      stats.failed++;
      const message = err instanceof Error ? err.message : String(err);
      await db.story.update({ where: { id: s.id }, data: { status: "failed", skipReason: message.slice(0, 500) } });
      log(`[pauta] ${s.id}: FALHA ${message}`);
    }
  }
}

function sanitizeBody(body: string): string {
  return body
    .replace(/<[^>]*>/g, "") // nenhum HTML
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // nenhuma imagem
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links viram texto
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function uniqueSlug(db: PrismaClient, headline: string): Promise<string> {
  const base = slugify(headline);
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    if (!(await db.article.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function processStory(
  db: PrismaClient,
  ai: EditorialAI,
  opts: CycleOptions,
  storyId: string,
  items: ItemWithSource[],
  stats: CycleStats,
  now: () => Date,
  log: (m: string) => void,
) {
  const picked = pickItems(items);
  const promptSources: (PromptSource & { item: ItemWithSource; def: SourceDef })[] = [];
  for (const [idx, p] of picked.entries()) {
    const excerpt = await loadEvidence(db, p.item, opts.fetchFullText);
    promptSources.push({
      id: `S${idx + 1}`,
      publisher: p.def.name,
      url: p.item.url,
      publishedAt: p.item.publishedAtKnown ? p.item.publishedAt.toISOString() : "desconhecida",
      language: p.def.language,
      title: p.item.title,
      summary: p.item.summary,
      excerpt,
      item: p.item,
      def: p.def,
    });
  }

  // ── Redator ──
  const written = await ai.write(promptSources);
  await recordAgentRun(db, "writer", written, storyId, null, stats);
  if (!written.ok) {
    stats.failed++;
    await db.story.update({ where: { id: storyId }, data: { status: "failed", skipReason: written.error } });
    return;
  }
  const draft = written.data;
  if (draft.skip) {
    stats.skipped++;
    await db.story.update({ where: { id: storyId }, data: { status: "skipped", skipReason: draft.skipReason.slice(0, 500) } });
    log(`[pauta] ${storyId}: descartada pelo redator — ${draft.skipReason}`);
    return;
  }

  const validIds = new Set(promptSources.map((p) => p.id));
  const usedIds = draft.usedSourceIds.filter((id) => validIds.has(id));
  const used = promptSources.filter((p) => usedIds.includes(p.id));
  const usedSources = used.length > 0 ? used : promptSources;
  const body = sanitizeBody(draft.body);
  const headline = draft.headline.replace(/\s+/g, " ").trim().slice(0, 140);
  const dek = draft.dek.replace(/\s+/g, " ").trim().slice(0, 320);

  const article = await db.article.create({
    data: {
      slug: await uniqueSlug(db, headline),
      storyId,
      status: "fact_checking",
      origin: "ai",
      category: draft.category,
      headline,
      dek,
      body,
      readingMinutes: readingMinutes(body),
      versions: { create: { version: 1, headline, dek, body, author: "agent:writer", note: written.promptVersion } },
      sources: {
        create: usedSources.map((p) => ({
          feedItemId: p.item.id,
          publisher: p.def.name,
          sourceId: p.def.id,
          url: p.item.url,
          title: p.item.title,
          publishedAt: p.item.publishedAt,
          publishedAtKnown: p.item.publishedAtKnown,
        })),
      },
    },
  });
  await db.agentRun.updateMany({ where: { storyId, agent: "writer", articleId: null }, data: { articleId: article.id } });
  await db.story.update({ where: { id: storyId }, data: { status: "drafted" } });
  stats.drafted++;

  // ── Verificador de fatos ──
  const checked = await ai.factCheck(usedSources, { headline, dek, body });
  await recordAgentRun(db, "fact_checker", checked, storyId, article.id, stats);

  const sensitive = [
    ...new Set([
      ...sensitivityReasons([headline, dek, body, ...usedSources.flatMap((s) => [s.title, s.summary])]),
      ...draft.sensitiveTopics.filter((t) => t.trim()).map((t) => `marcado pelo redator: ${t}`),
    ]),
  ];

  let overlapMax = 0;
  let runMax = 0;
  for (const s of usedSources) {
    const ov = copyOverlap(body, `${s.title}\n${s.summary}\n${s.excerpt ?? ""}`);
    overlapMax = Math.max(overlapMax, ov.ratio);
    runMax = Math.max(runMax, ov.longestRun);
  }

  let fc: FactCheckSummary;
  const reasons: string[] = [];
  if (checked.ok) {
    const c = checked.data.claims;
    fc = {
      total: c.length,
      supported: c.filter((x) => x.verdict === "supported").length,
      unsupported: c.filter((x) => x.verdict === "unsupported").length,
      contradicted: c.filter((x) => x.verdict === "contradicted").length,
      unverifiable: c.filter((x) => x.verdict === "unverifiable").length,
      checkerConfidence: Math.max(0, Math.min(1, checked.data.overallConfidence)),
      numbersConsistent: checked.data.numbersConsistent,
      attributionOk: checked.data.attributionOk,
    };
    await db.articleClaim.createMany({
      data: c.map((x) => ({
        articleId: article.id,
        text: x.text.slice(0, 1000),
        verdict: x.verdict,
        evidence: x.evidence.slice(0, 600),
        sourceRefs: JSON.stringify(
          x.sourceIds.map((id) => usedSources.find((s) => s.id === id)?.def.id).filter((v): v is string => !!v),
        ),
      })),
    });
  } else {
    fc = {
      total: 0,
      supported: 0,
      unsupported: 0,
      contradicted: 0,
      unverifiable: 0,
      checkerConfidence: 0,
      numbersConsistent: false,
      attributionOk: false,
    };
    reasons.push(`checagem automática falhou: ${checked.error}`);
  }

  const dayAgo = new Date(now().getTime() - 86_400_000);
  const publishedToday = await db.article.count({ where: { origin: "ai", approvedById: null, publishedAt: { gt: dayAgo } } });
  const decision = decidePublication({
    mode: opts.mode,
    sources: usedSources.map((s) => s.def),
    factCheck: fc,
    sensitiveReasons: sensitive,
    maxCopyRatio: overlapMax,
    longestCopiedRun: runMax,
    bodyWords: wordCount(body),
    publishedToday,
    maxPerDay: opts.maxPerDay,
  });
  const allReasons = [...reasons, ...decision.reasons];
  const publish = decision.action === "publish" && reasons.length === 0;

  await db.article.update({
    where: { id: article.id },
    data: {
      status: publish ? "published" : "in_review",
      publishedAt: publish ? now() : null,
      sensitive: sensitive.length > 0,
      reviewReasons: JSON.stringify(allReasons),
      factCheckScore: fc.total ? fc.supported / fc.total : null,
    },
  });
  await db.auditLog.create({
    data: {
      actor: "system:pipeline",
      action: publish ? "article.auto_published" : "article.sent_to_review",
      entity: "article",
      entityId: article.id,
      details: JSON.stringify({ reasons: allReasons, overlapMax, runMax, factCheck: fc }),
    },
  });
  if (publish) stats.published++;
  else stats.sentToReview++;
  log(`[artigo] ${article.slug}: ${publish ? "PUBLICADO" : "revisão"} ${allReasons.join("; ")}`);
}
