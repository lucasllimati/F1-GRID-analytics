import type { Metadata } from "next";
import Link from "next/link";
import { LocalTime } from "@/components/timezone";
import { Badge, Container, EmptyState, ErrorState, PageHeader, SourceNote, statusTone } from "@/components/ui";
import { eventStart, raceSession } from "@/lib/f1/schedule";
import { driverName, f1, load } from "@/lib/f1/service";
import { EVENT_STATUS_LABEL, SESSION_SHORT, type EventStatus, type RaceEvent, type SessionType } from "@/lib/f1/types";

export const revalidate = 600;
export const metadata: Metadata = {
  title: "Calendário",
  description: "Calendário completo da temporada de Fórmula 1 com horários no seu fuso.",
  alternates: { canonical: "/calendar" },
};

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTHS_LONG = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const STATUS_FILTERS: (EventStatus | "all")[] = ["all", "upcoming", "weekend_underway", "awaiting_results", "completed"];

type SP = { season?: string; status?: string; month?: string; format?: string; country?: string; session?: string; view?: string };

function qs(base: SP, patch: Partial<SP>): string {
  const merged = { ...base, ...patch };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v && v !== "all") p.set(k, v);
  const s = p.toString();
  return s ? `/calendar?${s}` : "/calendar";
}

function monthOf(e: RaceEvent): number {
  return Number(raceSession(e)?.date.slice(5, 7) ?? "0");
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`rounded-sm border px-2.5 py-1 text-xs font-medium ${active ? "border-accent bg-accent-soft text-fg" : "border-line text-muted hover:border-line-strong hover:text-fg"}`}
    >
      {children}
    </Link>
  );
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const currentYear = new Date().getUTCFullYear();
  const seasonNum = /^\d{4}$/.test(sp.season ?? "") ? Math.min(Math.max(Number(sp.season), 1950), currentYear + 1) : null;
  const eventsR = await load(f1.getSchedule(seasonNum ?? "current"));
  const events = eventsR.ok ? eventsR.data : [];
  const season = events[0]?.season ?? seasonNum ?? currentYear;
  const winnersR = await load(f1.getSeasonResults(season, "race"));
  const winners = new Map<number, string>();
  if (winnersR.ok) for (const r of winnersR.data) {
    const w = r.rows.find((x) => x.position === 1);
    if (w) winners.set(r.round, driverName(w.driver));
  }

  const status = STATUS_FILTERS.includes(sp.status as EventStatus) ? (sp.status as EventStatus | "all") : "all";
  const month = /^\d{1,2}$/.test(sp.month ?? "") ? Number(sp.month) : 0;
  const format = sp.format === "sprint" || sp.format === "standard" ? sp.format : "all";
  const sessionFilter = (["fp1", "fp2", "fp3", "sprint_qualifying", "sprint", "qualifying", "race"] as SessionType[]).includes(
    sp.session as SessionType,
  )
    ? (sp.session as SessionType)
    : null;
  const countries = [...new Set(events.map((e) => e.countryPt))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const country = countries.includes(sp.country ?? "") ? sp.country! : "";
  const view = sp.view === "grid" ? "grid" : "list";

  const filtered = events.filter(
    (e) =>
      (status === "all" || e.status === status) &&
      (!month || monthOf(e) === month) &&
      (format === "all" || e.format === format) &&
      (!country || e.countryPt === country) &&
      (!sessionFilter || e.sessions.some((s) => s.type === sessionFilter)),
  );
  const months = [...new Set(events.map(monthOf))].sort((a, b) => a - b);
  const base: SP = { season: seasonNum ? String(seasonNum) : undefined, status, month: month ? String(month) : undefined, format, country, session: sessionFilter ?? undefined, view };

  return (
    <>
      <PageHeader kicker={`Temporada ${season}`} title="Calendário">
        Todas as etapas com horários oficiais convertidos para o fuso escolhido no topo da página. Formatos de fim de semana seguem o
        calendário publicado — eventos Sprint têm programação diferente.
      </PageHeader>
      <Container className="mt-8">
        {!eventsR.ok && <ErrorState message={eventsR.error} />}

        <form method="get" action="/calendar" className="mb-4 flex flex-wrap items-end gap-3" aria-label="Filtros do calendário">
          <label className="text-xs text-muted">
            Temporada
            <input
              name="season"
              inputMode="numeric"
              pattern="\d{4}"
              defaultValue={seasonNum ?? season}
              className="ml-2 w-20 rounded border border-line bg-elev px-2 py-1 text-sm text-fg"
            />
          </label>
          <label className="text-xs text-muted">
            País
            <select name="country" defaultValue={country} className="ml-2 rounded border border-line bg-elev px-2 py-1 text-sm text-fg">
              <option value="">Todos</option>
              {countries.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted">
            Tipo de sessão
            <select name="session" defaultValue={sessionFilter ?? ""} className="ml-2 rounded border border-line bg-elev px-2 py-1 text-sm text-fg">
              <option value="">Todas</option>
              {(Object.keys(SESSION_SHORT) as SessionType[]).map((s) => (
                <option key={s} value={s}>
                  {SESSION_SHORT[s]}
                </option>
              ))}
            </select>
          </label>
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          {month > 0 && <input type="hidden" name="month" value={month} />}
          {format !== "all" && <input type="hidden" name="format" value={format} />}
          <input type="hidden" name="view" value={view} />
          <button className="rounded border border-line-strong px-3 py-1 text-sm hover:border-fg">Aplicar</button>
        </form>

        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Status">
          {STATUS_FILTERS.map((s) => (
            <Chip key={s} href={qs(base, { status: s })} active={status === s}>
              {s === "all" ? "Todos" : EVENT_STATUS_LABEL[s]}
            </Chip>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Mês">
          <Chip href={qs(base, { month: undefined })} active={!month}>
            Todos os meses
          </Chip>
          {months.map((m) => (
            <Chip key={m} href={qs(base, { month: String(m) })} active={month === m}>
              {MONTHS[m - 1]}
            </Chip>
          ))}
        </div>
        <div className="mb-6 flex flex-wrap items-center gap-1.5">
          {(["all", "standard", "sprint"] as const).map((f) => (
            <Chip key={f} href={qs(base, { format: f })} active={format === f}>
              {f === "all" ? "Todos os formatos" : f === "sprint" ? "Sprint" : "Tradicional"}
            </Chip>
          ))}
          <span className="mx-2 h-4 w-px bg-line" aria-hidden="true" />
          <Chip href={qs(base, { view: "list" })} active={view === "list"}>
            Lista
          </Chip>
          <Chip href={qs(base, { view: "grid" })} active={view === "grid"}>
            Calendário
          </Chip>
        </div>

        <p className="mb-4 text-sm text-muted" role="status">
          {filtered.length} de {events.length} etapas
        </p>

        {filtered.length === 0 && eventsR.ok && <EmptyState title="Nenhuma etapa com esses filtros" />}

        {view === "list" ? (
          <ol className="divide-y divide-line rounded-md border border-line bg-elev">
            {filtered.map((e) => {
              const start = eventStart(e);
              const race = raceSession(e);
              return (
                <li key={e.round} className="grid gap-3 p-4 hover:bg-elev-2 sm:grid-cols-[3.5rem_1fr_auto] sm:items-center">
                  <div className="font-display text-3xl font-extrabold italic text-faint tabular">{String(e.round).padStart(2, "0")}</div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/calendar/${e.season}/${e.round}`} className="font-display text-xl font-bold uppercase hover:text-accent">
                        <span aria-hidden="true">{e.flag}</span> {e.name}
                      </Link>
                      <Badge tone={statusTone(e.status)}>{EVENT_STATUS_LABEL[e.status]}</Badge>
                      {e.format === "sprint" && <Badge tone="warn">Sprint</Badge>}
                    </div>
                    <p className="text-sm text-muted">
                      {e.circuitName} · {e.locality}, {e.countryPt}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-faint">
                      {e.sessions.map((s) => (
                        <span key={s.type}>
                          {SESSION_SHORT[s.type]}{" "}
                          {s.startsAt ? <LocalTime iso={s.startsAt} circuitTz={e.timeZone} variant="datetime" /> : `${s.date} (horário a confirmar)`}
                        </span>
                      ))}
                    </p>
                  </div>
                  <div className="text-sm sm:text-right">
                    {start && (
                      <div className="font-semibold">
                        <LocalTime iso={start.toISOString()} circuitTz={e.timeZone} variant="date" />
                        {race?.startsAt && (
                          <>
                            {" – "}
                            <LocalTime iso={race.startsAt} circuitTz={e.timeZone} variant="date" />
                          </>
                        )}
                      </div>
                    )}
                    {winners.get(e.round) && <div className="text-xs text-muted">Vencedor: {winners.get(e.round)}</div>}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {months
              .filter((m) => filtered.some((e) => monthOf(e) === m))
              .map((m) => (
                <section key={m} className="rounded-md border border-line bg-elev p-4" aria-labelledby={`m-${m}`}>
                  <h2 id={`m-${m}`} className="mb-3 font-display text-lg font-bold uppercase">
                    {MONTHS_LONG[m - 1]} {season}
                  </h2>
                  <ul className="space-y-2">
                    {filtered
                      .filter((e) => monthOf(e) === m)
                      .map((e) => (
                        <li key={e.round} className="flex items-center gap-3">
                          <span className="w-10 rounded bg-elev-2 py-1 text-center font-display text-lg font-bold tabular">
                            {raceSession(e)?.date.slice(8, 10)}
                          </span>
                          <Link href={`/calendar/${e.season}/${e.round}`} className="text-sm hover:text-accent">
                            <span aria-hidden="true">{e.flag}</span> {e.name}
                            <span className="block text-xs text-faint">{EVENT_STATUS_LABEL[e.status]}</span>
                          </Link>
                        </li>
                      ))}
                  </ul>
                </section>
              ))}
          </div>
        )}
        <SourceNote>
          Fonte: Jolpica-F1 (horários em UTC). Dia exibido na visão de calendário = data da corrida conforme a fonte. “Fim de semana em
          andamento” significa apenas que o horário previsto da primeira sessão já passou — não indicamos sessões ao vivo.
        </SourceNote>
      </Container>
    </>
  );
}
