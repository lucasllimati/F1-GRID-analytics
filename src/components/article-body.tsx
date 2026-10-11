import type { ReactNode } from "react";

// Renderizador de Markdown RESTRITO, sem dangerouslySetInnerHTML:
// suporta parágrafos, "## subtítulos", listas "- " e **negrito**/*itálico*.
// Qualquer HTML vira texto literal (o React escapa), então não há vetor de XSS.
// Tempos de cronometragem viram "etiquetas" visuais (ver TIMING abaixo).

/**
 * Formatos de cronometragem reconhecidos:
 *  - volta:     1min31s373 · 1:31.373 · 1:31,373
 *  - diferença: 0s054 · +0s054 · +0.054s · 0,054s · +12.345s
 * O texto original é preservado; só a apresentação muda.
 */
const TIMING =
  /(?<![\p{L}\d])(?:(\d{1,2}min\d{1,2}s\d{3})|(\d{1,2}:\d{2}[.,]\d{3})|([+−-]?\d{1,3}s\d{3})|([+−]?\d{1,3}[.,]\d{3}s))(?![\p{L}\d])/gu;

function Stopwatch() {
  return (
    <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="mr-1 inline-block -translate-y-px">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M9.5 2h5M12 2v3" />
    </svg>
  );
}

export function TimingChip({ value, kind }: { value: string; kind: "lap" | "gap" }) {
  return kind === "lap" ? (
    <span className="timing timing-lap" title="Tempo de volta">
      <Stopwatch />
      {value}
    </span>
  ) : (
    <span className="timing timing-gap" title="Diferença de tempo">
      {value}
    </span>
  );
}

function withTimings(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(TIMING)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const kind = m[1] || m[2] ? "lap" : "gap";
    out.push(<TimingChip key={`${keyBase}-t${i++}`} value={m[0]} kind={kind} />);
    last = idx + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Texto em linha com **negrito**, *itálico* e etiquetas de tempo. Reutilizado na linha fina. */
export function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(...withTimings(text.slice(last, m.index), `${keyBase}-s${i}`));
    const tok = m[0];
    const k = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={k}>{withTimings(tok.slice(2, -2), k)}</strong>);
    else out.push(<em key={k}>{withTimings(tok.slice(1, -1), k)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(...withTimings(text.slice(last), `${keyBase}-e`));
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
