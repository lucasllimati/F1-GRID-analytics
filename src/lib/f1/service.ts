import { unstable_cache } from "next/cache";
import { F1_CACHE_TAG, JolpicaProvider } from "./providers/jolpica";
import { DEFAULT_ASSUMPTIONS, runChampionshipModel, type ModelOutput } from "./probability";
import { driverName } from "./names";
import { remainingScoringSessions } from "./schedule";
import type { F1DataProvider } from "./types";

// Ponto único de acesso a dados esportivos. Trocar de fornecedor = trocar esta linha.
export const f1: F1DataProvider & { lastResultRound?: JolpicaProvider["lastResultRound"] } = new JolpicaProvider();

export type Loaded<T> = { ok: true; data: T } | { ok: false; error: string };

/** Nunca derruba a página: a UI mostra um estado de erro honesto quando a fonte falha. */
export async function load<T>(p: Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await p };
  } catch (err) {
    console.error("[f1] falha ao carregar dados:", err);
    return { ok: false, error: "A fonte de dados não respondeu. Tente novamente em alguns minutos." };
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
