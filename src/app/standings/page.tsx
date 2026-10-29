import type { Metadata } from "next";
import Link from "next/link";
import { TrendChart, type ChartSeries } from "@/components/charts";
import { SeasonGridLegend, SeasonGridTable, type GridMode } from "@/components/season-grid";
import { SeasonStrip } from "@/components/season-strip";
import { Card, Container, ErrorState, PageHeader, SectionHeading, SourceNote } from "@/components/ui";
import { analyzeEntity, championshipPositions, freshConstructorStandings, freshDriverStandings, seasonRounds, type SeasonData } from "@/lib/f1/compare";
import { fallbackLabel, roundLabels } from "@/lib/f1/round-labels";
import { buildSeasonGrid } from "@/lib/f1/season-grid";
import { driverName, f1, load } from "@/lib/f1/service";

export const revalidate = 900;
export const metadata: Metadata = {
  title: "Classificação",
  description: "Classificação de pilotos e construtores da Fórmula 1 etapa por etapa: pontos, posições e evolução na temporada.",
  alternates: { canonical: "/standings" },
};

type SP = { season?: string; view?: string; mode?: string };

function tabHref(sp: { season: number | null; view: "drivers" | "teams"; mode: GridMode }) {
  const q = new URLSearchParams();
  if (sp.season) q.set("season", String(sp.season));
  if (sp.view === "teams") q.set("view", "teams");
  if (sp.mode === "position") q.set("mode", "position");
  const s = q.toString();
  return `/standings${s ? `?${s}` : ""}#etapas`;
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`rounded px-3 py-1.5 text-sm font-semibold ${active ? "bg-elev-2 text-fg ring-1 ring-line-strong" : "text-muted hover:text-fg"}`}
    >
      {children}
    </Link>
  );
}

export default async function StandingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const view: "drivers" | "teams" = sp.view === "teams" ? "teams" : "drivers";
  const mode: GridMode = sp.mode === "position" ? "position" : "points";
  const thisYear = new Date().getUTCFullYear();
  const season = /^\d{4}$/.test(sp.season ?? "") ? Math.min(Math.max(Number(sp.season), 1950), thisYear) : null;
  const key = season ?? "current";

  const [dsR, csR] = await Promise.all([load(f1.getDriverStandings(key)), load(f1.getConstructorStandings(key))]);
  const seasonNum = dsR.ok ? dsR.data.season : (season ?? thisYear);
  const [racesR, sprintsR, eventsR] = await Promise.all([
    load(f1.getSeasonResults(seasonNum, "race")),
    load(f1.getSeasonResults(seasonNum, "sprint")),
    load(f1.getSchedule(seasonNum)),
  ]);
  const data: SeasonData = { races: racesR.ok ? racesR.data : [], sprints: sprintsR.ok ? sprintsR.data : [], qualis: [] };

  // Etapas com corrida OU sprint publicada (num fim de semana Sprint, a sprint pontua antes da corrida).
  const rounds = seasonRounds(data);
  const driverChamp = championshipPositions(data, "driver");
  const teamChamp = championshipPositions(data, "team");
  // Variação: posição recalculada após a etapa anterior (mesmo critério de desempate oficial).
  const prevRound = rounds.length >= 2 ? rounds[rounds.length - 2]!.round : null;
  const prevRank = prevRound !== null ? (driverChamp.get(prevRound) ?? new Map<string, number>()) : new Map<string, number>();

  const ds = dsR.ok ? freshDriverStandings(dsR.data, data) : null;
  const cs = csR.ok ? freshConstructorStandings(csR.data, data) : null;
  const labels = eventsR.ok ? roundLabels(eventsR.data) : new Map();
  const roundInfo = rounds.map((r) => labels.get(r.round) ?? fallbackLabel(r.round, r.raceName));
  const xLabels = roundInfo.map((l) => l.short);
  const xTitles = roundInfo.map((l) => l.title);
  const grid = buildSeasonGrid({
    data,
    kind: view === "teams" ? "team" : "driver",
    events: eventsR.ok ? eventsR.data : [],
    labels,
    official:
      view === "teams"
        ? new Map((cs?.rows ?? []).map((r) => [r.constructor.id, { position: r.position, points: r.points }]))
        : new Map((ds?.rows ?? []).map((r) => [r.driver.id, { position: r.position, points: r.points }])),
  });
  const xDetails = rounds.map((r, i) => [roundInfo[i]!.detail, r.hasRace ? "" : "só a sprint tem resultado"].filter(Boolean).join(" · "));
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
      <SeasonStrip />
      <PageHeader kicker={`Temporada ${seasonNum}${ds ? ` · após a etapa ${ds.round}` : ""}`} title="Classificação">
        Pontuação oficial de pilotos e construtores, etapa por etapa, com as regras da própria temporada (inclui pontos de sprint
        quando aplicável).
      </PageHeader>
      <Container className="mt-8">
        <form method="get" className="mb-8 flex items-end gap-2">
          <label className="text-xs text-muted">
            Temporada
            <input name="season" inputMode="numeric" pattern="\d{4}" defaultValue={seasonNum} className="ml-2 w-20 rounded border border-line bg-elev px-2 py-1 text-sm text-fg" />
          </label>
          <button className="rounded border border-line-strong px-3 py-1 text-sm hover:border-fg">Ver</button>
        </form>

        {grid.rows.length > 0 && (
          <section className="mb-12" aria-labelledby="etapas">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
              <h2 id="etapas" className="font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">
                {view === "teams" ? "Equipes" : "Pilotos"} {seasonNum}
                <span className="ml-2 text-base font-semibold normal-case tracking-normal text-muted">etapa por etapa</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                <nav aria-label="Pilotos ou equipes" className="flex gap-1 rounded-md border border-line p-1">
                  <Tab href={tabHref({ season, view: "drivers", mode })} active={view === "drivers"}>
                    Pilotos
                  </Tab>
                  <Tab href={tabHref({ season, view: "teams", mode })} active={view === "teams"}>
                    Equipes
                  </Tab>
                </nav>
                <nav aria-label="O que mostrar nas células" className="flex gap-1 rounded-md border border-line p-1">
                  <Tab href={tabHref({ season, view, mode: "points" })} active={mode === "points"}>
                    Pontos
                  </Tab>
                  <Tab href={tabHref({ season, view, mode: "position" })} active={mode === "position"}>
                    Posição
                  </Tab>
                </nav>
              </div>
            </div>
            <SeasonGridLegend mode={mode} />
            <SeasonGridTable
              grid={grid}
              kind={view === "teams" ? "team" : "driver"}
              mode={mode}
              caption={`${view === "teams" ? "Equipes" : "Pilotos"} ${seasonNum}: resultado de cada etapa`}
              entityHref={(id) => `/head-to-head?season=${seasonNum}&kind=${view === "teams" ? "team" : "driver"}&id=${encodeURIComponent(id)}`}
            />
            <p className="mt-2 text-xs text-faint">Passe o mouse (ou toque) numa célula para ver o detalhe da corrida e da sprint. Clique no nome para analisar.</p>
          </section>
        )}

        <h2 className="mb-4 font-display text-xl font-bold uppercase text-muted">Classificação oficial</h2>
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
                    {ds!.rows.map((r) => {
                      const leader = ds!.rows[0]!.points;
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
                    {cs!.rows.map((r) => (
                      <tr key={r.constructor.id}>
                        <td className="font-semibold tabular">{r.positionText}</td>
                        <td className="font-medium">{r.constructor.name}</td>
                        <td className="num">{r.wins}</td>
                        <td className="num font-semibold">{r.points}</td>
                        <td className="num text-muted">
                          {r.points === cs!.rows[0]!.points ? "—" : `−${cs!.rows[0]!.points - r.points}`}
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
                  xDetails={xDetails}
                />
              </Card>
              <Card className="p-4 sm:p-6">
                <TrendChart
                  title="Construtores"
                  caption="Pontos acumulados após cada etapa (corrida + sprint)."
                  series={teamSeries}
                  xLabels={xLabels}
                  xTitles={xTitles}
                  xDetails={xDetails}
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
