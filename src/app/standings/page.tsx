import type { Metadata } from "next";
import Link from "next/link";
import { TrendChart, type ChartSeries } from "@/components/charts";
import { Card, Container, ErrorState, PageHeader, SectionHeading, SourceNote } from "@/components/ui";
import { analyzeEntity, championshipPositions, seasonRounds, type SeasonData } from "@/lib/f1/compare";
import { driverName, f1, load } from "@/lib/f1/service";

export const revalidate = 900;
export const metadata: Metadata = {
  title: "Classificação",
  description: "Classificação de pilotos e construtores da Fórmula 1, com evolução de pontos por etapa.",
  alternates: { canonical: "/standings" },
};

export default async function StandingsPage({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const sp = await searchParams;
  const thisYear = new Date().getUTCFullYear();
  const season = /^\d{4}$/.test(sp.season ?? "") ? Math.min(Math.max(Number(sp.season), 1950), thisYear) : null;
  const key = season ?? "current";

  const [dsR, csR] = await Promise.all([load(f1.getDriverStandings(key)), load(f1.getConstructorStandings(key))]);
  const seasonNum = dsR.ok ? dsR.data.season : (season ?? thisYear);
  const [racesR, sprintsR] = await Promise.all([load(f1.getSeasonResults(seasonNum, "race")), load(f1.getSeasonResults(seasonNum, "sprint"))]);
  const data: SeasonData = { races: racesR.ok ? racesR.data : [], sprints: sprintsR.ok ? sprintsR.data : [], qualis: [] };

  // Etapas com corrida OU sprint publicada (num fim de semana Sprint, a sprint pontua antes da corrida).
  const rounds = seasonRounds(data);
  const driverChamp = championshipPositions(data, "driver");
  const teamChamp = championshipPositions(data, "team");
  // Variação: posição recalculada após a etapa anterior (mesmo critério de desempate oficial).
  const prevRound = rounds.length >= 2 ? rounds[rounds.length - 2]!.round : null;
  const prevRank = prevRound !== null ? (driverChamp.get(prevRound) ?? new Map<string, number>()) : new Map<string, number>();

  const ds = dsR.ok ? dsR.data : null;
  const cs = csR.ok ? csR.data : null;
  const xLabels = rounds.map((r) => `E${r.round}`);
  const xTitles = rounds.map((r) => r.raceName.replace(" Grand Prix", "") + (r.hasRace ? "" : " (só sprint)"));
  // Até 4 séries: limite da paleta categórica validada.
  const driverSeries: ChartSeries[] = (ds?.rows.slice(0, 4) ?? [])
    .map((r, slot) => ({
      id: r.driver.id,
      label: r.driver.code ?? r.driver.familyName,
      slot,
      values: analyzeEntity(data, "driver", r.driver.id, driverChamp)?.rounds.map((x) => x.cumulative) ?? [],
    }))
    .filter((x) => x.values.length > 0);
  const teamSeries: ChartSeries[] = (cs?.rows.slice(0, 4) ?? [])
    .map((r, slot) => ({
      id: r.constructor.id,
      label: r.constructor.name,
      slot,
      values: analyzeEntity(data, "team", r.constructor.id, teamChamp)?.rounds.map((x) => x.cumulative) ?? [],
    }))
    .filter((x) => x.values.length > 0);

  return (
    <>
      <PageHeader kicker={`Temporada ${seasonNum}${ds ? ` · após a etapa ${ds.round}` : ""}`} title="Classificação">
        Pontuação oficial de pilotos e construtores, com regras da própria temporada (inclui pontos de sprint quando aplicável).
      </PageHeader>
      <Container className="mt-8">
        <form method="get" className="mb-8 flex items-end gap-2">
          <label className="text-xs text-muted">
            Temporada
            <input name="season" inputMode="numeric" pattern="\d{4}" defaultValue={seasonNum} className="ml-2 w-20 rounded border border-line bg-elev px-2 py-1 text-sm text-fg" />
          </label>
          <button className="rounded border border-line-strong px-3 py-1 text-sm hover:border-fg">Ver</button>
        </form>

        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <section aria-labelledby="drivers">
            <SectionHeading id="drivers" title="Pilotos" />
            {!dsR.ok ? (
              <ErrorState message={dsR.error} />
            ) : (
              <Card className="overflow-x-auto">
                <table className="data-table">
                  <caption className="sr-only">Classificação de pilotos</caption>
                  <thead>
                    <tr>
                      <th scope="col">Pos</th>
                      <th scope="col">Var.</th>
                      <th scope="col">Piloto</th>
                      <th scope="col">Equipe</th>
                      <th scope="col" className="num">Vitórias</th>
                      <th scope="col" className="num">Pts</th>
                      <th scope="col" className="num">Dif. líder</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dsR.data.rows.map((r) => {
                      const leader = dsR.data.rows[0]!.points;
                      const prev = prevRank.get(r.driver.id);
                      const delta = prev && r.position ? prev - r.position : 0;
                      return (
                        <tr key={r.driver.id}>
                          <td className="font-semibold tabular">{r.positionText}</td>
                          <td className="tabular text-xs">
                            {delta > 0 ? (
                              <span className="text-ok">▲ {delta}</span>
                            ) : delta < 0 ? (
                              <span className="text-accent">▼ {-delta}</span>
                            ) : (
                              <span className="text-faint">=</span>
                            )}
                          </td>
                          <td>
                            <span className="font-medium">{driverName(r.driver)}</span>
                            {r.driver.code && <span className="ml-1 text-xs text-faint">{r.driver.code}</span>}
                          </td>
                          <td className="text-muted">{r.constructors.map((c) => c.name).join(" / ")}</td>
                          <td className="num">{r.wins}</td>
                          <td className="num font-semibold">{r.points}</td>
                          <td className="num text-muted">{r.points === leader ? "—" : `−${leader - r.points}`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            )}
          </section>
          <section aria-labelledby="constructors">
            <SectionHeading id="constructors" title="Construtores" />
            {!csR.ok ? (
              <ErrorState message={csR.error} />
            ) : (
              <Card className="overflow-x-auto">
                <table className="data-table">
                  <caption className="sr-only">Classificação de construtores</caption>
                  <thead>
                    <tr>
                      <th scope="col">Pos</th>
                      <th scope="col">Equipe</th>
                      <th scope="col" className="num">Vitórias</th>
                      <th scope="col" className="num">Pts</th>
                      <th scope="col" className="num">Dif.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csR.data.rows.map((r) => (
                      <tr key={r.constructor.id}>
                        <td className="font-semibold tabular">{r.positionText}</td>
                        <td className="font-medium">{r.constructor.name}</td>
                        <td className="num">{r.wins}</td>
                        <td className="num font-semibold">{r.points}</td>
                        <td className="num text-muted">
                          {r.points === csR.data.rows[0]!.points ? "—" : `−${csR.data.rows[0]!.points - r.points}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </section>
        </div>

        {(driverSeries.length > 0 || teamSeries.length > 0) && (
          <section className="mt-12" aria-labelledby="evolution">
            <SectionHeading
              id="evolution"
              kicker="Top 4 atual"
              title="Evolução dos pontos"
              action={
                <Link href={`/head-to-head?season=${seasonNum}`} className="text-sm font-semibold text-accent hover:underline">
                  Comparar quem você quiser →
                </Link>
              }
            />
            <div className="grid gap-6">
              <Card className="p-4 sm:p-6">
                <TrendChart
                  title="Pilotos"
                  caption="Pontos acumulados após cada etapa (corrida + sprint)."
                  series={driverSeries}
                  xLabels={xLabels}
                  xTitles={xTitles}
                />
              </Card>
              <Card className="p-4 sm:p-6">
                <TrendChart
                  title="Construtores"
                  caption="Pontos acumulados após cada etapa (corrida + sprint)."
                  series={teamSeries}
                  xLabels={xLabels}
                  xTitles={xTitles}
                />
              </Card>
            </div>
          </section>
        )}
        <SourceNote>
          Fonte: Jolpica-F1. Variação de posição recalculada a partir dos resultados publicados até a etapa anterior, com o desempate oficial
          (vitórias, 2º lugares…); pode divergir em casos de pontos retirados por decisão posterior. Veja também as{" "}
          <Link href="/championship-probabilities" className="underline">
            probabilidades de título
          </Link>
          .
        </SourceNote>
      </Container>
    </>
  );
}
