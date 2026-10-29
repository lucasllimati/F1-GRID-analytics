import { championshipPositions, seasonRounds, type EntityKind, type SeasonData } from "./compare";
import { driverName } from "./names";
import { fallbackLabel, type RoundLabel } from "./round-labels";
import { OUTCOME_LABEL, type RaceEvent, type RaceResultRow, type ResultOutcome } from "./types";

// Tabela "etapa por etapa": uma linha por piloto (ou equipe) e uma coluna por GP da temporada,
// com os pontos do fim de semana e a posição na corrida. Tudo vem de resultados publicados;
// etapas futuras aparecem como colunas vazias.

export type GridColumn = {
  round: number;
  code: string;
  flag: string;
  title: string;
  detail: string;
  sprint: boolean;
  /** Corrida ou sprint com resultado publicado. */
  done: boolean;
};

/** Faixa de desempenho da célula (cor de fundo); a posição sempre aparece também em texto. */
export type CellTier = "win" | "p2" | "p3" | "points" | "zero" | "dnf";

export type GridCell = {
  points: number;
  /** Posição na corrida (equipe: melhor carro); null = não classificado ou corrida ainda sem resultado. */
  racePos: number | null;
  sprintPos: number | null;
  sprintPoints: number;
  outcome: ResultOutcome | null;
  tier: CellTier;
  /** Texto do tooltip/leitor de tela. */
  label: string;
};

export type GridRow = {
  id: string;
  name: string;
  /** Piloto: equipe. Equipe: pilotos (os dois que mais pontuaram, "+N" se houve mais). */
  subtitle: string;
  teamId: string;
  nationality: string;
  position: number;
  points: number;
  gapToLeader: number;
  /** Ganho (+) ou perda (−) de posições no campeonato em relação à etapa anterior. */
  delta: number;
  /** Uma por coluna; null = não participou ou etapa futura. */
  cells: (GridCell | null)[];
};

export type SeasonGrid = { columns: GridColumn[]; rows: GridRow[] };

const FINISHED: ResultOutcome[] = ["finished", "lapped"];

function tierOf(pos: number | null, points: number, outcomes: ResultOutcome[]): CellTier {
  if (pos === 1) return "win";
  if (pos === 2) return "p2";
  if (pos === 3) return "p3";
  if (points > 0) return "points";
  if (pos === null && outcomes.length > 0 && !outcomes.some((o) => FINISHED.includes(o))) return "dnf";
  return "zero";
}

function cellLabel(title: string, rRows: RaceResultRow[], sRows: RaceResultRow[], points: number): string {
  const one = (r: RaceResultRow) => (r.position !== null ? `${r.position}º` : OUTCOME_LABEL[r.outcome]);
  const parts: string[] = [title];
  if (rRows.length) parts.push(`Corrida: ${rRows.map(one).join(" e ")}`);
  if (sRows.length) parts.push(`Sprint: ${sRows.map(one).join(" e ")}`);
  parts.push(`${points} pts`);
  return parts.join(" · ");
}

type Official = Map<string, { position: number | null; points: number }>;

export function buildSeasonGrid(opts: {
  data: SeasonData;
  kind: EntityKind;
  events: RaceEvent[];
  labels: Map<number, RoundLabel>;
  /** Classificação oficial (ordem e pontos), quando disponível: prevalece sobre a soma dos resultados. */
  official?: Official;
}): SeasonGrid {
  const { data, kind, events, labels, official } = opts;
  const published = seasonRounds(data);
  const publishedBy = new Map(published.map((r) => [r.round, r]));
  const roundList = events.length
    ? events.map((e) => ({ round: e.round, sprint: e.format === "sprint", raceName: e.name }))
    : published.map((r) => ({ round: r.round, sprint: r.hasSprint, raceName: r.raceName }));

  const columns: GridColumn[] = roundList.map((r) => {
    const l = labels.get(r.round) ?? fallbackLabel(r.round, r.raceName);
    const p = publishedBy.get(r.round);
    return { round: r.round, code: l.code, flag: l.flag, title: l.title, detail: l.detail, sprint: r.sprint, done: Boolean(p && (p.hasRace || p.hasSprint)) };
  });

  const raceBy = new Map(data.races.map((r) => [r.round, r.rows]));
  const sprintBy = new Map(data.sprints.map((r) => [r.round, r.rows]));
  const idOf = (r: RaceResultRow) => (kind === "driver" ? r.driver.id : r.constructor.id);

  // Entidades: todos que aparecem em algum resultado.
  type Acc = { id: string; name: string; teamId: string; nationality: string; points: number; driverPts: Map<string, { name: string; pts: number }> };
  const acc = new Map<string, Acc>();
  for (const rows of [...data.races.map((r) => r.rows), ...data.sprints.map((r) => r.rows)]) {
    for (const r of rows) {
      const id = idOf(r);
      const cur = acc.get(id) ?? {
        id,
        name: kind === "driver" ? driverName(r.driver) : r.constructor.name,
        teamId: r.constructor.id,
        nationality: kind === "driver" ? r.driver.nationality : r.constructor.nationality,
        points: 0,
        driverPts: new Map(),
      };
      cur.points += r.points;
      if (kind === "driver") cur.teamId = r.constructor.id;
      const d = cur.driverPts.get(r.driver.id) ?? { name: r.driver.familyName, pts: 0 };
      d.pts += r.points;
      cur.driverPts.set(r.driver.id, d);
      acc.set(id, cur);
    }
  }
  const teamName = new Map<string, string>();
  for (const rows of data.races.map((r) => r.rows)) for (const r of rows) teamName.set(r.constructor.id, r.constructor.name);

  const champ = championshipPositions(data, kind);
  const doneRounds = published.map((r) => r.round);
  const last = champ.get(doneRounds.at(-1) ?? -1);
  const prev = champ.get(doneRounds.at(-2) ?? -1);

  const rows: GridRow[] = [...acc.values()].map((e) => {
    const off = official?.get(e.id);
    const cells = columns.map((c) => {
      const rRows = (raceBy.get(c.round) ?? []).filter((r) => idOf(r) === e.id);
      const sRows = (sprintBy.get(c.round) ?? []).filter((r) => idOf(r) === e.id);
      if (!rRows.length && !sRows.length) return null;
      const racePts = rRows.reduce((a, r) => a + r.points, 0);
      const sprintPts = sRows.reduce((a, r) => a + r.points, 0);
      const positions = rRows.map((r) => r.position).filter((p): p is number => p !== null);
      const racePos = positions.length ? Math.min(...positions) : null;
      const sp = sRows.map((r) => r.position).filter((p): p is number => p !== null);
      const points = racePts + sprintPts;
      return {
        points,
        racePos,
        sprintPos: sp.length ? Math.min(...sp) : null,
        sprintPoints: sprintPts,
        outcome: rRows[0]?.outcome ?? null,
        tier: rRows.length ? tierOf(racePos, points, rRows.map((r) => r.outcome)) : points > 0 ? "points" : "zero",
        label: cellLabel(c.title, rRows, sRows, points),
      } satisfies GridCell;
    });
    const drivers = [...e.driverPts.values()].sort((a, b) => b.pts - a.pts);
    const subtitle =
      kind === "driver"
        ? (teamName.get(e.teamId) ?? "")
        : drivers.slice(0, 2).map((d) => d.name).join(", ") + (drivers.length > 2 ? ` +${drivers.length - 2}` : "");
    const pos = last?.get(e.id) ?? 99;
    const before = prev?.get(e.id);
    return {
      id: e.id,
      name: e.name,
      subtitle,
      teamId: e.teamId,
      nationality: e.nationality,
      position: off?.position ?? pos,
      points: off?.points ?? e.points,
      gapToLeader: 0,
      delta: before !== undefined && last ? before - pos : 0,
      cells,
    };
  });
  rows.sort((a, b) => a.position - b.position || b.points - a.points || a.name.localeCompare(b.name));
  const leader = rows[0]?.points ?? 0;
  for (const r of rows) r.gapToLeader = leader - r.points;
  return { columns, rows };
}
