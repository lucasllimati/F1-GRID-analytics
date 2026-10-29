import Link from "next/link";
import { NextSessionCountdown } from "@/components/countdown";
import { NewsGrid } from "@/components/news-card";
import { LocalTime, SessionTimesTable } from "@/components/timezone";
import { Badge, Card, Container, EmptyState, ErrorState, SectionHeading, SourceNote, statusTone } from "@/components/ui";
import { gpName } from "@/lib/f1/gp-names";
import { HISTORY, onThisDay } from "@/lib/f1/history";
import { maxRemainingDriverPoints, pointsSystem } from "@/lib/f1/points";
import { eventStart, lastCompletedEvent, nextEvent, remainingScoringSessions } from "@/lib/f1/schedule";
import { driverName, f1, load } from "@/lib/f1/service";
import { EVENT_STATUS_LABEL, OUTCOME_LABEL, SESSION_LABEL } from "@/lib/f1/types";
import { listPublished, radarItems } from "@/lib/news/queries";

export const revalidate = 300;

export default async function HomePage() {
  const [eventsR, dsR, csR, articles, radar] = await Promise.all([
    load(f1.getSchedule("current")),
    load(f1.getDriverStandings("current")),
    load(f1.getConstructorStandings("current")),
    listPublished({ take: 7 }),
    radarItems(8),
  ]);

  const events = eventsR.ok ? eventsR.data : [];
  const upcoming = nextEvent(events);
  const last = lastCompletedEvent(events);
  const season = events[0]?.season ?? new Date().getUTCFullYear();
  const [lastResultR, seasonResultsR, sprintResultsR] = await Promise.all([
    last ? load(f1.getRaceResult(last.season, last.round)) : Promise.resolve(null),
    load(f1.getSeasonResults(season, "race")),
    load(f1.getSeasonResults(season, "sprint")),
  ]);

  const ds = dsR.ok ? dsR.data : null;
  const cs = csR.ok ? csR.data : null;
  const leader = ds?.rows[0];
  const second = ds?.rows[1];
  const remainingSessions =
    seasonResultsR.ok && sprintResultsR.ok
      ? remainingScoringSessions(
          events,
          new Set(seasonResultsR.data.map((r) => r.round)),
          new Set(sprintResultsR.data.map((s) => s.round)),
        )
      : null;
  const remaining = { length: remainingSessions?.races ?? 0 };
  const maxLeft = remainingSessions ? maxRemainingDriverPoints(pointsSystem(season), remainingSessions.races, remainingSessions.sprints) : 0;

  // Destaques derivados de resultados oficiais publicados na fonte.
  const seasonResults = seasonResultsR.ok ? seasonResultsR.data : [];
  const winners = new Map<string, { name: string; wins: number }>();
  const podiums = new Map<string, number>();
  for (const race of seasonResults) {
    for (const row of race.rows) {
      if (row.position === 1) {
        const w = winners.get(row.driver.id) ?? { name: driverName(row.driver), wins: 0 };
        w.wins++;
        winners.set(row.driver.id, w);
      }
      if (row.position !== null && row.position <= 3) podiums.set(row.driver.id, (podiums.get(row.driver.id) ?? 0) + 1);
    }
  }
  const topWinner = [...winners.values()].sort((a, b) => b.wins - a.wins)[0];
  const start = upcoming ? eventStart(upcoming) : null;

  return (
    <>
      {/* ── Hero: próximo evento ── */}
      <section aria-labelledby="hero-title" className="telemetry-bg relative overflow-hidden border-b border-line">
        <div
          className="pointer-events-none absolute -right-24 top-0 h-full w-1/2 skew-x-[-18deg] bg-gradient-to-l from-accent/15 to-transparent"
          aria-hidden="true"
        />
        <Container className="relative py-10 sm:py-16">
          {!eventsR.ok && <ErrorState message={eventsR.error} />}
          {eventsR.ok && !upcoming && (
            <EmptyState title="Temporada encerrada">Não há etapas futuras publicadas no calendário oficial desta temporada.</EmptyState>
          )}
          {upcoming && (
            <div className="grid gap-10 lg:grid-cols-[1.25fr_1fr]">
              <div>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <Badge tone="accent">
                    Etapa {upcoming.round} de {events.length}
                  </Badge>
                  <Badge tone={statusTone(upcoming.status)}>{EVENT_STATUS_LABEL[upcoming.status]}</Badge>
                  {upcoming.format === "sprint" && <Badge tone="warn">Fim de semana Sprint</Badge>}
                </div>
                <h1
                  id="hero-title"
                  className="font-display text-5xl font-extrabold uppercase italic leading-[0.95] tracking-tight sm:text-7xl"
                >
                  {upcoming.name}
                </h1>
                <p className="mt-4 text-lg text-muted">
                  {upcoming.circuitName} · {upcoming.locality}, {upcoming.countryPt}
                </p>
                {start && (
                  <p className="mt-1 text-sm text-faint">
                    Início do fim de semana:{" "}
                    <LocalTime iso={start.toISOString()} circuitTz={upcoming.timeZone} variant="datetime" showZone />
                  </p>
                )}
                <div className="mt-8">
                  <NextSessionCountdown
                    sessions={upcoming.sessions.map((s) => ({ label: SESSION_LABEL[s.type], startsAt: s.startsAt }))}
                  />
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href={`/calendar/${upcoming.season}/${upcoming.round}`}
                    className="rounded bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-strong"
                  >
                    Abrir Race Center
                  </Link>
                  <Link href="/calendar" className="rounded border border-line-strong px-4 py-2.5 text-sm font-semibold hover:border-fg">
                    Calendário completo
                  </Link>
                </div>
              </div>
              <Card className="self-start p-4 sm:p-5">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted">Programação oficial</h2>
                <SessionTimesTable
                  circuitTz={upcoming.timeZone}
                  sessions={upcoming.sessions.map((s) => ({ label: SESSION_LABEL[s.type], startsAt: s.startsAt, date: s.date }))}
                />
                <SourceNote>
                  Horários oficiais publicados em UTC e convertidos por fuso IANA
                  {upcoming.timeZone ? ` (circuito: ${upcoming.timeZone})` : ""}. Fonte: Jolpica-F1. Mude o fuso de referência no seletor
                  “Fuso” do topo.
                </SourceNote>
              </Card>
            </div>
          )}
        </Container>
      </section>

      {/* ── Snapshot do campeonato ── */}
      <Container className="mt-14">
        <SectionHeading
          kicker={ds ? `Temporada ${ds.season} · após a etapa ${ds.round}` : "Campeonato"}
          title="Championship snapshot"
          action={
            <Link href="/standings" className="text-sm font-semibold text-accent hover:underline">
              Classificação completa →
            </Link>
          }
        />
        {!dsR.ok && <ErrorState message={dsR.error} />}
        {ds && leader && (
          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">Líder do campeonato</p>
              <p className="mt-2 font-display text-4xl font-extrabold uppercase italic leading-none">{leader.driver.familyName}</p>
              <p className="text-sm text-muted">
                {leader.driver.givenName} · {leader.constructors.map((c) => c.name).join(" / ")}
              </p>
              <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
                {(
                  [
                    ["Pontos", leader.points],
                    ["Vitórias", leader.wins],
                    ["Vantagem", second ? `+${leader.points - second.points}` : "—"],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="rounded bg-elev-2 p-2">
                    <dt className="text-[0.65rem] uppercase tracking-widest text-faint">{k}</dt>
                    <dd className="font-display text-2xl font-bold tabular">{v}</dd>
                  </div>
                ))}
              </dl>
              {second && (
                <p className="mt-3 text-xs text-faint">
                  Vantagem sobre {driverName(second.driver)}. Ainda há até {maxLeft} pontos em disputa por piloto ({remaining.length}{" "}
                  corridas restantes).
                </p>
              )}
            </Card>
            <Card className="overflow-hidden">
              <h3 className="border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted">Pilotos · top 5</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Pos</th>
                    <th scope="col">Piloto</th>
                    <th scope="col" className="num">
                      Pts
                    </th>
                    <th scope="col" className="num">
                      Dif.
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ds.rows.slice(0, 5).map((r) => (
                    <tr key={r.driver.id}>
                      <td className="tabular font-semibold">{r.positionText}</td>
                      <td>
                        {driverName(r.driver)}
                        <span className="block text-xs text-faint">{r.constructors[0]?.name}</span>
                      </td>
                      <td className="num font-semibold">{r.points}</td>
                      <td className="num text-muted">{r.points === leader.points ? "—" : `−${leader.points - r.points}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card className="overflow-hidden">
              <h3 className="border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted">
                Construtores · top 5
              </h3>
              {cs ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Pos</th>
                      <th scope="col">Equipe</th>
                      <th scope="col" className="num">
                        Pts
                      </th>
                      <th scope="col" className="num">
                        Vit.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cs.rows.slice(0, 5).map((r) => (
                      <tr key={r.constructor.id}>
                        <td className="tabular font-semibold">{r.positionText}</td>
                        <td>{r.constructor.name}</td>
                        <td className="num font-semibold">{r.points}</td>
                        <td className="num text-muted">{r.wins}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-4">
                  <ErrorState message="Classificação de construtores indisponível." />
                </div>
              )}
            </Card>
          </div>
        )}

        {last && lastResultR?.ok && lastResultR.data && (
          <Card className="mt-5 p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-xl font-bold uppercase">Último resultado · {last.name}</h3>
              <Link href={`/calendar/${last.season}/${last.round}`} className="text-sm text-accent hover:underline">
                Resultado completo →
              </Link>
            </div>
            <ol className="grid gap-3 sm:grid-cols-3">
              {lastResultR.data.rows.slice(0, 3).map((r) => (
                <li key={r.driver.id} className="flex items-center gap-3 rounded bg-elev-2 p-3">
                  <span className="font-display text-3xl font-extrabold italic text-accent">P{r.position}</span>
                  <span>
                    <span className="block font-semibold">{driverName(r.driver)}</span>
                    <span className="text-xs text-faint">
                      {r.constructor.name} · {r.time ?? OUTCOME_LABEL[r.outcome]}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        )}
      </Container>

      {/* ── Newsroom ── */}
      <Container className="mt-16">
        <SectionHeading
          kicker="Redação Apex Grid"
          title="Newsroom"
          action={
            <Link href="/news" className="text-sm font-semibold text-accent hover:underline">
              Todas as notícias →
            </Link>
          }
        />
        {articles.length === 0 ? (
          <EmptyState title="Nenhuma matéria publicada ainda">
            A redação publica apenas textos que passaram pela checagem de fatos. Enquanto isso, veja o radar de fontes abaixo.
          </EmptyState>
        ) : (
          <NewsGrid articles={articles} />
        )}
        {radar.length > 0 && (
          <Card className="mt-6 p-5">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">Radar das fontes</h3>
            <p className="mb-3 text-xs text-faint">Manchetes recentes dos veículos monitorados, com link para o texto original.</p>
            <ul className="divide-y divide-line">
              {radar.map((r) => (
                <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2 text-sm">
                  <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-accent">
                    {r.title}
                  </a>
                  <span className="text-xs text-faint">
                    {r.source.name} · {!r.publishedAtKnown && "coletado "}
                    <LocalTime iso={r.publishedAt.toISOString()} variant="datetime" />
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </Container>

      {/* ── Data highlights ── */}
      <Container className="mt-16">
        <SectionHeading kicker={`Temporada ${season}`} title="Data highlights" />
        {seasonResults.length === 0 ? (
          <EmptyState title="Sem resultados publicados nesta temporada" />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-5">
              <p className="font-display text-5xl font-extrabold tabular">{winners.size}</p>
              <p className="mt-1 text-sm text-muted">vencedores diferentes em {seasonResults.length} corridas</p>
            </Card>
            {topWinner && (
              <Card className="p-5">
                <p className="font-display text-5xl font-extrabold tabular">{topWinner.wins}</p>
                <p className="mt-1 text-sm text-muted">vitórias de {topWinner.name}, o maior vencedor da temporada</p>
              </Card>
            )}
            {leader && (
              <Card className="p-5">
                <p className="font-display text-5xl font-extrabold tabular">{podiums.get(leader.driver.id) ?? 0}</p>
                <p className="mt-1 text-sm text-muted">pódios do líder {driverName(leader.driver)} em corridas principais</p>
              </Card>
            )}
            <Card className="p-5">
              <p className="font-display text-5xl font-extrabold tabular">{maxLeft}</p>
              <p className="mt-1 text-sm text-muted">pontos máximos ainda disponíveis por piloto (corridas + sprints)</p>
            </Card>
          </div>
        )}
        <SourceNote>
          Calculado a partir dos resultados oficiais de corridas principais da temporada {season} publicados na Jolpica-F1. Sprints não
          contam como vitória ou pódio nestes números.
        </SourceNote>
      </Container>

      {/* ── Neste dia na história ── */}
      {(() => {
        const today = onThisDay(HISTORY, new Date());
        const [main, ...more] = today;
        if (!main) return null;
        return (
          <Container className="mt-16">
            <Card className="grid gap-6 p-5 md:grid-cols-[1.6fr_1fr]">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-faint">
                  Neste dia, em {main.race.season} · há {main.years} anos
                </p>
                <p className="mt-2 text-lg">{main.label}</p>
                <Link href="/records" className="mt-3 inline-block text-sm font-semibold text-accent hover:underline">
                  Recordes e campeões desde 1950 →
                </Link>
              </div>
              {more.length > 0 && (
                <div className="border-line md:border-l md:pl-6">
                  <p className="mb-1 text-xs text-faint">Também neste dia:</p>
                  <ul className="space-y-1 text-sm text-muted">
                    {more.slice(0, 4).map((x) => (
                      <li key={`${x.race.season}-${x.race.round}`}>
                        <strong className="tabular text-fg">{x.race.season}</strong> {gpName(x.race.name)}
                        {x.race.winner && <>, vitória de {x.race.winner.name}</>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </Container>
        );
      })()}

      {/* ── F2 / F3 ── */}
      <Container className="mt-16">
        <div className="grid gap-5 md:grid-cols-2">
          {["Fórmula 2", "Fórmula 3"].map((s) => (
            <Card key={s} className="p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-2xl font-bold uppercase">{s}</h3>
                <Badge>Em breve</Badge>
              </div>
              <p className="mt-2 text-sm text-muted">
                A cobertura de calendário e classificação depende de uma fonte de dados com licença adequada, ainda em avaliação. Não
                exibimos dados de {s} até a integração ser validada.
              </p>
            </Card>
          ))}
        </div>
      </Container>
    </>
  );
}
