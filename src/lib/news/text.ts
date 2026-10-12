// Normalização de texto, tokenização e medidas de similaridade/cópia.

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

/** Remove todo HTML (o conteúdo de terceiros nunca é renderizado como HTML). */
export function stripHtml(input: string): string {
  // Alguns feeds (ex.: FIA) enviam HTML escapado (&lt;p&gt;): decodifica antes de remover tags.
  const html = /&lt;\/?[a-z]/i.test(input) ? decodeEntities(input) : input;
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|iframe|svg)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h\d)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return `${cut.slice(0, sp > max * 0.6 ? sp : max)}…`;
}

export function foldAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const STOPWORDS = new Set(
  (
    "the a an and or of to in on for at by with from as is are was were be been his her its their it this that " +
    "after before over into about new says say said will would could should has have had not but up out off more than " +
    "f1 formula grand prix gp race news what why how who when where vs v " +
    "o os as um uma uns umas e ou de do da dos das em no na nos nas por para com sem sobre apos antes ao aos " +
    "que se seu sua seus suas diz afirma revela sera foi sao esta estao como mais menos ja ainda formula " +
    // espanhol, italiano e alemão (fontes europeias): melhora o agrupamento entre veículos do mesmo idioma
    "los las del por para con una dice tras ante sobre segun " +
    "gli della delle dei con per una che dopo nel nella alla sul " +
    "der die das und mit von fur ist ein eine nach bei auf den dem des"
  ).split(/\s+/),
);

export function tokens(s: string): string[] {
  return foldAccents(s.toLowerCase())
    .replace(/[’']s\b/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

export function jaccard(a: Iterable<string>, b: Iterable<string>): number {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Nomes próprios prováveis (palavras capitalizadas fora do início da frase). */
export function properNouns(s: string): string[] {
  const out = new Set<string>();
  const words = s.split(/\s+/);
  words.forEach((w, i) => {
    const clean = w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
    if (clean.length >= 3 && /^\p{Lu}/u.test(clean) && (i > 0 || words.length <= 3)) {
      out.add(foldAccents(clean.toLowerCase()));
    }
  });
  return [...out].filter((t) => !STOPWORDS.has(t));
}

export function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

function words(s: string): string[] {
  return foldAccents(s.toLowerCase())
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function shingles(ws: string[], n: number): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + n <= ws.length; i++) out.add(ws.slice(i, i + n).join(" "));
  return out;
}

/**
 * Mede cópia literal: fração de n-gramas (n=8) do nosso texto que aparecem na fonte
 * e o maior trecho contínuo compartilhado (em palavras).
 */
export function copyOverlap(ours: string, source: string, n = 8): { ratio: number; longestRun: number } {
  const a = words(ours);
  const b = words(source);
  if (a.length < n || b.length < n) return { ratio: 0, longestRun: 0 };
  const srcSh = shingles(b, n);
  let hit = 0;
  let run = 0;
  let longest = 0;
  const total = a.length - n + 1;
  for (let i = 0; i < total; i++) {
    if (srcSh.has(a.slice(i, i + n).join(" "))) {
      hit++;
      run = run === 0 ? n : run + 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }
  return { ratio: hit / total, longestRun: longest };
}

export function slugify(s: string, maxLen = 80): string {
  const base = foldAccents(s.toLowerCase().replace(/º/g, "o").replace(/ª/g, "a"))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.slice(0, maxLen).replace(/-+$/g, "") || "noticia";
}

export function readingMinutes(text: string): number {
  return Math.max(1, Math.round(wordCount(text) / 200));
}
