import { decodeEntities, truncate } from "./text";

// Extração heurística do corpo de uma página de notícia: concatena parágrafos <p>
// de tamanho razoável. O resultado é EVIDÊNCIA INTERNA para checagem de fatos —
// nunca é exibido nem republicado.

export const EVIDENCE_MAX_CHARS = 8000;

export function extractArticleText(html: string): string {
  const body = html
    .replace(/<(script|style|noscript|iframe|svg|nav|footer|header|aside|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const paragraphs: string[] = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(body))) {
    const t = decodeEntities(m[1]!.replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    if (t.length < 40) continue;
    if (/cookie|subscribe|newsletter|sign up|inscreva|assine|all rights reserved|todos os direitos/i.test(t) && t.length < 200) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    paragraphs.push(t);
  }
  return truncate(paragraphs.join("\n"), EVIDENCE_MAX_CHARS);
}
