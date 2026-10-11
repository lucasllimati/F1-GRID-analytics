"use client";

import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

// Gráficos SVG interativos, sem dependências.
// Regras: cor segue a entidade (slot fixo), nunca a posição; identidade nunca só por cor
// (traço diferente + rótulo direto + legenda); tooltip com mira; tabela alternativa; um único eixo Y.

export type ChartSeries = {
  id: string;
  label: string;
  /** Slot categórico fixo (0–3), atribuído pela ordem de seleção. */
  slot: number;
  values: (number | null)[];
  /** Observação por ponto (ex.: "Abandono"), exibida no tooltip e na tabela. */
  notes?: (string | null)[];
};

/** Formatos nomeados: funções não podem ser passadas de componentes de servidor para de cliente. */
export type ValueFormat = "number" | "position";
const FORMATTERS: Record<ValueFormat, (v: number) => string> = {
  number: (v) => v.toLocaleString("pt-BR"),
  position: (v) => `P${v}`,
};

const COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];
const DASH = ["", "7 4", "2 4", "10 4 2 4"];
const W = 760;
const H = 340;
// Base maior: rótulos de etapa (país/cidade) inclinados para caberem todos.
const PAD = { l: 66, r: 120, t: 18, b: 78 };

function shortLabel(s: string) {
  return s.length > 13 ? `${s.slice(0, 12)}…` : s;
}

function AxisLabel({ x, label }: { x: number; label: string }) {
  const y = H - PAD.b + 14;
  return (
    <text x={x} y={y} transform={`rotate(-40 ${x} ${y})`} textAnchor="end" fontSize="11" fill="var(--text-faint)">
      <title>{label}</title>
      {shortLabel(label)}
    </text>
  );
}

function niceMax(v: number) {
  if (v <= 5) return 5;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function Legend({ series }: { series: ChartSeries[] }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legenda">
      {series.map((s) => (
        <li key={s.id} className="flex items-center gap-1.5">
          <svg width="22" height="8" aria-hidden="true">
            <line x1="1" x2="21" y1="4" y2="4" stroke={COLORS[s.slot]} strokeWidth="2.5" strokeDasharray={DASH[s.slot]} />
          </svg>
          {s.label}
        </li>
      ))}
    </ul>
  );
}

function DataTable({
  series,
  xLabels,
  xTitles,
  xDetails,
  format,
}: {
  series: ChartSeries[];
  xLabels: string[];
  xTitles: string[];
  xDetails?: string[];
  format: (v: number) => string;
}) {
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-muted">Ver dados em tabela</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Etapa</th>
              {series.map((s) => (
                <th scope="col" key={s.id} className="num">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {xLabels.map((x, i) => (
              <tr key={x}>
                <th scope="row" className="text-left normal-case tracking-normal text-fg">
                  {xTitles[i] ?? x}
                  {xDetails?.[i] && <span className="block text-xs font-normal text-faint">{xDetails[i]}</span>}
                </th>
                {series.map((s) => {
                  const v = s.values[i];
                  return (
                    <td key={s.id} className="num">
                      {v === null || v === undefined ? (s.notes?.[i] ?? "—") : format(v)}
                      {v !== null && v !== undefined && s.notes?.[i] ? <span className="text-faint"> ({s.notes[i]})</span> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function useHover(n: number) {
  const ref = useRef<SVGSVGElement>(null);
  const [idx, setIdx] = useState<number | null>(null);
  const toIndex = (clientX: number) => {
    const el = ref.current;
    if (!el || n === 0) return null;
    const rect = el.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    const span = (W - PAD.l - PAD.r) / Math.max(1, n - 1);
    return Math.max(0, Math.min(n - 1, Math.round((x - PAD.l) / span)));
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => setIdx(toIndex(e.clientX));
  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowRight") setIdx((i) => Math.min(n - 1, (i ?? -1) + 1));
    else if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, (i ?? n) - 1));
    else if (e.key === "Escape") setIdx(null);
    else return;
    e.preventDefault();
  };
  return { ref, idx, setIdx, onPointerMove, onKeyDown };
}

function Tooltip({
  idx,
  leftPct,
  title,
  subtitle,
  series,
  format,
}: {
  subtitle?: string;
  idx: number;
  /** Posição horizontal do ponto em % da largura do gráfico. */
  leftPct: number;
  title: string;
  series: ChartSeries[];
  format: (v: number) => string;
}) {
  const alignRight = leftPct > 60;
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-2 z-10 min-w-44 rounded border border-line-strong bg-elev px-3 py-2 text-xs shadow-xl"
      style={alignRight ? { right: `${100 - leftPct + 1}%` } : { left: `${leftPct + 1}%` }}
    >
      <p className="font-semibold text-fg">{title}</p>
      {subtitle && <p className="mb-1 text-[0.7rem] text-faint">{subtitle}</p>}
      {!subtitle && <div className="mb-1" />}
      <ul className="space-y-0.5">
        {series.map((s) => {
          const v = s.values[idx];
          return (
            <li key={s.id} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLORS[s.slot] }} aria-hidden="true" />
                {s.label}
              </span>
              <span className="font-semibold tabular text-fg">
                {v === null || v === undefined ? (s.notes?.[idx] ?? "—") : format(v)}
                {v !== null && v !== undefined && s.notes?.[idx] ? <span className="font-normal text-faint"> · {s.notes[idx]}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Linhas ao longo das etapas. `invert` para posições (1º no topo). */
export function TrendChart({
  title,
  caption,
  series,
  xLabels,
  xTitles,
  xDetails,
  invert = false,
  format: formatName = "number",
}: {
  title: string;
  caption: string;
  series: ChartSeries[];
  xLabels: string[];
  xTitles: string[];
  /** Linha extra no tooltip e na tabela (circuito, cidade, data). */
  xDetails?: string[];
  invert?: boolean;
  format?: ValueFormat;
}) {
  const format = FORMATTERS[formatName];
  const n = xLabels.length;
  const hover = useHover(n);
  const descId = useId();
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  if (n === 0 || all.length === 0) {
    return <p className="rounded border border-dashed border-line p-6 text-center text-sm text-muted">Sem dados para {title.toLowerCase()}.</p>;
  }
  const yMax = invert ? Math.max(10, Math.ceil(Math.max(...all) / 5) * 5) : niceMax(Math.max(...all));
  const yMin = invert ? 1 : 0;
  const x = (i: number) => PAD.l + (i / Math.max(1, n - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => {
    const t = (v - yMin) / Math.max(1, yMax - yMin);
    return invert ? PAD.t + t * (H - PAD.t - PAD.b) : H - PAD.b - t * (H - PAD.t - PAD.b);
  };
  const ticks = invert
    ? [1, ...Array.from({ length: Math.floor(yMax / 5) }, (_, i) => (i + 1) * 5)]
    : [0, 0.2, 0.4, 0.6, 0.8, 1].map((f) => Math.round(yMax * f));

  // Rótulos diretos no fim, afastados para não colidir.
  const ends = series
    .map((s) => {
      let last = -1;
      s.values.forEach((v, i) => {
        if (v !== null) last = i;
      });
      return last >= 0 ? { s, i: last, v: s.values[last]!, yy: y(s.values[last]!) } : null;
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => a.yy - b.yy);
  for (let k = 1; k < ends.length; k++) if (ends[k]!.yy - ends[k - 1]!.yy < 14) ends[k]!.yy = ends[k - 1]!.yy + 14;

  const labelEvery = Math.ceil(n / 26); // todas as etapas de uma temporada cabem inclinadas

  return (
    <figure>
      <figcaption className="mb-1">
        <span className="block font-display text-lg font-bold uppercase">{title}</span>
        <span id={descId} className="block text-xs text-faint">
          {caption}
        </span>
      </figcaption>
      <Legend series={series} />
      <div className="relative">
        <svg
          ref={hover.ref}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-none outline-none"
          role="img"
          aria-label={`${title}. Use as setas para navegar pelas etapas.`}
          aria-describedby={descId}
          tabIndex={0}
          onPointerMove={hover.onPointerMove}
          onPointerLeave={() => hover.setIdx(null)}
          onKeyDown={hover.onKeyDown}
          onBlur={() => hover.setIdx(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
              <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--text-faint)">
                {invert ? `P${t}` : t}
              </text>
            </g>
          ))}
          {xLabels.map((l, i) => (i % labelEvery === 0 || i === n - 1 ? <AxisLabel key={`${l}-${i}`} x={x(i)} label={l} /> : null))}
          {hover.idx !== null && <line x1={x(hover.idx)} x2={x(hover.idx)} y1={PAD.t} y2={H - PAD.b} stroke="var(--text-faint)" strokeDasharray="3 3" />}
          {series.map((s) => {
            let d = "";
            let pen = false;
            s.values.forEach((v, i) => {
              if (v === null) {
                pen = false;
                return;
              }
              d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
              pen = true;
            });
            return (
              <g key={s.id}>
                <path d={d} fill="none" stroke={COLORS[s.slot]} strokeWidth="2" strokeLinejoin="round" strokeDasharray={DASH[s.slot]} />
                {s.values.map((v, i) =>
                  v === null ? null : (
                    <circle
                      key={i}
                      cx={x(i)}
                      cy={y(v)}
                      r={hover.idx === i ? 5 : 3}
                      fill={COLORS[s.slot]}
                      stroke="var(--bg-elev)"
                      strokeWidth="2"
                    />
                  ),
                )}
              </g>
            );
          })}
          {ends.map((e) => (
            <text key={e.s.id} x={x(e.i) + 9} y={e.yy + 4} fontSize="12" fontWeight="600" fill="var(--text)">
              {e.s.label} · {format(e.v)}
            </text>
          ))}
        </svg>
        {hover.idx !== null && (
          <Tooltip
            idx={hover.idx}
            leftPct={(x(hover.idx) / W) * 100}
            title={xTitles[hover.idx] ?? xLabels[hover.idx] ?? ""}
            subtitle={xDetails?.[hover.idx]}
            series={series}
            format={format}
          />
        )}
      </div>
      <DataTable series={series} xLabels={xLabels} xTitles={xTitles} xDetails={xDetails} format={format} />
    </figure>
  );
}

/** Barras agrupadas por etapa (ex.: pontos por etapa). */
export function RoundBars({
  title,
  caption,
  series,
  xLabels,
  xTitles,
  xDetails,
  format: formatName = "number",
}: {
  title: string;
  caption: string;
  series: ChartSeries[];
  xLabels: string[];
  xTitles: string[];
  /** Linha extra no tooltip e na tabela (circuito, cidade, data). */
  xDetails?: string[];
  format?: ValueFormat;
}) {
  const format = FORMATTERS[formatName];
  const n = xLabels.length;
  const hover = useHover(n);
  const descId = useId();
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  if (n === 0 || all.length === 0) {
    return <p className="rounded border border-dashed border-line p-6 text-center text-sm text-muted">Sem dados para {title.toLowerCase()}.</p>;
  }
  const yMax = niceMax(Math.max(1, ...all));
  const plotW = W - PAD.l - 16;
  const slot = plotW / n;
  const gap = 2;
  const barW = Math.max(2, (slot * 0.8 - gap * (series.length - 1)) / series.length);
  const cx = (i: number) => PAD.l + slot * i + slot / 2;
  const y = (v: number) => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b);
  const base = H - PAD.b;
  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1].map((f) => Math.round(yMax * f));
  const labelEvery = Math.ceil(n / 26); // todas as etapas de uma temporada cabem inclinadas
  // Hover usa o mesmo mapeamento do gráfico de linhas: ajusta índice pelo centro das colunas.
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    hover.setIdx(Math.max(0, Math.min(n - 1, Math.floor((px - PAD.l) / slot))));
  };

  return (
    <figure>
      <figcaption className="mb-1">
        <span className="block font-display text-lg font-bold uppercase">{title}</span>
        <span id={descId} className="block text-xs text-faint">
          {caption}
        </span>
      </figcaption>
      <Legend series={series} />
      <div className="relative">
        <svg
          ref={hover.ref}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-none outline-none"
          role="img"
          aria-label={`${title}. Use as setas para navegar pelas etapas.`}
          aria-describedby={descId}
          tabIndex={0}
          onPointerMove={onMove}
          onPointerLeave={() => hover.setIdx(null)}
          onKeyDown={hover.onKeyDown}
          onBlur={() => hover.setIdx(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - 16} y1={y(t)} y2={y(t)} stroke="var(--line)" />
              <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--text-faint)">
                {t}
              </text>
            </g>
          ))}
          {hover.idx !== null && <rect x={PAD.l + slot * hover.idx} y={PAD.t} width={slot} height={base - PAD.t} fill="var(--text)" opacity="0.05" />}
          {xLabels.map((l, i) => (i % labelEvery === 0 || i === n - 1 ? <AxisLabel key={`${l}-${i}`} x={cx(i)} label={l} /> : null))}
          {series.map((s, si) =>
            s.values.map((v, i) => {
              if (!v) return null;
              const left = cx(i) - (barW * series.length + gap * (series.length - 1)) / 2 + si * (barW + gap);
              const top = y(v);
              const r = Math.min(3, barW / 2, base - top);
              // Topo arredondado, base reta (ancorada no eixo).
              const d = `M${left},${base} V${top + r} Q${left},${top} ${left + r},${top} H${left + barW - r} Q${left + barW},${top} ${left + barW},${top + r} V${base} Z`;
              return <path key={`${s.id}-${i}`} d={d} fill={COLORS[s.slot]} />;
            }),
          )}
          <line x1={PAD.l} x2={W - 16} y1={base} y2={base} stroke="var(--line-strong)" />
        </svg>
        {hover.idx !== null && (
          <Tooltip
            idx={hover.idx}
            leftPct={(cx(hover.idx) / W) * 100}
            title={xTitles[hover.idx] ?? xLabels[hover.idx] ?? ""}
            subtitle={xDetails?.[hover.idx]}
            series={series}
            format={format}
          />
        )}
      </div>
      <DataTable series={series} xLabels={xLabels} xTitles={xTitles} xDetails={xDetails} format={format} />
    </figure>
  );
}
