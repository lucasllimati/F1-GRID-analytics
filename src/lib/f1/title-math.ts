import { seasonRounds, type EntityKind, type SeasonData } from "./compare";
import { gpName } from "./gp-names";
import { maxRemainingDriverPoints, maxRemainingTeamPoints, type PointsSystem } from "./points";
import type { RaceEvent, RaceResultRow } from "./types";

// Matemática do título: quem ainda pode ser campeão, quando o líder pode fechar e com quais
// resultados. Tudo é contagem exata de pontos (sem estimativa). Empate em pontos é decidido
// pelo número de vitórias; quando nem isso garante, tratamos como "ainda não fechou"
// (conservador — nunca anunciamos um título que ainda pode escapar).

export type TitleEntity = { id: string; name: string; points: number; wins: number };
export type RemainingEvent = { round: number; name: string; flag: string; date: string; sprint: boolean };

export type ContenderStatus = TitleEntity & {
  gap: number;
  maxPossible: number;
  alive: boolean;
  /** Pontos que precisa tirar do líder por corrida restante (só para quem não lidera). */
  perRace: number | null;
};

export type ClinchInfo = {
  /** Primeira etapa em que o líder pode ser campeão (melhor cenário: ele soma o máximo e os rivais nada). */
  event: RemainingEvent;
  isNext: boolean;
  /** Condições exatas para fechar na próxima etapa (só quando isNext). */
  conditions: string[];
  /** Se não fechar na próxima, a etapa seguinte e a vantagem necessária ao sair dela. */
  then: { event: RemainingEvent; leadNeeded: number } | null;
};

export type TitleStatus = {
  kind: EntityKind;
  remaining: RemainingEvent[];
  racesLeft: number;
  maxInPlay: number;
  contenders: ContenderStatus[];
  clinch: ClinchInfo | null;
  /** Já decidido: o líder não pode mais ser alcançado. */
  decided: boolean;
};

// ── Pontos possíveis por fim de semana ──────────────────────────────

function racePts(sys: PointsSystem, p: number): number {
  return sys.race[p - 1] ?? 0;
}

/** Máximo que UMA entidade soma num fim de semana. */
export function weekendMax(sys: PointsSystem, kind: EntityKind, sprint: boolean): number {
  // Mesma regra do modelo de probabilidade (points.ts): uma fonte única para "máximo em jogo".
  return kind === "driver" ? maxRemainingDriverPoints(sys, 1, sprint ? 1 : 0) : maxRemainingTeamPoints(sys, 1, sprint ? 1 : 0);
}

function sumMax(sys: PointsSystem, kind: EntityKind, events: RemainingEvent[]): number {
  return events.reduce((a, e) => a + weekendMax(sys, kind, e.sprint), 0);
}

/** Totais possíveis num fim de semana (sem o ponto de volta mais rápida — só existiu até 2024). */
function achievable(sys: PointsSystem, kind: EntityKind, sprint: boolean): number[] {
  const raceOpts = kind === "driver" ? [0, ...sys.race] : pairSums(sys.race);
  const sprintOpts = sprint ? (kind === "driver" ? [0, ...sys.sprint] : pairSums(sys.sprint)) : [0];
  const out = new Set<number>();
  for (const r of raceOpts) for (const s of sprintOpts) out.add(r + s);
  return [...out].sort((a, b) => b - a);
}

function pairSums(table: number[]): number[] {
  const t = [...table, 0, 0];
  const out = new Set<number>([0]);
  for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) out.add(t[i]! + t[j]!);
  return [...out];
}

// ── Regra de fechamento ─────────────────────────────────────────────

/** Líder garante o título contra este rival? Empate só conta se o líder tiver mais vitórias mesmo no pior caso. */
function secured(leadPts: number, rivalPts: number, maxAfter: number, leaderWins: number, rivalWinsWorst: number): boolean {
  const margin = leadPts - rivalPts;
  return margin > maxAfter || (margin === maxAfter && leaderWins > rivalWinsWorst);
}

const ord = (p: number) => `${p}º`;

/** Condições para o líder (piloto, fim de semana sem sprint) fechar na próxima corrida. */
function driverRaceConditions(sys: PointsSystem, leader: TitleEntity, rivals: TitleEntity[], maxAfter: number, racesAfter: number): string[] {
  const MAXPOS = 20;
  // Para cada posição do líder: a pior posição que cada rival precisa (null = sem restrição; "x" = impossível).
  const needFor = (p: number | null): (number | null)[] | "impossible" => {
    const lp = leader.points + (p === null ? 0 : racePts(sys, p));
    const lw = leader.wins + (p === 1 ? 1 : 0);
    const req: (number | null)[] = [];
    for (const r of rivals) {
      const ok = (q: number | null) => secured(lp, r.points + (q === null ? 0 : racePts(sys, q)), maxAfter, lw, r.wins + (q === 1 ? 1 : 0) + racesAfter);
      if (!ok(null)) return "impossible";
      let qMin: number | null = null;
      for (let q = MAXPOS; q >= 1; q--) {
        if (q === p) continue;
        if (ok(q)) qMin = q;
        else break;
      }
      const best = p === 1 ? 2 : 1;
      req.push(qMin !== null && qMin <= best ? null : (qMin ?? MAXPOS + 1));
    }
    return req;
  };
  const describe = (req: (number | null)[]) =>
    rivals
      .map((r, i) => {
        const q = req[i];
        if (q === null || q === undefined) return null;
        return q > sys.race.length ? `${r.name} fora dos pontos` : `${r.name} em ${ord(q)} ou pior`;
      })
      .filter(Boolean)
      .join(" e ");

  const positions: (number | null)[] = [...sys.race.map((_, i) => i + 1), null];
  let freeUpTo = 0;
  for (const p of positions) {
    if (p === null) break;
    const r = needFor(p);
    if (r !== "impossible" && r.every((x) => x === null)) freeUpTo = p;
    else break;
  }
  const lines: string[] = [];
  if (freeUpTo > 0) lines.push(freeUpTo === 1 ? "Se vencer." : `Se chegar em ${ord(freeUpTo)} ou melhor.`);

  // Posições piores, agrupadas em faixas com a mesma exigência sobre os rivais.
  const runs: { from: number | null; to: number | null; cond: string }[] = [];
  for (const p of positions.filter((x) => x === null || x > freeUpTo)) {
    const r = needFor(p);
    if (r === "impossible") break;
    const cond = describe(r);
    const last = runs.at(-1);
    if (last && last.cond === cond) last.to = p;
    else runs.push({ from: p, to: p, cond });
  }
  for (const run of runs.slice(0, 4 - lines.length)) {
    const where =
      run.from === null
        ? "se não pontuar"
        : run.to === null
          ? `se chegar em ${ord(run.from)} ou pior`
          : run.from === run.to
            ? `se chegar em ${ord(run.from)}`
            : `se chegar entre ${ord(run.from)} e ${ord(run.to)}`;
    const text = run.cond ? `${where}, com ${run.cond}` : where;
    lines.push(lines.length ? `Ou ${text}.` : `${text.charAt(0).toUpperCase()}${text.slice(1)}.`);
  }
  return lines;
}

/** Condições por pontos (equipes ou fim de semana com sprint). */
function pointsConditions(
  sys: PointsSystem,
  kind: EntityKind,
  sprint: boolean,
  leader: TitleEntity,
  rivals: TitleEntity[],
  maxAfter: number,
  racesAfter: number,
): string[] {
  const opts = achievable(sys, kind, sprint);
  const rivalOpts = opts;
  // Maior total possível SEM vencer a corrida: acima disso, a vitória é certa (conta no desempate).
  const noWinMax =
    kind === "driver"
      ? racePts(sys, 2) + (sprint ? (sys.sprint[0] ?? 0) : 0)
      : racePts(sys, 2) + racePts(sys, 3) + (sprint ? (sys.sprint[0] ?? 0) + (sys.sprint[1] ?? 0) : 0);
  const allowedFor = (v: number): (number | null)[] | "impossible" => {
    const out: (number | null)[] = [];
    for (const r of rivals) {
      // Desempate no pior caso: o rival vence esta corrida (se os pontos permitem) e todas as seguintes.
      const ok = (t: number) =>
        secured(leader.points + v, r.points + t, maxAfter, leader.wins + (v > noWinMax ? 1 : 0), r.wins + racesAfter + (t >= racePts(sys, 1) ? 1 : 0));
      if (!ok(0)) return "impossible";
      const maxT = rivalOpts.find((t) => ok(t)) ?? 0;
      out.push(maxT >= rivalOpts[0]! ? null : maxT);
    }
    return out;
  };
  const best = opts[0]!;
  const label = (v: number) => {
    if (kind === "team" && !sprint && v === racePts(sys, 1) + racePts(sys, 2)) return "fizer dobradinha";
    if (kind === "driver" && v === best) return sprint ? "vencer a sprint e a corrida" : "vencer";
    return `somar ${v} pts${sprint ? " no fim de semana" : ""}`;
  };
  const lines: string[] = [];
  // Menor total que garante sem depender dos rivais.
  const free = [...opts].reverse().find((v) => {
    const a = allowedFor(v);
    return a !== "impossible" && a.every((x) => x === null);
  });
  if (free !== undefined) lines.push(free === best ? `Se ${label(free)}.` : `Se somar ${free} pts ou mais${sprint ? " no fim de semana" : ""}.`);
  for (const v of opts.filter((x) => free === undefined || x < free)) {
    const a = allowedFor(v);
    if (a === "impossible") break;
    const cond = rivals
      .map((r, i) => (a[i] === null ? null : a[i] === 0 ? `${r.name} não pontuar` : `${r.name} somar no máximo ${a[i]} ${a[i] === 1 ? "pt" : "pts"}`))
      .filter(Boolean)
      .join(" e ");
    lines.push(`${lines.length ? "Ou se" : "Se"} ${label(v)}${cond ? ` e ${cond}` : ""}.`);
    if (lines.length >= 3) break;
  }
  return lines;
}

// ── Situação do título ──────────────────────────────────────────────

export function remainingEvents(events: RaceEvent[], data: SeasonData): RemainingEvent[] {
  const raceDone = new Set(data.races.map((r) => r.round));
  const sprintDone = new Set(data.sprints.map((r) => r.round));
  return events
    .filter((e) => !raceDone.has(e.round))
    .map((e) => ({
      round: e.round,
      name: gpName(e.name),
      flag: e.flag,
      date: e.sessions.find((s) => s.type === "race")?.date ?? "",
      sprint: e.format === "sprint" && !sprintDone.has(e.round),
    }));
}

export function titleStatus(opts: { kind: EntityKind; sys: PointsSystem; standings: TitleEntity[]; remaining: RemainingEvent[] }): TitleStatus {
  const { kind, sys, remaining } = opts;
  const rows = [...opts.standings].sort((a, b) => b.points - a.points || b.wins - a.wins);
  const maxInPlay = sumMax(sys, kind, remaining);
  const racesLeft = remaining.length;
  const leader = rows[0];
  const contenders: ContenderStatus[] = rows.map((r) => {
    const gap = (leader?.points ?? 0) - r.points;
    const maxPossible = r.points + maxInPlay;
    return {
      ...r,
      gap,
      maxPossible,
      alive: r === leader || maxPossible > (leader?.points ?? 0) || (maxPossible === leader?.points && r.wins + racesLeft > (leader?.wins ?? 0)),
      perRace: r === leader || racesLeft === 0 ? null : gap / racesLeft,
    };
  });
  const rivals = contenders.slice(1).filter((c) => c.alive);
  const decided = Boolean(leader) && rivals.length === 0;
  let clinch: ClinchInfo | null = null;

  if (leader && rivals.length > 0) {
    const strongest = rivals[0]!;
    let gained = 0;
    for (let k = 0; k < remaining.length; k++) {
      gained += weekendMax(sys, kind, remaining[k]!.sprint);
      const after = remaining.slice(k + 1);
      const maxAfter = sumMax(sys, kind, after);
      if (!secured(leader.points + gained, strongest.points, maxAfter, leader.wins + k + 1, strongest.wins + after.length)) continue;
      const isNext = k === 0;
      let conditions: string[] = [];
      let then: ClinchInfo["then"] = null;
      if (isNext) {
        const ev = remaining[0]!;
        conditions =
          kind === "driver" && !ev.sprint
            ? driverRaceConditions(sys, leader, rivals, maxAfter, after.length)
            : pointsConditions(sys, kind, ev.sprint, leader, rivals, maxAfter, after.length);
        if (after.length > 0) then = { event: after[0]!, leadNeeded: sumMax(sys, kind, after.slice(1)) };
      }
      clinch = { event: remaining[k]!, isNext, conditions, then };
      break;
    }
  }
  return { kind, remaining, racesLeft, maxInPlay, contenders, clinch, decided };
}

// ── Quem saiu da disputa, e quando ──────────────────────────────────

export type Elimination = { id: string; name: string; round: number; raceName: string };

/** Etapa em que cada um deixou de ter chance matemática (pelos pontos publicados até ali). */
export function eliminationTimeline(opts: { kind: EntityKind; sys: PointsSystem; data: SeasonData; events: RaceEvent[] }): Elimination[] {
  const { kind, sys, data, events } = opts;
  const idOf = (r: RaceResultRow) => (kind === "driver" ? r.driver.id : r.constructor.id);
  const nameOf = new Map<string, string>();
  const cum = new Map<string, number>();
  const raceBy = new Map(data.races.map((r) => [r.round, r]));
  const sprintBy = new Map(data.sprints.map((r) => [r.round, r]));
  const out: Elimination[] = [];
  const gone = new Set<string>();
  for (const { round, raceName } of seasonRounds(data)) {
    for (const r of [...(raceBy.get(round)?.rows ?? []), ...(sprintBy.get(round)?.rows ?? [])]) {
      const id = idOf(r);
      nameOf.set(id, kind === "driver" ? `${r.driver.givenName} ${r.driver.familyName}` : r.constructor.name);
      cum.set(id, (cum.get(id) ?? 0) + r.points);
    }
    if (!raceBy.has(round)) continue; // só avalia ao fim do fim de semana
    const after = events
      .filter((e) => e.round > round)
      .map((e) => ({ round: e.round, name: e.name, flag: e.flag, date: "", sprint: e.format === "sprint" }));
    const maxAfter = sumMax(sys, kind, after);
    const leaderPts = Math.max(...cum.values());
    for (const [id, pts] of cum) {
      if (gone.has(id)) continue;
      if (pts + maxAfter < leaderPts) {
        gone.add(id);
        out.push({ id, name: nameOf.get(id) ?? id, round, raceName: gpName(raceName) });
      }
    }
  }
  return out;
}
