import type { Metadata } from "next";
import Link from "next/link";
import { SeasonStrip } from "@/components/season-strip";
import { Card, Container, EmptyState, ErrorState, PageHeader, SectionHeading, SourceNote } from "@/components/ui";
import { gpName } from "@/lib/f1/gp-names";
import { nationalityFlag } from "@/lib/f1/nationality";
import { buildRecap, type Recap } from "@/lib/f1/recap";
import { nextEvent } from "@/lib/f1/schedule";
import { driverName, f1, load } from "@/lib/f1/service";
import { teamColor } from "@/lib/f1/team-colors";

export const revalidate = 900;
export const metadata: Metadata = {
  title: "Resumos das corridas",
  description: "O resumo de cada corrida da temporada de F1, montado a partir dos resultados oficiais: pódio, vantagem, recuperações, abandonos e campeonato.",
  alternates: { canonical: "/recaps" },
};

const longDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });

function RecapCard({ r, date, flag, total, season, featured }: { r: Recap; date?: string; flag: string; total: number; season: number; featured?: boolean }) {
  return (
    <article id={`etapa-${r.round}`} className={`scroll-mt-24 rounded-md border border-line bg-elev p-5 ${featured ? "border-t-4 border-t-accent" : ""}`}>
      <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-faint">
        Etapa {r.round} de {total}
        {date && ` · ${longDate.format(new Date(`${date}T12:00:00Z`))}`}
      </p>
      <h3 className={`mt-1 font-display font-bold ${featured ? "text-3xl" : "text-xl"}`}>
        <span aria-hidden="true">{flag} </span>
        {r.headline}
      </h3>
      <ol className="mt-4 space-y-2">
        {r.podium.map((p) => (
          <li key={p.pos} className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-elev-2 font-display font-bold">{p.pos}</span>
            <span className="h-8 w-[3px] rounded-full" style={{ background: teamColor(p.teamId) }} aria-hidden="true" />
            <span className="flex-1">
              <span className="block font-semibold">
                <span aria-hidden="true">{nationalityFlag(p.nationality)} </span>
                {p.name}
              </span>
              <span className="block text-xs text-muted">{p.team}</span>
            </span>
            <span className="text-sm tabular text-muted">+{p.points} pts</span>
          </li>
        ))}
      </ol>
      {r.chips.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Destaques">
          {r.chips.map((c) => (
            <li key={c} className="rounded-full border border-line-strong bg-elev-2 px-2.5 py-1 text-xs font-semibold">
              {c}
            </li>
          ))}
        </ul>
      )}
      <div className={`mt-4 space-y-2 ${featured ? "text-base" : "text-sm"} text-muted`}>
        {(featured ? r.paragraphs : r.paragraphs.slice(0, 2)).map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      <p className="mt-4 text-sm">
        <Link href={`/calendar/${season}/${r.round}`} className="font-semibold text-accent hover:underline">
          Resultado completo e grid →
        </Link>
      </p>
    </article>
  );
}

export default async function RecapsPage() {
  const eventsR = await load(f1.getSchedule("current"));
  const season = eventsR.ok ? (eventsR.data[0]?.season ?? new Date().getUTCFullYear()) : new Date().getUTCFullYear();
  const [racesR, sprintsR, qualisR, dsR] = await Promise.all([
    load(f1.getSeasonResults(season, "race")),
    load(f1.getSeasonResults(season, "sprint")),
    load(f1.getSeasonQualifying(season)),
    load(f1.getDriverStandings(season)),
  ]);
  const events = eventsR.ok ? eventsR.data : [];
  const byRound = new Map(events.map((e) => [e.round, e]));
  const races = racesR.ok ? [...racesR.data].sort((a, b) => a.round - b.round) : [];
  const sprints = sprintsR.ok ? sprintsR.data : [];
  const qualiBy = new Map((qualisR.ok ? qualisR.data : []).map((q) => [q.round, q]));
  const recaps = races
    .map((race) => buildRecap({ race, races, sprints, quali: qualiBy.get(race.round) }))
    .filter((r): r is Recap => r !== null)
    .reverse();
  const [latest, ...older] = recaps;
  const next = nextEvent(events);
  const top3 = dsR.ok ? dsR.data.rows.slice(0, 3) : [];

  return (
    <>
      <SeasonStrip />
      <PageHeader kicker={`Temporada ${season}`} title={`Resumo da F1 ${season}`}>
        O resumo de cada corrida, montado a partir dos resultados oficiais: pódio, vantagem, quem mais ganhou posições, abandonos e como ficou o
        campeonato.
      </PageHeader>
      <Container className="mt-8">
        {!racesR.ok ? (
          <ErrorState message={racesR.error} />
        ) : !latest ? (
          <EmptyState title="Nenhuma corrida disputada ainda">Os resumos aparecem aqui logo depois do resultado oficial.</EmptyState>
        ) : (
          <>
            <div className="mb-10 grid gap-4 md:grid-cols-2">
              {next && (
                <Card className="p-5">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-faint">Próxima corrida</p>
                  <p className="mt-1 text-lg font-semibold">
                    <span aria-hidden="true">{next.flag} </span>
                    {gpName(next.name)}
                  </p>
                  <p className="text-sm text-muted">
                    Etapa {next.round} de {events.length}
                  </p>
                  <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <Link href="/schedule" className="font-semibold hover:underline">
                      Horários e onde assistir →
                    </Link>
                    <Link href={`/calendar/${next.season}/${next.round}`} className="font-semibold hover:underline">
                      Circuito →
                    </Link>
                  </p>
                </Card>
              )}
              {top3.length > 0 && (
                <Card className="p-5">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-faint">Disputa pelo título</p>
                  <ol className="mt-2 space-y-1.5">
                    {top3.map((r, i) => (
                      <li key={r.driver.id} className="flex items-center gap-3">
                        <span className="h-7 w-[3px] rounded-full" style={{ background: teamColor(r.constructors.at(-1)?.id ?? "") }} aria-hidden="true" />
                        <span className="flex-1 font-semibold">
                          <span aria-hidden="true">{nationalityFlag(r.driver.nationality)} </span>
                          {driverName(r.driver)}
                        </span>
                        <span className="tabular">
                          <strong>{r.points}</strong> <span className="text-xs text-faint">pts</span>
                        </span>
                        <span className="w-12 text-right text-sm tabular text-muted">{i === 0 ? "líder" : `−${top3[0]!.points - r.points}`}</span>
                      </li>
                    ))}
                  </ol>
                  <Link href="/championship-probabilities" className="mt-3 inline-block text-sm font-semibold hover:underline">
                    Quem ainda pode ser campeão →
                  </Link>
                </Card>
              )}
            </div>

            <section aria-labelledby="ultima">
              <SectionHeading id="ultima" title="Última corrida" />
              <RecapCard r={latest} date={byRound.get(latest.round)?.sessions.find((s) => s.type === "race")?.date} flag={byRound.get(latest.round)?.flag ?? ""} total={events.length} season={season} featured />
            </section>

            {older.length > 0 && (
              <section className="mt-12" aria-labelledby="anteriores">
                <SectionHeading id="anteriores" title="Etapas anteriores" />
                <div className="grid gap-4 md:grid-cols-2">
                  {older.map((r) => (
                    <RecapCard key={r.round} r={r} date={byRound.get(r.round)?.sessions.find((s) => s.type === "race")?.date} flag={byRound.get(r.round)?.flag ?? ""} total={events.length} season={season} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
        <SourceNote>
          Resumos gerados automaticamente a partir dos resultados oficiais publicados na Jolpica-F1 (sem interpretação editorial). Para análises e
          bastidores, veja as <Link href="/news" className="underline">notícias</Link>.
        </SourceNote>
      </Container>
    </>
  );
}
