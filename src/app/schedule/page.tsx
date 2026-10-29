import type { Metadata } from "next";
import Link from "next/link";
import { NextSessionCountdown } from "@/components/countdown";
import { SeasonStrip } from "@/components/season-strip";
import { SessionList, type SessionItem } from "@/components/session-list";
import { Card, Container, EmptyState, ErrorState, PageHeader, SectionHeading, SourceNote } from "@/components/ui";
import { siteUrl } from "@/lib/env";
import { BROADCAST_REVIEWED, broadcastSummary, openTvChannel } from "@/lib/f1/broadcast";
import { gpName } from "@/lib/f1/gp-names";
import { sortSessions } from "@/lib/f1/schedule";
import { f1, load } from "@/lib/f1/service";
import { SESSION_LABEL, type RaceEvent } from "@/lib/f1/types";

export const revalidate = 600;
export const metadata: Metadata = {
  title: "Horário da F1",
  description: "Horários de treinos, classificação, sprint e corrida das próximas etapas da F1, no seu fuso, e onde assistir no Brasil.",
  alternates: { canonical: "/schedule" },
};

const longDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "numeric", month: "long" });

function items(e: RaceEvent): SessionItem[] {
  return sortSessions(e.sessions).map((s) => ({
    key: `${e.round}-${s.type}`,
    label: SESSION_LABEL[s.type],
    startsAt: s.startsAt,
    date: s.date,
    main: s.type === "race",
    openTv: openTvChannel(e, s.type),
  }));
}

function EventCard({ e, total, featured = false }: { e: RaceEvent; total: number; featured?: boolean }) {
  const race = e.sessions.find((s) => s.type === "race");
  return (
    <Card className={`p-5 ${featured ? "border-l-4 border-l-accent" : ""}`}>
      <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-faint">
        Etapa {e.round} de {total}
        {race && ` · ${longDate.format(new Date(`${race.date}T12:00:00Z`))}`}
        {e.format === "sprint" && " · Sprint"}
      </p>
      <h3 className="mt-1 text-lg font-semibold">
        <span aria-hidden="true">{e.flag} </span>
        <Link href={`/calendar/${e.season}/${e.round}`} className="hover:underline">
          {gpName(e.name)}
        </Link>
      </h3>
      <p className="mb-3 text-sm text-muted">
        {e.circuitName}, {e.locality}
      </p>
      {featured && (
        <div className="mb-4">
          <NextSessionCountdown sessions={e.sessions.map((s) => ({ label: SESSION_LABEL[s.type], startsAt: s.startsAt }))} />
        </div>
      )}
      <SessionList sessions={items(e)} circuitTz={e.timeZone} highlightNext={featured} />
      <p className="mt-3 text-xs text-muted">
        <strong className="text-fg">Onde assistir:</strong> {broadcastSummary(e)}
      </p>
    </Card>
  );
}

export default async function SchedulePage() {
  const eventsR = await load(f1.getSchedule("current"));
  const events = eventsR.ok ? eventsR.data : [];
  const upcoming = events.filter((e) => e.status !== "completed");
  const [next, ...rest] = upcoming;
  const season = events[0]?.season ?? new Date().getUTCFullYear();
  const ics = siteUrl("/calendar.ics");
  const google = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(ics.replace(/^https?:/, "webcal:"))}`;

  return (
    <>
      <SeasonStrip />
      <PageHeader kicker={`Temporada ${season}`} title="Horário da F1">
        Treinos, classificação, sprint e corrida das próximas etapas, e onde assistir a cada uma. Os horários seguem o fuso escolhido no topo da
        página (padrão: Brasília).
      </PageHeader>
      <Container className="mt-8">
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <a href={ics} className="rounded border border-line-strong px-3 py-1.5 text-sm font-semibold hover:border-fg">
            📅 Apple ou Outlook
          </a>
          <a href={google} target="_blank" rel="noopener noreferrer" className="rounded border border-line-strong px-3 py-1.5 text-sm font-semibold hover:border-fg">
            📅 Google Agenda
          </a>
          <span className="text-xs text-faint">Todas as sessões da temporada na sua agenda, no seu fuso e sempre atualizadas.</span>
        </div>

        {!eventsR.ok ? (
          <ErrorState message={eventsR.error} />
        ) : !next ? (
          <EmptyState title="Temporada encerrada">
            Veja os <Link href="/calendar" className="underline">resultados de cada etapa no calendário</Link>.
          </EmptyState>
        ) : (
          <>
            <section aria-labelledby="proxima">
              <SectionHeading id="proxima" title="Próxima etapa" />
              <div className="max-w-xl">
                <EventCard e={next} total={events.length} featured />
              </div>
            </section>
            {rest.length > 0 && (
              <section className="mt-12" aria-labelledby="proximas">
                <SectionHeading id="proximas" title="Próximas etapas" />
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {rest.map((e) => (
                    <EventCard key={e.round} e={e} total={events.length} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
        <SourceNote>
          Horários oficiais publicados pela Jolpica-F1 (sujeitos a mudança pela FIA). Transmissão no Brasil conforme a grade divulgada até{" "}
          {BROADCAST_REVIEWED.split("-").reverse().join("/")}; confirme na programação da emissora. Etapas já disputadas estão no{" "}
          <Link href="/calendar" className="underline">
            calendário
          </Link>
          .
        </SourceNote>
      </Container>
    </>
  );
}
