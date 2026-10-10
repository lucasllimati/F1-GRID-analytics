import {
  compareCountback,
  maxRemainingDriverPoints,
  maxRemainingTeamPoints,
  pointsSystem,
  racePoints,
  sprintPoints,
  type PointsSystem,
} from "./points";
import type { RaceResultRow, SessionResult } from "./types";

// Modelo de probabilidade de título — versão 1 (experimental).
// Metodologia completa, hipóteses e limitações: docs/PROBABILITY.md e /methodology.

export const MODEL_VERSION = "mc-pl-1.0";

export type ModelAssumptions = {
  simulations: number;
  /** Meia-vida (em corridas) do peso de resultados recentes na estimativa de força. */
  recencyHalfLife: number;
  /** Desvio-padrão do choque de desempenho do carro, compartilhado pelos pilotos da equipe, por corrida. */
  teamShockSd: number;
  /** Desvio-padrão do choque individual do piloto, por corrida. */
  driverShockSd: number;
  /** Encolhimento da força individual em direção à força média da equipe (0–1). */
  teamShrinkage: number;
  /** Prior Beta(a,b) da taxa de abandono por largada. */
  dnfPrior: { a: number; b: number };
  seed: number;
};

export const DEFAULT_ASSUMPTIONS: ModelAssumptions = {
  simulations: 20_000,
  recencyHalfLife: 5,
  teamShockSd: 0.35,
  driverShockSd: 0.25,
  teamShrinkage: 0.3,
  dnfPrior: { a: 1, b: 12 },
  seed: 20260101,
};

export type ModelInput = {
  season: number;
  /** Pontos atuais oficiais (fonte: classificação publicada). */
  driverPoints: Map<string, number>;
  constructorPoints: Map<string, number>;
  raceResults: SessionResult<RaceResultRow>[];
  remainingRaces: number;
  remainingSprints: number;
  /** Nome legível de pilotos e equipes para a saída. */
  driverNames: Map<string, string>;
  constructorNames: Map<string, string>;
};

export type EntryOutcome = {
  id: string;
  name: string;
  currentPoints: number;
  titleProbability: number;
  /** Erro padrão de Monte Carlo (só reflete a amostragem, não a incerteza do modelo). */
  monteCarloSe: number;
  meanFinalPoints: number;
  p10FinalPoints: number;
  p90FinalPoints: number;
  mathematicallyAlive: boolean;
};

export type ModelOutput = {
  modelVersion: string;
  season: number;
  basedOnRound: number;
  generatedAt: string;
  assumptions: ModelAssumptions;
  remainingRaces: number;
  remainingSprints: number;
  maxRemainingDriverPoints: number;
  drivers: EntryOutcome[];
  constructors: EntryOutcome[];
  /** Avisos: dados insuficientes etc. Quando houver, a UI não deve exibir números como se fossem robustos. */
  warnings: string[];
};

// ── RNG determinístico (reprodutibilidade) ─────────────────────────

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rng: () => number): number {
  let u = 0;
  while (u === 0) u = rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function gumbel(rng: () => number): number {
  let u = 0;
  while (u === 0) u = rng();
  return -Math.log(-Math.log(u));
}

// ── Estimativa de força (Plackett-Luce ponderado, algoritmo MM de Hunter 2004) ──

export type Strength = { logStrength: Map<string, number>; dnfRate: Map<string, number>; team: Map<string, string> };

export function estimateStrengths(
  results: SessionResult<RaceResultRow>[],
  a: Pick<ModelAssumptions, "recencyHalfLife" | "teamShrinkage" | "dnfPrior">,
): Strength {
  const sorted = [...results].sort((x, y) => x.round - y.round);
  const lastIdx = sorted.length - 1;
  const team = new Map<string, string>();
  const starts = new Map<string, number>();
  const dnfs = new Map<string, number>();
  type Ranking = { order: string[]; weight: number };
  const rankings: Ranking[] = [];

  sorted.forEach((race, idx) => {
    const weight = Math.pow(0.5, (lastIdx - idx) / a.recencyHalfLife);
    const finishers: { id: string; pos: number }[] = [];
    for (const row of race.rows) {
      team.set(row.driver.id, row.constructor.id);
      if (row.outcome === "did_not_start" || row.outcome === "did_not_qualify" || row.outcome === "withdrawn") continue;
      starts.set(row.driver.id, (starts.get(row.driver.id) ?? 0) + 1);
      const finishedRace = row.outcome === "finished" || row.outcome === "lapped";
      if (!finishedRace) dnfs.set(row.driver.id, (dnfs.get(row.driver.id) ?? 0) + 1);
      // Para a força de ritmo usamos somente quem foi classificado terminando a prova.
      if (finishedRace && row.position !== null) finishers.push({ id: row.driver.id, pos: row.position });
    }
    finishers.sort((p, q) => p.pos - q.pos);
    if (finishers.length >= 2) rankings.push({ order: finishers.map((f) => f.id), weight });
  });

  const drivers = [...team.keys()];
  const gamma = new Map<string, number>(drivers.map((d) => [d, 1]));
  // Número ponderado de "vitórias em subconjunto" (aparições não-últimas) por piloto.
  const wins = new Map<string, number>(drivers.map((d) => [d, 0]));
  for (const r of rankings) {
    for (let i = 0; i < r.order.length - 1; i++) wins.set(r.order[i]!, (wins.get(r.order[i]!) ?? 0) + r.weight);
  }
  // Pseudo-observação para evitar força zero/infinita (prior fraco).
  const PSEUDO = 0.5;

  for (let iter = 0; iter < 200; iter++) {
    const denom = new Map<string, number>(drivers.map((d) => [d, 0]));
    for (const r of rankings) {
      let tail = 0;
      const tails: number[] = new Array(r.order.length);
      for (let i = r.order.length - 1; i >= 0; i--) {
        tail += gamma.get(r.order[i]!) ?? 1;
        tails[i] = tail;
      }
      let cum = 0;
      for (let i = 0; i < r.order.length; i++) {
        if (i < r.order.length - 1) cum += r.weight / tails[i]!;
        const id = r.order[i]!;
        denom.set(id, (denom.get(id) ?? 0) + cum);
      }
    }
    let maxDelta = 0;
    let sumLog = 0;
    for (const d of drivers) {
      const next = ((wins.get(d) ?? 0) + PSEUDO) / ((denom.get(d) ?? 0) + PSEUDO);
      maxDelta = Math.max(maxDelta, Math.abs(Math.log(next) - Math.log(gamma.get(d) ?? 1)));
      gamma.set(d, next);
      sumLog += Math.log(next);
    }
    const mean = sumLog / Math.max(drivers.length, 1);
    for (const d of drivers) gamma.set(d, Math.exp(Math.log(gamma.get(d)!) - mean));
    if (maxDelta < 1e-6) break;
  }

  // Encolhimento em direção à média da equipe (o carro explica parte do desempenho).
  const teamMean = new Map<string, { sum: number; n: number }>();
  for (const d of drivers) {
    const t = team.get(d)!;
    const cur = teamMean.get(t) ?? { sum: 0, n: 0 };
    cur.sum += Math.log(gamma.get(d)!);
    cur.n += 1;
    teamMean.set(t, cur);
  }
  const logStrength = new Map<string, number>();
  for (const d of drivers) {
    const tm = teamMean.get(team.get(d)!)!;
    const own = Math.log(gamma.get(d)!);
    logStrength.set(d, (1 - a.teamShrinkage) * own + a.teamShrinkage * (tm.sum / tm.n));
  }

  const dnfRate = new Map<string, number>();
  for (const d of drivers) {
    dnfRate.set(d, ((dnfs.get(d) ?? 0) + a.dnfPrior.a) / ((starts.get(d) ?? 0) + a.dnfPrior.a + a.dnfPrior.b));
  }
  return { logStrength, dnfRate, team };
}

// ── Simulação ──────────────────────────────────────────────────────

function quantile(sorted: Float64Array, q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[idx]!;
}

/** Simula uma sessão e devolve a ordem de chegada (classificados) e os abandonos. */
function simulateSession(
  drivers: string[],
  strength: Strength,
  teamShock: Map<string, number>,
  a: ModelAssumptions,
  rng: () => number,
): { order: string[]; dnf: string[] } {
  const keyed: { id: string; key: number }[] = [];
  const dnf: string[] = [];
  for (const d of drivers) {
    if (rng() < (strength.dnfRate.get(d) ?? 0.1)) {
      dnf.push(d);
      continue;
    }
    const base = strength.logStrength.get(d) ?? -1;
    const shock = (teamShock.get(strength.team.get(d) ?? "") ?? 0) + a.driverShockSd * normal(rng);
    // Amostragem Plackett-Luce via truque de Gumbel: ordenar log(força)+Gumbel.
    keyed.push({ id: d, key: base + shock + gumbel(rng) });
  }
  keyed.sort((x, y) => y.key - x.key);
  return { order: keyed.map((k) => k.id), dnf };
}

export function runChampionshipModel(input: ModelInput, assumptions: ModelAssumptions = DEFAULT_ASSUMPTIONS): ModelOutput {
  const sys: PointsSystem = pointsSystem(input.season);
  const warnings: string[] = [];
  const completed = input.raceResults.length;
  if (completed < 3) {
    warnings.push("Menos de 3 corridas concluídas: a estimativa de força é instável. Probabilidades numéricas não devem ser exibidas.");
  }
  if (input.season >= 2026 && completed < 6) {
    warnings.push("Temporada sob novo regulamento técnico: histórico anterior não é usado e a amostra atual ainda é pequena.");
  }

  const strength = estimateStrengths(input.raceResults, assumptions);
  const lastRace = [...input.raceResults].sort((x, y) => y.round - x.round)[0];
  // Grid ativo = pilotos que participaram da última corrida.
  const active = lastRace ? [...new Set(lastRace.rows.map((r) => r.driver.id))] : [];
  const teamOfActive = new Map(active.map((d) => [d, strength.team.get(d)!]));
  const teams = [...new Set(teamOfActive.values())];

  // Contagem de posições em GPs já disputados (para desempate por countback).
  const baseCountback = new Map<string, number[]>();
  for (const race of input.raceResults) {
    for (const row of race.rows) {
      if (row.position === null) continue;
      const arr = baseCountback.get(row.driver.id) ?? [];
      arr[row.position - 1] = (arr[row.position - 1] ?? 0) + 1;
      baseCountback.set(row.driver.id, arr);
    }
  }

  const driverIds = [...new Set([...input.driverPoints.keys(), ...active])];
  const constructorIds = [...new Set([...input.constructorPoints.keys(), ...teams])];
  const n = assumptions.simulations;
  const rng = mulberry32(assumptions.seed);
  const driverTitles = new Map<string, number>(driverIds.map((d) => [d, 0]));
  const teamTitles = new Map<string, number>(constructorIds.map((t) => [t, 0]));
  const driverFinal = new Map<string, Float64Array>(driverIds.map((d) => [d, new Float64Array(n)]));
  const teamFinal = new Map<string, Float64Array>(constructorIds.map((t) => [t, new Float64Array(n)]));

  const events: ("race" | "sprint")[] = [
    ...Array<"sprint">(input.remainingSprints).fill("sprint"),
    ...Array<"race">(input.remainingRaces).fill("race"),
  ];

  for (let s = 0; s < n; s++) {
    const pts = new Map(input.driverPoints);
    const tpts = new Map(input.constructorPoints);
    const countback = new Map<string, number[]>();
    for (const [d, arr] of baseCountback) countback.set(d, [...arr]);

    for (const kind of events) {
      const teamShock = new Map(teams.map((t) => [t, assumptions.teamShockSd * normal(rng)]));
      const { order } = simulateSession(active, strength, teamShock, assumptions, rng);
      // Volta mais rápida (quando pontua): sorteada entre os 10 primeiros, uniformemente.
      const flIdx = kind === "race" && sys.fastestLapPoint ? Math.floor(rng() * Math.min(10, order.length)) : -1;
      order.forEach((d, i) => {
        const p = kind === "race" ? racePoints(sys, i + 1, i === flIdx) : sprintPoints(sys, i + 1);
        if (p) {
          pts.set(d, (pts.get(d) ?? 0) + p);
          const t = teamOfActive.get(d)!;
          tpts.set(t, (tpts.get(t) ?? 0) + p);
        }
        if (kind === "race") {
          const arr = countback.get(d) ?? [];
          arr[i] = (arr[i] ?? 0) + 1;
          countback.set(d, arr);
        }
      });
    }

    let champ: string | null = null;
    for (const d of driverIds) {
      const v = pts.get(d) ?? 0;
      driverFinal.get(d)![s] = v;
      if (champ === null) champ = d;
      else {
        const cv = pts.get(champ) ?? 0;
        if (v > cv || (v === cv && compareCountback(countback.get(d) ?? [], countback.get(champ) ?? []) < 0)) champ = d;
      }
    }
    if (champ) driverTitles.set(champ, (driverTitles.get(champ) ?? 0) + 1);

    let tchamp: string | null = null;
    for (const t of constructorIds) {
      const v = tpts.get(t) ?? 0;
      teamFinal.get(t)![s] = v;
      // Desempate de construtores simplificado (pontos); empate exato é raríssimo — documentado.
      if (tchamp === null || v > (tpts.get(tchamp) ?? 0)) tchamp = t;
    }
    if (tchamp) teamTitles.set(tchamp, (teamTitles.get(tchamp) ?? 0) + 1);
  }

  const maxDriver = maxRemainingDriverPoints(sys, input.remainingRaces, input.remainingSprints);
  const maxTeam = maxRemainingTeamPoints(sys, input.remainingRaces, input.remainingSprints);
  const leaderPts = Math.max(0, ...input.driverPoints.values());
  const teamLeaderPts = Math.max(0, ...input.constructorPoints.values());

  const summarize = (
    ids: string[],
    titles: Map<string, number>,
    finals: Map<string, Float64Array>,
    current: Map<string, number>,
    names: Map<string, string>,
    maxGain: number,
    leader: number,
  ): EntryOutcome[] =>
    ids
      .map((id) => {
        const p = (titles.get(id) ?? 0) / n;
        const arr = Float64Array.from(finals.get(id)!).sort();
        const mean = arr.reduce((acc, v) => acc + v, 0) / n;
        const cur = current.get(id) ?? 0;
        return {
          id,
          name: names.get(id) ?? id,
          currentPoints: cur,
          titleProbability: p,
          monteCarloSe: Math.sqrt((p * (1 - p)) / n),
          meanFinalPoints: mean,
          p10FinalPoints: quantile(arr, 0.1),
          p90FinalPoints: quantile(arr, 0.9),
          mathematicallyAlive: cur + maxGain >= leader,
        };
      })
      .sort((x, y) => y.titleProbability - x.titleProbability || y.currentPoints - x.currentPoints);

  return {
    modelVersion: MODEL_VERSION,
    season: input.season,
    basedOnRound: lastRace?.round ?? 0,
    generatedAt: new Date().toISOString(),
    assumptions,
    remainingRaces: input.remainingRaces,
    remainingSprints: input.remainingSprints,
    maxRemainingDriverPoints: maxDriver,
    drivers: summarize(driverIds, driverTitles, driverFinal, input.driverPoints, input.driverNames, maxDriver, leaderPts),
    constructors: summarize(
      constructorIds,
      teamTitles,
      teamFinal,
      input.constructorPoints,
      input.constructorNames,
      maxTeam,
      teamLeaderPts,
    ),
    warnings,
  };
}
