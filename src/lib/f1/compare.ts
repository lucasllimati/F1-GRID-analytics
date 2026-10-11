import { driverName } from "./names";
import { compareCountback } from "./points";
import type { QualifyingRow, RaceResultRow, ResultOutcome, SessionResult } from "./types";

// Análise comparativa de pilotos e equipes ao longo de uma temporada.
// Tudo é derivado de resultados OFICIAIS publicados (corrida, sprint, classificação);
// nada é estimado. Regras de cada métrica documentadas em /methodology.

export type EntityKind = "driver" | "team";

export type RoundStat = {
  round: number;
  raceName: string;
  /** Posição classificada na corrida (equipe: melhor carro). null = não classificado / não participou. */
  racePos: number | null;
  raceOutcome: ResultOutcome | null;
  sprintPos: number | null;
  /** Posição na classificação (equipe: melhor carro). */
  qualiPos: number | null;
  /** Posição de largada efetiva (equipe: melhor carro). */
  grid: number | null;
  /** Pontos da etapa (corrida + sprint). */
  points: number;
  racePoints: number;
  sprintPoints: number;
  /** Pontos acumulados na temporada após a etapa. */
  cumulative: number;
  /** Posição no campeonato após a etapa, recalculada a partir dos resultados publicados. */
  champPos: number | null;
  participated: boolean;
};

export type Summary = {
  starts: number;
  points: number;
  wins: number;
  podiums: number;
  top10: number;
  poles: number;
  q3: number;
  dnfs: number;
  fastestLaps: number;
  sprintPoints: number;
  sprintWins: number;
  avgFinish: number | null;
  avgQuali: number | null;
  bestFinish: number | null;
  /** Posições ganhas da largada à chegada (só provas em que terminou classificado). */
  positionsGained: number;
  /** Equipes: provas com os dois carros no top 10. */
  doublePoints?: number;
  /** Pontos nas últimas 5 etapas disputadas. */
  formLast5: number;
  /** Média de pontos por etapa nas últimas 5 vs. no restante da temporada. */
  trend: { recentAvg: number; earlierAvg: number | null; direction: "alta" | "estavel" | "queda" | "indefinida" };
};

export type EntityAnalysis = { id: string; name: string; subtitle: string; rounds: RoundStat[]; summary: Summary };

export type HeadToHead = {
  a: string;
  b: string;
  raceAhead: [number, number];
  raceComparable: number;
  qualiAhead: [number, number];
  qualiComparable: number;
  sprintAhead: [number, number];
  pointsDiff: number;
};

export type SeasonData = {
  races: SessionResult<RaceResultRow>[];
  sprints: SessionResult<RaceResultRow>[];
  qualis: SessionResult<QualifyingRow>[];
};

const FINISHED: ResultOutcome[] = ["finished", "lapped"];
const NOT_STARTED: ResultOutcome[] = ["did_not_start", "did_not_qualify", "withdrawn"];

function idOf(kind: EntityKind, row: { driver: { id: string }; constructor: { id: string } }) {
  return kind === "driver" ? row.driver.id : row.constructor.id;
}

function minOrNull(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x !== null);
  return v.length ? Math.min(...v) : null;
}

function avg(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export type SeasonRound = { round: number; raceName: string; hasRace: boolean; hasSprint: boolean; hasQuali: boolean };

/**
 * Etapas com QUALQUER resultado publicado (corrida, sprint ou classificação).
 * Importante durante um fim de semana em andamento: a sprint e a classificação
 * saem antes da corrida e já contam pontos/posições.
 */
export function seasonRounds(data: SeasonData): SeasonRound[] {
  const map = new Map<number, SeasonRound>();
  const add = (s: { round: number; raceName: string }, key: "hasRace" | "hasSprint" | "hasQuali") => {
    const cur = map.get(s.round) ?? { round: s.round, raceName: s.raceName, hasRace: false, hasSprint: false, hasQuali: false };
    cur[key] = true;
    map.set(s.round, cur);
  };
  data.races.forEach((r) => add(r, "hasRace"));
  data.sprints.forEach((r) => add(r, "hasSprint"));
  data.qualis.forEach((r) => add(r, "hasQuali"));
  return [...map.values()].sort((a, b) => a.round - b.round);
}

/** Lista de entidades da temporada (para o seletor), ordenada pelos pontos dos resultados publicados. */
export function seasonEntities(data: SeasonData, kind: EntityKind): { id: string; name: string; subtitle: string; points: number }[] {
  const map = new Map<string, { id: string; name: string; subtitle: string; points: number }>();
  for (const s of [...data.races, ...data.sprints]) {
    for (const r of s.rows) {
      const id = idOf(kind, r);
      const cur = map.get(id) ?? {
        id,
        name: kind === "driver" ? driverName(r.driver) : r.constructor.name,
        subtitle: kind === "driver" ? r.constructor.name : "",
        points: 0,
      };
      cur.points += r.points;
      if (kind === "driver") cur.subtitle = r.constructor.name; // equipe mais recente
      map.set(id, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

/** Posição no campeonato de TODOS após cada etapa (para não depender de N chamadas à API). */
export function championshipPositions(data: SeasonData, kind: EntityKind): Map<number, Map<string, number>> {
  const rounds = seasonRounds(data).map((r) => r.round);
  const sprintBy = new Map(data.sprints.map((s) => [s.round, s]));
  const raceBy = new Map(data.races.map((r) => [r.round, r]));
  const pts = new Map<string, number>();
  // Contagem de posições em corridas principais (countback oficial: vitórias, 2º lugares, 3º…).
  const finishes = new Map<string, number[]>();
  const out = new Map<number, Map<string, number>>();
  for (const round of rounds) {
    for (const r of [...(raceBy.get(round)?.rows ?? []), ...(sprintBy.get(round)?.rows ?? [])]) {
      const id = idOf(kind, r);
      pts.set(id, (pts.get(id) ?? 0) + r.points);
    }
    for (const r of raceBy.get(round)?.rows ?? []) {
      if (r.position === null) continue;
      const id = idOf(kind, r);
      const arr = finishes.get(id) ?? [];
      arr[r.position - 1] = (arr[r.position - 1] ?? 0) + 1;
      finishes.set(id, arr);
    }
    const order = [...pts.entries()].sort((x, y) => y[1] - x[1] || compareCountback(finishes.get(x[0]) ?? [], finishes.get(y[0]) ?? []));
    out.set(round, new Map(order.map(([id], i) => [id, i + 1])));
  }
  return out;
}

export function analyzeEntity(data: SeasonData, kind: EntityKind, id: string, champ = championshipPositions(data, kind)): EntityAnalysis | null {
  const rounds = seasonRounds(data);
  const sprintBy = new Map(data.sprints.map((s) => [s.round, s]));
  const qualiBy = new Map(data.qualis.map((q) => [q.round, q]));
  const raceBy = new Map(data.races.map((r) => [r.round, r]));

  let name = "";
  let subtitle = "";
  let cumulative = 0;
  const stats: RoundStat[] = [];
  const s: Summary = {
    starts: 0, points: 0, wins: 0, podiums: 0, top10: 0, poles: 0, q3: 0, dnfs: 0, fastestLaps: 0,
    sprintPoints: 0, sprintWins: 0, avgFinish: null, avgQuali: null, bestFinish: null, positionsGained: 0,
    formLast5: 0, trend: { recentAvg: 0, earlierAvg: null, direction: "indefinida" },
  };
  if (kind === "team") s.doublePoints = 0;
  const finishes: number[] = [];
  const qualiPositions: number[] = [];

  for (const { round, raceName } of rounds) {
    const rRows = (raceBy.get(round)?.rows ?? []).filter((r) => idOf(kind, r) === id);
    const sRows = (sprintBy.get(round)?.rows ?? []).filter((r) => idOf(kind, r) === id);
    const qRows = (qualiBy.get(round)?.rows ?? []).filter((r) => idOf(kind, r) === id);
    const participated = rRows.length > 0 || sRows.length > 0 || qRows.length > 0;
    const first = rRows[0] ?? sRows[0] ?? qRows[0];
    if (first) {
      name = kind === "driver" ? driverName(first.driver) : first.constructor.name;
      subtitle = kind === "driver" ? first.constructor.name : "";
    }
    const racePoints = rRows.reduce((a, r) => a + r.points, 0);
    const sprintPoints = sRows.reduce((a, r) => a + r.points, 0);
    cumulative += racePoints + sprintPoints;

    const racePos = minOrNull(rRows.map((r) => r.position));
    const best = rRows.find((r) => r.position === racePos) ?? rRows[0];
    stats.push({
      round,
      raceName,
      racePos,
      raceOutcome: best?.outcome ?? null,
      sprintPos: minOrNull(sRows.map((r) => r.position)),
      qualiPos: minOrNull(qRows.map((r) => r.position)),
      grid: minOrNull(rRows.map((r) => r.grid)),
      points: racePoints + sprintPoints,
      racePoints,
      sprintPoints,
      cumulative,
      champPos: participated || cumulative > 0 ? (champ.get(round)?.get(id) ?? null) : null,
      participated,
    });

    // Resumo (por carro, para pilotos; agregado, para equipes)
    for (const r of rRows) {
      if (NOT_STARTED.includes(r.outcome)) continue;
      s.starts++;
      if (r.position === 1) s.wins++;
      if (r.position !== null && r.position <= 3) s.podiums++;
      if (r.position !== null && r.position <= 10) s.top10++;
      if (!FINISHED.includes(r.outcome)) s.dnfs++;
      if (r.fastestLapRank === 1) s.fastestLaps++;
      if (FINISHED.includes(r.outcome) && r.position !== null) {
        finishes.push(r.position);
        if (r.grid !== null) s.positionsGained += r.grid - r.position;
      }
    }
    if (kind === "team" && rRows.filter((r) => r.position !== null && r.position <= 10).length >= 2) s.doublePoints!++;
    for (const q of qRows) {
      if (q.position === 1) s.poles++;
      if (q.q3) s.q3++;
      if (q.position !== null) qualiPositions.push(q.position);
    }
    for (const r of sRows) if (r.position === 1) s.sprintWins++;
    s.points += racePoints + sprintPoints;
    s.sprintPoints += sprintPoints;
  }
  if (!name) return null;

  s.avgFinish = avg(finishes);
  s.avgQuali = avg(qualiPositions);
  s.bestFinish = finishes.length ? Math.min(...finishes) : null;

  const played = stats.filter((r) => r.participated);
  const last5 = played.slice(-5);
  const earlier = played.slice(0, -5);
  s.formLast5 = last5.reduce((a, r) => a + r.points, 0);
  const recentAvg = last5.length ? s.formLast5 / last5.length : 0;
  const earlierAvg = earlier.length >= 3 ? earlier.reduce((a, r) => a + r.points, 0) / earlier.length : null;
  let direction: Summary["trend"]["direction"] = "indefinida";
  if (earlierAvg !== null && last5.length >= 3) {
    // Faixa de ±15% (mínimo 1 ponto) para não chamar ruído de tendência.
    const band = Math.max(1, earlierAvg * 0.15);
    direction = recentAvg > earlierAvg + band ? "alta" : recentAvg < earlierAvg - band ? "queda" : "estavel";
  }
  s.trend = { recentAvg, earlierAvg, direction };

  return { id, name, subtitle, rounds: stats, summary: s };
}

/** Confronto direto entre duas entidades nas mesmas etapas. */
export function headToHead(a: EntityAnalysis, b: EntityAnalysis): HeadToHead {
  const h: HeadToHead = {
    a: a.id,
    b: b.id,
    raceAhead: [0, 0],
    raceComparable: 0,
    qualiAhead: [0, 0],
    qualiComparable: 0,
    sprintAhead: [0, 0],
    pointsDiff: a.summary.points - b.summary.points,
  };
  const bBy = new Map(b.rounds.map((r) => [r.round, r]));
  for (const ra of a.rounds) {
    const rb = bBy.get(ra.round);
    if (!rb || !ra.participated || !rb.participated) continue;
    // Corrida: conta quando ao menos um terminou classificado; classificado vence não classificado.
    if (ra.racePos !== null || rb.racePos !== null) {
      h.raceComparable++;
      if (rb.racePos === null || (ra.racePos !== null && ra.racePos < rb.racePos)) h.raceAhead[0]++;
      else h.raceAhead[1]++;
    }
    if (ra.qualiPos !== null && rb.qualiPos !== null) {
      h.qualiComparable++;
      if (ra.qualiPos < rb.qualiPos) h.qualiAhead[0]++;
      else h.qualiAhead[1]++;
    }
    if (ra.sprintPos !== null && rb.sprintPos !== null) {
      if (ra.sprintPos < rb.sprintPos) h.sprintAhead[0]++;
      else h.sprintAhead[1]++;
    }
  }
  return h;
}

export type TeammateDuel = {
  team: string;
  drivers: [string, string];
  quali: [number, number];
  race: [number, number];
  points: [number, number];
};

/** Duelo entre companheiros: dupla que mais correu junta em cada equipe. */
export function teammateDuels(data: SeasonData): TeammateDuel[] {
  const pairs = new Map<string, { team: string; a: string; b: string; names: Map<string, string>; count: number }>();
  for (const race of data.races) {
    const byTeam = new Map<string, RaceResultRow[]>();
    for (const r of race.rows) byTeam.set(r.constructor.id, [...(byTeam.get(r.constructor.id) ?? []), r]);
    for (const [teamId, rows] of byTeam) {
      if (rows.length !== 2) continue;
      const [x, y] = [rows[0]!.driver.id, rows[1]!.driver.id].sort();
      const key = `${teamId}|${x}|${y}`;
      const cur = pairs.get(key) ?? { team: rows[0]!.constructor.name, a: x!, b: y!, names: new Map(), count: 0 };
      for (const r of rows) cur.names.set(r.driver.id, driverName(r.driver));
      cur.count++;
      pairs.set(key, cur);
    }
  }
  const bestByTeam = new Map<string, (typeof pairs extends Map<string, infer V> ? V : never)>();
  for (const [key, p] of pairs) {
    const team = key.split("|")[0]!;
    if (!bestByTeam.has(team) || bestByTeam.get(team)!.count < p.count) bestByTeam.set(team, p);
  }
  const duels: TeammateDuel[] = [];
  for (const p of bestByTeam.values()) {
    const da = analyzeEntity(data, "driver", p.a);
    const db = analyzeEntity(data, "driver", p.b);
    if (!da || !db) continue;
    const h = headToHead(da, db);
    // Mostra o líder do duelo primeiro.
    const flip = da.summary.points < db.summary.points;
    duels.push({
      team: p.team,
      drivers: flip ? [db.name, da.name] : [da.name, db.name],
      quali: flip ? [h.qualiAhead[1], h.qualiAhead[0]] : h.qualiAhead,
      race: flip ? [h.raceAhead[1], h.raceAhead[0]] : h.raceAhead,
      points: flip ? [db.summary.points, da.summary.points] : [da.summary.points, db.summary.points],
    });
  }
  return duels.sort((x, y) => y.points[0] + y.points[1] - (x.points[0] + x.points[1]));
}
