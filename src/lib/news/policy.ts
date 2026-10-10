import type { SourceDef } from "./sources";
import { foldAccents } from "./text";
import type { PublishMode } from "./states";

// Regras editoriais determinísticas. A IA nunca decide sozinha se algo é publicado:
// estas regras (testadas em tests/policy.test.ts) têm a palavra final.

// ── Filtro de itens que não são notícia ────────────────────────────

const NON_NEWS = [
  /\bbet(ting)?\b|\bbet builder\b|\bodds\b|\bapostas?\b/i,
  /\bquiz\b|\bpodcast\b|\bgallery\b|\bgaleria\b|\bwallpapers?\b|\bfantasy\b/i,
  /\bas it happened\b|\blive (updates|blog|text|commentary)\b|\bao vivo\b|\btempo real\b/i,
  /\b(watch|video|vídeo|assista)\s*:/i,
  /\btickets?\b|\bingressos?\b|\bcompetition\b|\bwin an?\b|\bsorteio\b|\bpromo(ção|tion)\b/i,
  /\bhow to watch\b|\bonde assistir\b|\btv schedule\b/i,
];

const F1_KEYWORDS =
  /\b(f1|formula 1|formula one|fórmula 1|grand prix|grande pr[eê]mio|ferrari|mercedes|mclaren|red bull|aston martin|alpine|williams|haas|sauber|audi|cadillac|racing bulls)\b/i;

export function exclusionReason(source: SourceDef, title: string, summary: string): string | null {
  const t = `${title} ${summary}`;
  for (const re of NON_NEWS) if (re.test(title)) return "não-notícia (promocional, apostas, vídeo, ao vivo ou similar)";
  if (source.requireF1Keyword && !F1_KEYWORDS.test(t)) return "fora do escopo da Fórmula 1";
  return null;
}

// ── Detecção de temas sensíveis (exigem revisão humana) ─────────────

const SENSITIVE: { reason: string; re: RegExp }[] = [
  { reason: "morte ou falecimento", re: /\b(dies|died|death|dead|killed|fatal|passed away|morre|morreu|morte|falece|faleceu|falecimento|obituary|obituario)\b/i },
  { reason: "acidente com feridos ou saúde", re: /\b(injur(y|ed|ies)|hospital(ised|ized)?|surgery|concussion|fracture|lesao|lesoes|ferido|ferimento|hospitalizado|cirurgia|fratura|saude)\b/i },
  { reason: "questão jurídica", re: /\b(lawsuit|court|legal action|sued|suing|trial|tribunal|processo judicial|processa|processado|justica|corte de apelacao|court of appeal)\b/i },
  { reason: "acusação ou investigação", re: /\b(accus(ed|ation)|alleg(ed|ation)|investigation|probe|harass(ment)?|misconduct|arrest(ed)?|scandal|acusa(do|cao)?|alegac(ao|oes)|investigac(ao|ado)|assedio|preso|escandalo)\b/i },
  { reason: "penalidade ou recurso controverso", re: /\b(appeal|protest|disqualif(ied|ication)|excluded|right of review|recurso|protesto|desclassifica(do|cao))\b/i },
  { reason: "informação não confirmada (rumor)", re: /\b(rumou?r|speculat(ion|ed)|reportedly|understood to|sources say|could be|set to|in talks|boato|especula(cao|do)|rumores?|segundo fontes|negocia)\b/i },
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
