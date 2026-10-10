// Representação visual do grid em duas colunas (posições ímpares à esquerda, pares à direita, escalonadas).
// O número de slots é exatamente o número de carros recebidos — nunca assumimos 20 ou 22.

export type GridSlot = { position: number; label: string; team: string; number: string | null; note?: string };

export function StartingGrid({ slots, pitLane }: { slots: GridSlot[]; pitLane: GridSlot[] }) {
  const sorted = [...slots].sort((a, b) => a.position - b.position);
  return (
    <div>
      <ol className="grid grid-cols-2 gap-x-6 gap-y-2 sm:gap-x-10" aria-label="Grid de largada">
        {sorted.map((s) => (
          <li
            key={s.position}
            className={`relative rounded border-l-4 border-accent bg-elev-2 px-3 py-2 ${s.position % 2 === 0 ? "translate-y-6" : ""}`}
          >
            <span className="font-display text-2xl font-extrabold italic tabular text-faint">P{s.position}</span>
            <span className="ml-2 font-semibold">{s.label}</span>
            <span className="block text-xs text-muted">
              {s.number ? `#${s.number} · ` : ""}
              {s.team}
              {s.note ? ` · ${s.note}` : ""}
            </span>
          </li>
        ))}
      </ol>
      {pitLane.length > 0 && (
        <div className="mt-10">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Largada do pit lane</h4>
          <ul className="flex flex-wrap gap-2">
            {pitLane.map((s) => (
              <li key={s.label} className="rounded bg-elev-2 px-3 py-1.5 text-sm">
                {s.label} <span className="text-xs text-muted">{s.team}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
