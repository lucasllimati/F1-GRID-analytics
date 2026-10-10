// Gráfico de linhas em SVG puro (sem dependências), com tabela alternativa para leitores de tela.
// Cores nunca são o único meio de identificação: cada linha tem rótulo direto no fim.

export type Series = { id: string; label: string; values: number[] };

const PALETTE = ["var(--accent)", "#4ea3ff", "#f5b301", "#2ecc71", "#c77dff"];
const DASH = ["", "6 3", "2 3", "8 3 2 3", "1 2"];

export function LineChart({
  series,
  xLabels,
  title,
  unit,
}: {
  series: Series[];
  xLabels: string[];
  title: string;
  unit: string;
}) {
  const W = 760;
  const H = 300;
  const pad = { l: 44, r: 120, t: 16, b: 32 };
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const n = Math.max(1, xLabels.length - 1);
  const x = (i: number) => pad.l + (i / n) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / max) * (H - pad.t - pad.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={title}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--text-faint)">
              {t}
            </text>
          </g>
        ))}
        {xLabels.map((l, i) =>
          i % Math.ceil(xLabels.length / 12) === 0 || i === xLabels.length - 1 ? (
            <text key={l + i} x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--text-faint)">
              {l}
            </text>
          ) : null,
        )}
        {series.map((s, si) => {
          const color = PALETTE[si % PALETTE.length]!;
          const d = s.values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
          const lastV = s.values[s.values.length - 1] ?? 0;
          return (
            <g key={s.id}>
              <path d={d} fill="none" stroke={color} strokeWidth={si === 0 ? 2.75 : 2} strokeDasharray={DASH[si % DASH.length]} />
              <circle cx={x(s.values.length - 1)} cy={y(lastV)} r="3.5" fill={color} />
              <text x={x(s.values.length - 1) + 8} y={y(lastV) + 4} fontSize="12" fill="var(--text)" fontWeight="600">
                {s.label} · {lastV}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 text-xs text-faint">
        {title} ({unit}). Rótulos e padrões de linha distinguem as séries.
      </figcaption>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-muted">Ver dados em tabela</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Série</th>
                {xLabels.map((l, i) => (
                  <th scope="col" key={l + i} className="num">
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.id}>
                  <th scope="row" className="text-left normal-case tracking-normal text-fg">
                    {s.label}
                  </th>
                  {s.values.map((v, i) => (
                    <td key={i} className="num">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
