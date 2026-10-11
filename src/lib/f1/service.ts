import { unstable_cache } from "next/cache";
import { F1_CACHE_TAG, JolpicaProvider } from "./providers/jolpica";
import { DEFAULT_ASSUMPTIONS, runChampionshipModel, type ModelOutput } from "./probability";
import type { F1DataProvider, RaceEvent } from "./types";

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

export function driverName(d: { givenName: string; familyName: string }) {
  return `${d.givenName} ${d.familyName}`;
}

async function computeModel(season: number): Promise<ModelOutput> {
  const [events, ds, cs, races] = await Promise.all([
    f1.getSchedule(season),
    f1.getDriverStandings(season),
    f1.getConstructorStandings(season),
    f1.getSeasonResults(season, "race"),
  ]);
  // Etapas restantes = rodadas posteriores à última classificação publicada.
  const remaining = events.filter((e: RaceEvent) => e.round > ds.round);
  return runChampionshipModel(
    {
      season,
      driverPoints: new Map(ds.rows.map((r) => [r.driver.id, r.points])),
      constructorPoints: new Map(cs.rows.map((r) => [r.constructor.id, r.points])),
      raceResults: races.filter((r) => r.round <= ds.round),
      remainingRaces: remaining.length,
      remainingSprints: remaining.filter((e) => e.format === "sprint").length,
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
