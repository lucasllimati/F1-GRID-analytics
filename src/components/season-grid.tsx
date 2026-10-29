import Link from "next/link";
import { nationalityFlag } from "@/lib/f1/nationality";
import type { GridCell, SeasonGrid } from "@/lib/f1/season-grid";
import type { ResultOutcome } from "@/lib/f1/types";
import { teamColor } from "@/lib/f1/team-colors";

// Tabela etapa por etapa (servidor, sem JavaScript no cliente). Colunas fixas à esquerda
// (posição, nome, pontos) e rolagem horizontal pelas etapas. Cor da célula = faixa de
// resultado; o número sempre aparece, então a cor nunca é a única informação.

export type GridMode = "points" | "position";

/** Sigla quando não há posição classificada na corrida. */
const OUTCOME_SHORT: Record<ResultOutcome, string> = {
  finished: "—",
  lapped: "—",
  retired: "AB",
  disqualified: "DSQ",
  excluded: "EXC",
  withdrawn: "RET",
  not_classified: "NC",
  did_not_start: "NL",
  did_not_qualify: "NQ",
};

function CellContent({ c, mode }: { c: GridCell; mode: GridMode }) {
  const pos = c.racePos !== null ? String(c.racePos) : c.outcome ? OUTCOME_SHORT[c.outcome] : "";
  if (mode === "position") {
    return (
      <>
        <span className="font-semibold">{pos || (c.sprintPos !== null ? `S${c.sprintPos}` : "—")}</span>
        {c.points > 0 && <sub className="sg-sub">{c.points}</sub>}
      </>
    );
  }
  return (
    <>
      <span className="font-semibold">{c.points}</span>
      {pos && <sub className="sg-sub">{pos}</sub>}
    </>
  );
}

export function SeasonGridTable({
  grid,
  kind,
  mode,
  caption,
  entityHref,
}: {
  grid: SeasonGrid;
  kind: "driver" | "team";
  mode: GridMode;
  caption: string;
  entityHref?: (id: string) => string;
}) {
  return (
    <div className="sg-wrap overflow-x-auto rounded-md border border-line bg-elev">
      <table className="sg-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="sg-sticky sg-c0">
              Pos
            </th>
            <th scope="col" className="sg-sticky sg-c1">
              {kind === "driver" ? "Piloto" : "Equipe"}
            </th>
            <th scope="col" className="sg-sticky sg-c2 text-right">
              Pts
            </th>
            {grid.columns.map((c) => (
              <th key={c.round} scope="col" className="sg-col" title={[c.title, c.detail].filter(Boolean).join(" · ")}>
                <span className="block text-base leading-none" aria-hidden="true">
                  {c.flag}
                </span>
                <span className="mt-1 block">
                  {c.code}
                  {c.sprint && (
                    <span className="sg-sprint" title="Fim de semana com sprint">
                      S
                    </span>
                  )}
                </span>
                <span className="sr-only">{c.title}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((r) => (
            <tr key={r.id}>
              <td className="sg-sticky sg-c0 text-center">
                <span className="block font-display text-lg font-bold tabular">{r.position < 99 ? r.position : "—"}</span>
                {r.delta !== 0 && (
                  <span className={`block text-[0.65rem] font-semibold ${r.delta > 0 ? "text-ok" : "text-accent"}`}>
                    <span aria-hidden="true">{r.delta > 0 ? "▲" : "▼"}</span>
                    <span className="sr-only">{r.delta > 0 ? "subiu" : "caiu"}</span>
                    {Math.abs(r.delta)}
                  </span>
                )}
              </td>
              <th scope="row" className="sg-sticky sg-c1 text-left font-normal">
                <span className="flex items-center gap-2">
                  <span className="h-8 w-[3px] shrink-0 rounded-full" style={{ background: teamColor(r.teamId) }} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {kind === "driver" && nationalityFlag(r.nationality) && (
                        <span className="mr-1" aria-hidden="true">
                          {nationalityFlag(r.nationality)}
                        </span>
                      )}
                      {entityHref ? (
                        <Link href={entityHref(r.id)} className="underline-offset-2 hover:underline">
                          {r.name}
                        </Link>
                      ) : (
                        r.name
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted">{r.subtitle}</span>
                  </span>
                </span>
              </th>
              <td className="sg-sticky sg-c2 text-right">
                <span className="block font-display text-lg font-bold tabular">{r.points}</span>
                {r.gapToLeader > 0 && <span className="block text-[0.65rem] text-faint tabular">−{r.gapToLeader}</span>}
              </td>
              {r.cells.map((c, i) => {
                const col = grid.columns[i]!;
                if (!c)
                  return (
                    <td key={col.round} className="sg-cell" aria-label={col.done ? `${col.title}: não participou` : `${col.title}: ainda não disputada`}>
                      <span className="text-faint">{col.done ? "–" : ""}</span>
                    </td>
                  );
                return (
                  <td key={col.round} className={`sg-cell sg-${c.tier}`} title={c.label}>
                    <span className="sr-only">{c.label}</span>
                    <span aria-hidden="true">
                      <CellContent c={c} mode={mode} />
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Legenda das cores e abreviações. */
export function SeasonGridLegend({ mode }: { mode: GridMode }) {
  return (
    <details className="mb-3 text-sm text-muted">
      <summary className="cursor-pointer text-xs font-semibold text-fg">Como ler a tabela</summary>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        <li>
          {mode === "points" ? "Número grande = pontos do fim de semana (corrida + sprint); pequeno = posição na corrida." : "Número grande = posição na corrida; pequeno = pontos do fim de semana."}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="sg-swatch sg-win" /> vitória
        </li>
        <li className="flex items-center gap-1.5">
          <span className="sg-swatch sg-p2" /> 2º
        </li>
        <li className="flex items-center gap-1.5">
          <span className="sg-swatch sg-p3" /> 3º
        </li>
        <li className="flex items-center gap-1.5">
          <span className="sg-swatch sg-points" /> pontuou
        </li>
        <li>
          AB = abandono · NL = não largou · DSQ = desclassificado · NC = não classificado · – = não participou · S = fim de semana com sprint
          · ▲▼ = posições ganhas/perdidas na última etapa
        </li>
      </ul>
    </details>
  );
}
