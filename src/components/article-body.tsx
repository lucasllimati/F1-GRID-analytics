import type { ReactNode } from "react";

// Renderizador de Markdown RESTRITO, sem dangerouslySetInnerHTML:
// suporta parágrafos, "## subtítulos", listas "- " e **negrito**/*itálico*.
// Qualquer HTML vira texto literal (o React escapa), então não há vetor de XSS.

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={`${keyBase}-${i++}`}>{tok.slice(2, -2)}</strong>);
    else out.push(<em key={`${keyBase}-${i++}`}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function ArticleBody({ markdown }: { markdown: string }) {
  const blocks = markdown.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className="prose-article">
      {blocks.map((block, bi) => {
        const b = block.trim();
        if (!b) return null;
        if (/^#{2,3}\s/.test(b)) return <h2 key={bi}>{inline(b.replace(/^#{2,3}\s+/, ""), `h${bi}`)}</h2>;
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return (
            <ul key={bi}>
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*[-*]\s+/, ""), `l${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        return <p key={bi}>{inline(b.replace(/^#\s+/, "").replace(/\n/g, " "), `p${bi}`)}</p>;
      })}
    </div>
  );
}
