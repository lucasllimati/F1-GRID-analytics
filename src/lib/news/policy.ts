import type { SourceDef } from "./sources";
import { foldAccents } from "./text";
import type { PublishMode } from "./states";

// Regras editoriais determinísticas. A IA nunca decide sozinha se algo é publicado:
// estas regras (testadas em tests/policy.test.ts) têm a palavra final.

// ── Filtro de itens que não são notícia ────────────────────────────

// Padrões aplicados ao TÍTULO, sem acentos e em minúsculas (pt, en, es, it, de).
const NON_NEWS = [
  /\bbet(ting)?\b|\bbet builder\b|\bodds\b|\bapostas?\b|\bapuestas?\b|\bscommesse\b|\bwetten\b/,
  /\bquiz\b|\bpodcast\b|\bgaller(y|ia)\b|\bgaleria\b|\bwallpapers?\b|\bfantasy\b|\b(photos?|fotos?)\s*:/,
  /\bas it happened\b|\blive (updates|blog|text|commentary|coverage)\b|\bao vivo\b|\btempo real\b|\blap[- ]by[- ]lap\b|\ben (vivo|directo)\b|\bdiretta\b|\bliveticker\b/,
  /\b(watch|video|assista|mira|guarda)\s*:/,
  /\btickets?\b|\bingressos?\b|\bentradas\b|\bbiglietti\b|\bcompetition\b|\bwin an?\b|\bsorteio\b|\bpromo(cao|tion)\b/,
  /\bhow to watch\b|\bonde assistir\b|\btv schedule\b|\bdonde ver\b|\bdove vedere\b|\btv-quoten\b/,
  /\brassegna stampa\b|\bpress review\b|\bresumo da imprensa\b/,
];

// Categoria, equipes, pilotos e chefes de equipe do grid atual (revisar a cada temporada).
const F1_KEYWORDS = new RegExp(
  "\\b(" +
    [
      "f1", "formula 1", "formula one", "formula uno", "formel 1", "grand prix", "grande premio", "gran premio", "gp",
      "ferrari", "mercedes", "mclaren", "red bull", "aston martin", "alpine", "williams", "haas", "sauber", "audi", "cadillac", "racing bulls",
      "verstappen", "hamilton", "leclerc", "norris", "piastri", "russell", "antonelli", "sainz", "alonso", "stroll", "gasly", "ocon",
      "albon", "hulkenberg", "bortoleto", "bearman", "lawson", "hadjar", "lindblad", "colapinto", "tsunoda", "bottas", "perez",
      "wolff", "vasseur", "stella", "mekies", "horner", "fia",
    ].join("|") +
    ")\\b",
);

const OTHER_SERIES =
  /\b(motogp|moto2|moto3|worldsbk|superbike|indycar|indy 500|nascar|wec|le mans|imsa|formula e|wrc|rally|dakar|supercars|btcc|dtm|stock car|gt world challenge|bathurst)\b/;

/** Vídeos e galerias identificados pelo endereço (vale para todas as fontes). */
const NON_NEWS_URL = /\/\/video\.|\/videos?\/|\/galler(y|ia)\/|\/fotos?\//i;

const norm = (s: string) => foldAccents(s.toLowerCase());

export function exclusionReason(source: SourceDef, title: string, summary: string, url = ""): string | null {
  const nt = norm(title);
  const all = norm(`${title} ${summary}`);
  for (const re of NON_NEWS) if (re.test(nt)) return "não-notícia (promocional, apostas, vídeo, ao vivo ou similar)";
  if (url && (NON_NEWS_URL.test(url) || source.excludeUrl?.test(url))) return "não-notícia (vídeo ou galeria)";
  if (source.requireF1Keyword) {
    // Feeds multiesportivos: título que cita outra categoria e não cita F1 fica de fora,
    // mesmo que o resumo mencione um nome de equipe de F1.
    if (OTHER_SERIES.test(nt) && !F1_KEYWORDS.test(nt)) return "fora do escopo da Fórmula 1";
    if (!F1_KEYWORDS.test(all)) return "fora do escopo da Fórmula 1";
  }
  return null;
}

// ── Detecção de temas sensíveis (exigem revisão humana) ─────────────

const SENSITIVE: { reason: string; re: RegExp }[] = [
  { reason: "morte ou falecimento", re: /\b(dies|died|death|dead|killed|fatal|passed away|morre|morreu|morte|falece|faleceu|falecimento|obituary|obituario|muere|murio|muerte|fallece|morto|muore|morte|tod|gestorben|verstorben)\b/i },
  { reason: "acidente com feridos ou saúde", re: /\b(injur(y|ed|ies)|hospital(ised|ized)?|surgery|concussion|fracture|lesao|lesoes|ferido|ferimento|hospitalizado|cirurgia|fratura|saude|herido|lesion|hospitalizado|ferito|infortunio|ospedale|verletzt|verletzung|krankenhaus)\b/i },
  { reason: "questão jurídica", re: /\b(lawsuit|court|legal action|sued|suing|trial|tribunal|processo judicial|processa|processado|justica|corte de apelacao|court of appeal|juicio|tribunale|klage|gericht)\b/i },
  { reason: "acusação ou investigação", re: /\b(accus(ed|ation)|alleg(ed|ation)|investigation|probe|harass(ment)?|misconduct|arrest(ed)?|scandal|acusa(do|cao)?|alegac(ao|oes)|investigac(ao|ado)|assedio|preso|escandalo|acusacion|investigacion|acoso|accusa|indagine|molestie|vorwurf|ermittlung|untersuchung)\b/i },
  { reason: "penalidade ou recurso controverso", re: /\b(appeal|protest|disqualif(ied|ication)|excluded|right of review|recurso|protesto|desclassifica(do|cao)|descalificado|apelacion|squalific(a|ato)|ricorso|disqualifiziert|protest)\b/i },
  { reason: "informação não confirmada (rumor)", re: /\b(rumou?r|speculat(ion|ed)|reportedly|understood to|sources say|could be|set to|in talks|boato|especula(cao|do)|rumores?|segundo fontes|negocia|rumores|segun fuentes|indiscrezion(e|i)|voci|trattativa|geruchte?|spekulation)\b/i },
];

export function sensitivityReasons(texts: string[]): string[] {
  const joined = foldAccents(texts.join(" \n "));
  const out: string[] = [];
  for (const s of SENSITIVE) if (s.re.test(joined)) out.push(s.reason);
  return out;
}

// ── Independência de fontes ────────────────────────────────────────

export function independentGroups(sources: Pick<SourceDef, "group">[]): number {
  return new Set(sources.map((s) => s.group)).size;
}

export function hasOfficialSource(sources: Pick<SourceDef, "kind">[]): boolean {
  return sources.some((s) => s.kind === "official");
}

/** Pauta elegível para redação automática: oficial OU ≥2 grupos editoriais independentes. */
export function storyEligible(sources: Pick<SourceDef, "group" | "kind">[]): boolean {
  return hasOfficialSource(sources) || independentGroups(sources) >= 2;
}

// ── Decisão de publicação ──────────────────────────────────────────

export type FactCheckSummary = {
  total: number;
  supported: number;
  unsupported: number;
  contradicted: number;
  unverifiable: number;
  checkerConfidence: number; // 0–1
  numbersConsistent: boolean;
  attributionOk: boolean;
};

export type PublishInput = {
  mode: PublishMode;
  sources: Pick<SourceDef, "group" | "kind">[];
  factCheck: FactCheckSummary;
  sensitiveReasons: string[];
  maxCopyRatio: number;
  longestCopiedRun: number;
  bodyWords: number;
  publishedToday: number;
  maxPerDay: number;
};

export type PublishDecision = { action: "publish" | "review"; reasons: string[] };

export const THRESHOLDS = {
  minClaims: 3,
  minCheckerConfidence: 0.8,
  maxCopyRatio: 0.06,
  maxCopiedRun: 14,
  minWords: 180,
  maxWords: 1200,
};

export function decidePublication(i: PublishInput): PublishDecision {
  const reasons: string[] = [];
  if (i.mode !== "auto_restricted") reasons.push(`modo de publicação "${i.mode}" exige revisão humana`);
  if (!storyEligible(i.sources)) reasons.push("menos de duas fontes independentes e nenhuma fonte oficial");
  for (const r of i.sensitiveReasons) reasons.push(`tema sensível: ${r}`);
  const fc = i.factCheck;
  if (fc.total < THRESHOLDS.minClaims) reasons.push("poucas afirmações verificáveis extraídas");
  if (fc.contradicted > 0) reasons.push(`${fc.contradicted} afirmação(ões) contradita(s) pelas fontes`);
  if (fc.unsupported > 0) reasons.push(`${fc.unsupported} afirmação(ões) sem suporte nas fontes`);
  if (fc.unverifiable > 0) reasons.push(`${fc.unverifiable} afirmação(ões) não verificável(is)`);
  if (fc.checkerConfidence < THRESHOLDS.minCheckerConfidence) reasons.push("baixa confiança do verificador de fatos");
  if (!fc.numbersConsistent) reasons.push("números divergentes das fontes");
  if (!fc.attributionOk) reasons.push("atribuição de fontes insuficiente");
  if (i.maxCopyRatio > THRESHOLDS.maxCopyRatio || i.longestCopiedRun > THRESHOLDS.maxCopiedRun) {
    reasons.push("trechos muito próximos do texto original (risco de cópia)");
  }
  if (i.bodyWords < THRESHOLDS.minWords || i.bodyWords > THRESHOLDS.maxWords) reasons.push("tamanho do texto fora do padrão");
  if (i.publishedToday >= i.maxPerDay) reasons.push("limite diário de publicações automáticas atingido");
  return { action: reasons.length === 0 ? "publish" : "review", reasons };
}
