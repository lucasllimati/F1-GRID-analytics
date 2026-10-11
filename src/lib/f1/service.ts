import { unstable_cache } from "next/cache";
import { logger } from "../log";
import { CircuitOpenError } from "../net/resilient";
import { F1_CACHE_TAG, JolpicaProvider } from "./providers/jolpica";
import { DEFAULT_ASSUMPTIONS, runChampionshipModel, type ModelOutput } from "./probability";
import { driverName } from "./names";
import { remainingScoringSessions } from "./schedule";
import type { F1DataProvider } from "./types";

// Ponto único de acesso a dados esportivos. Trocar de fornecedor = trocar esta linha.
const provider: F1DataProvider = new JolpicaProvider();

/**
 * Cache do resultado JÁ NORMALIZADO de cada consulta (por argumentos), com a mesma tag dos fetches
 * — "Atualizar dados esportivos" no painel invalida tudo de uma vez. Com o cache quente, as páginas
 * não chegam ao limitador de taxa nem à rede; só buscas reais passam por ele.
 * TTL: calendário 10 min, resultados/classificação 10–30 min (dados oficiais mudam pouco).
 */
function cached<A extends unknown[], R>(name: string, fn: (...a: A) => Promise<R>, revalidate: number) {
  return (...args: A) => unstable_cache(() => fn(...args), ["f1", name, JSON.stringify(args)], { revalidate, tags: [F1_CACHE_TAG] })();
}

export const f1: F1DataProvider = {
  info: provider.info,
  getSchedule: cached("schedule", (s: number | "current") => provider.getSchedule(s), 600),
  getDriverStandings: cached("driverStandings", (s: number | "current", r?: number) => provider.getDriverStandings(s, r), 900),
  getConstructorStandings: cached("constructorStandings", (s: number | "current", r?: number) => provider.getConstructorStandings(s, r), 900),
  getRaceResult: cached("raceResult", (s: number, r: number) => provider.getRaceResult(s, r), 600),
  getSprintResult: cached("sprintResult", (s: number, r: number) => provider.getSprintResult(s, r), 600),
  getQualifying: cached("qualifying", (s: number, r: number) => provider.getQualifying(s, r), 600),
  getSeasonResults: cached("seasonResults", (s: number, k: "race" | "sprint") => provider.getSeasonResults(s, k), 1800),
  getSeasonQualifying: cached("seasonQualifying", (s: number) => provider.getSeasonQualifying(s), 1800),
};

const log = logger("f1.service");

export type Loaded<T> = { ok: true; data: T } | { ok: false; error: string };

/** Nunca derruba a página: a UI mostra um estado de erro honesto quando a fonte falha. */
export async function load<T>(p: Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await p };
  } catch (err) {
    // Detalhe técnico já registrado pelo provedor (logger "f1.jolpica"); a página mostra estado de erro honesto.
    log.warn("dados indisponíveis para a página", { error: err instanceof Error ? err.message : String(err) });
    const suspended = err instanceof CircuitOpenError;
    return {
      ok: false,
      error: suspended
        ? "A fonte de dados está instável e as consultas foram pausadas por alguns segundos. Tente novamente em instantes."
        : "A fonte de dados não respondeu. Tente novamente em alguns minutos.",
    };
  }
}

export { driverName } from "./names";

async function computeModel(season: number): Promise<ModelOutput> {
  const [events, ds, cs, races, sprints] = await Promise.all([
    f1.getSchedule(season),
    f1.getDriverStandings(season),
    f1.getConstructorStandings(season),
    f1.getSeasonResults(season, "race"),
    f1.getSeasonResults(season, "sprint"),
  ]);
  // Restante = sessões sem resultado publicado (consistente com os pontos da classificação oficial).
  const remaining = remainingScoringSessions(events, new Set(races.map((r) => r.round)), new Set(sprints.map((s) => s.round)));
  return runChampionshipModel(
    {
      season,
      driverPoints: new Map(ds.rows.map((r) => [r.driver.id, r.points])),
      constructorPoints: new Map(cs.rows.map((r) => [r.constructor.id, r.points])),
      raceResults: races.filter((r) => r.round <= ds.round),
      remainingRaces: remaining.races,
      remainingSprints: remaining.sprints,
      driverNames: new Map(ds.rows.map((r) => [r.driver.id, driverName(r.driver)])),
      constructorNames: new Map(cs.rows.map((r) => [r.constructor.id, r.constructor.name])),
    },
    DEFAULT_ASSUMPTIONS,
  );
}

export const getChampionshipModel = (season: number) =>
  unstable_cache(() => computeModel(season), ["championship-model", String(season), DEFAULT_ASSUMPTIONS.seed.toString()], {
    revalidate: 3600,
    tags: [F1_CACHE_TAG],
  })();
