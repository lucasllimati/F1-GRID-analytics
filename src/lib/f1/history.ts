import raw from "@/data/f1-history.json";
import { gpName } from "./gp-names";
import { driverName } from "./names";
import type { QualifyingRow, RaceResultRow, SessionResult } from "./types";

// Histórico da F1 desde 1950. Temporadas encerradas vêm de src/data/f1-history.json (gerado por
// scripts/build-history.mjs); a temporada em andamento é somada ao vivo, a partir dos resultados
// publicados. Ela conta nos números (vitórias, poles…), mas não nos títulos.

export type SeasonEntry = { pos: number | null; pts: number; wins: number; team?: string };

export type HistDriver = {
  id: string;
  name: string;
  nationality: string;
  starts: number;
  wins: number;
  podiums: number;
  poles: number;
  fastestLaps: number;
  titles: number;
  points: number;
  firstSeason: number | null;
  lastSeason: number | null;
  seasons: Record<string, SeasonEntry>;
};

export type HistTeam = Omit<HistDriver, "fastestLaps" | "points">;

export type HistSeason = {
  season: number;
  races: number;
  champion: { id: string; name: string; team: string; points: number; wins: number } | null;
  runnerUp: { id: string; name: string; points: number } | null;
  teamChampion: { id: string; name: string; points: number } | null;
};

export type HistRace = {
  season: number;
  round: number;
  name: string;
  date: string;
  circuit: string;
  country: string;
  winner: { id: string; name: string; team: string } | null;
  pole: { id: string; name: string } | null;
};

export type History = {
  generatedAt: string;
  firstSeason: number;
  lastSeason: number;
  notes: { poles: string; fastestLaps: string };
  seasons: HistSeason[];
  races: HistRace[];
  drivers: HistDriver[];
  teams: HistTeam[];
};

export const HISTORY = raw as unknown as History;

export type LiveSeason = {
  season: number;
  races: SessionResult<RaceResultRow>[];
  qualis: SessionResult<QualifyingRow>[];
};

export type Combined = History & { liveSeason: number | null; activeDrivers: Set<string>; activeTeams: Set<string> };

/** Soma a temporada em andamento ao histórico (sem títulos). Não altera o objeto original. */
export function combineHistory(h: History, live: LiveSeason | null): Combined {
  const drivers = new Map(h.drivers.map((d) => [d.id, { ...d, seasons: { ...d.seasons } }]));
  const teams = new Map(h.teams.map((t) => [t.id, { ...t, seasons: { ...t.seasons } }]));
  const races = [...h.races];
  const activeDrivers = new Set<string>();
  const activeTeams = new Set<string>();
  if (live && live.season > h.lastSeason) {
    const qualiBy = new Map(live.qualis.map((q) => [q.round, q.rows.find((r) => r.position === 1)]));
    for (const race of live.races) {
      const startedDrivers = new Set<string>();
      const startedTeams = new Set<string>();
      for (const r of race.rows) {
        const d =
          drivers.get(r.driver.id) ??
          ({ id: r.driver.id, name: driverName(r.driver), nationality: r.driver.nationality, starts: 0, wins: 0, podiums: 0, poles: 0, fastestLaps: 0, titles: 0, points: 0, firstSeason: live.season, lastSeason: live.season, seasons: {} } as HistDriver);
        const t =
          teams.get(r.constructor.id) ??
          ({ id: r.constructor.id, name: r.constructor.name, nationality: r.constructor.nationality, starts: 0, wins: 0, podiums: 0, poles: 0, titles: 0, firstSeason: live.season, lastSeason: live.season, seasons: {} } as HistTeam);
        drivers.set(d.id, d);
        teams.set(t.id, t);
        activeDrivers.add(d.id);
        activeTeams.add(t.id);
        d.lastSeason = live.season;
        t.lastSeason = live.season;
        if (!["did_not_start", "did_not_qualify", "withdrawn"].includes(r.outcome) && !startedDrivers.has(d.id)) {
          d.starts++;
          startedDrivers.add(d.id);
          if (!startedTeams.has(t.id)) {
            t.starts++;
            startedTeams.add(t.id);
          }
        }
        if (r.position === 1) {
          d.wins++;
          t.wins++;
        }
        if (r.position !== null && r.position <= 3) {
          d.podiums++;
          t.podiums++;
        }
        if (r.fastestLapRank === 1) d.fastestLaps++;
        d.points += r.points;
      }
      // Mesma regra do histórico: pole oficial = quem larga em 1º; sem ninguém em 1º, o mais rápido da classificação.
      const poleRow = race.rows.find((r) => r.grid === 1) ?? qualiBy.get(race.round) ?? null;
      // O pole pode não constar na corrida (retirado antes da largada): conta só se o conhecemos.
      if (poleRow) {
        const pd = drivers.get(poleRow.driver.id);
        const pt = teams.get(poleRow.constructor.id);
        if (pd) pd.poles++;
        if (pt) pt.poles++;
      }
      const w = race.rows.find((r) => r.position === 1);
      races.push({
        season: live.season,
        round: race.round,
        name: race.raceName,
        date: "",
        circuit: "",
        country: "",
        winner: w ? { id: w.driver.id, name: driverName(w.driver), team: w.constructor.name } : null,
        pole: poleRow ? { id: poleRow.driver.id, name: driverName(poleRow.driver) } : null,
      });
    }
  }
  return { ...h, races, drivers: [...drivers.values()], teams: [...teams.values()], liveSeason: live?.season ?? null, activeDrivers, activeTeams };
}

// ── Rankings ───────────────────────────────────────────────────────

export type RankRow = { rank: number; id: string; name: string; nationality: string; value: number; active: boolean };

/** Top N com empates (mesma posição para valores iguais); avisa quantos empatados ficaram de fora. */
export function ranking<T extends { id: string; name: string; nationality: string }>(
  items: T[],
  value: (x: T) => number,
  active: Set<string>,
  n = 10,
): { rows: RankRow[]; moreTied: { count: number; value: number; names: string[] } | null } {
  const sorted = items
    .map((x) => ({ id: x.id, name: x.name, nationality: x.nationality, value: value(x), active: active.has(x.id) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  const rows: RankRow[] = [];
  let rank = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0 || sorted[i]!.value !== sorted[i - 1]!.value) rank = i + 1;
    if (i >= n) break;
    rows.push({ ...sorted[i]!, rank });
  }
  // Empatados com o último exibido que não couberam.
  const lastVal = rows.at(-1)?.value;
  const extra = lastVal !== undefined ? sorted.slice(rows.length).filter((x) => x.value === lastVal) : [];
  // Se o empate começa no último lugar e há muitos, mostramos só o resumo.
  return { rows, moreTied: extra.length ? { count: extra.length, value: lastVal!, names: extra.slice(0, 3).map((x) => x.name) } : null };
}

// ── Recordes em jogo ───────────────────────────────────────────────

export type RecordChase = { metric: string; chaser: string; chaserId: string; need: number; target: string; targetValue: number; equal: boolean };

/**
 * Para cada métrica, o piloto em atividade mais bem colocado que está perto de passar quem está
 * logo acima dele no ranking histórico (até `within` de distância).
 */
export function recordChases(drivers: HistDriver[], active: Set<string>): RecordChase[] {
  const metrics: { key: keyof HistDriver; label: string; within: number }[] = [
    { key: "titles", label: "Títulos", within: 1 },
    { key: "wins", label: "Vitórias", within: 3 },
    { key: "poles", label: "Poles", within: 3 },
    { key: "podiums", label: "Pódios", within: 3 },
    { key: "starts", label: "Corridas", within: 3 },
  ];
  const out: RecordChase[] = [];
  for (const m of metrics) {
    const v = (d: HistDriver) => d[m.key] as number;
    const sorted = [...drivers].filter((d) => v(d) > 0).sort((a, b) => v(b) - v(a));
    for (let i = 0; i < sorted.length && i < 30; i++) {
      const d = sorted[i]!;
      if (!active.has(d.id)) continue;
      // Primeiro piloto acima com valor estritamente maior.
      const above = sorted.slice(0, i).reverse().find((x) => v(x) > v(d));
      if (!above) continue;
      const need = v(above) - v(d) + 1;
      if (need > m.within + 1) continue;
      out.push({ metric: m.label, chaser: d.name, chaserId: d.id, need, target: above.name, targetValue: v(above), equal: false });
      break;
    }
  }
  return out;
}

// ── Neste dia ──────────────────────────────────────────────────────

export type OnThisDay = { years: number; race: HistRace; label: string };

/** Corridas disputadas neste dia (mês e dia) em anos anteriores, da mais recente para a mais antiga. */
export function onThisDay(h: History, today: Date): OnThisDay[] {
  const md = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", month: "2-digit", day: "2-digit" }).format(today);
  const year = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric" }).format(today));
  return h.races
    .filter((r) => r.date && r.date.slice(5) === md && r.season < year)
    .sort((a, b) => b.season - a.season)
    .map((race) => {
      const champ = h.seasons.find((s) => s.season === race.season)?.champion;
      const decided = champ && race.round === (h.seasons.find((s) => s.season === race.season)?.races ?? -1) ? ` — última etapa do ano, com ${champ.name} campeão` : "";
      return {
        years: year - race.season,
        race,
        label: race.winner ? `${race.winner.name} venceu o ${gpName(race.name)} (${race.winner.team})${decided}.` : `${gpName(race.name)}.`,
      };
    });
}
