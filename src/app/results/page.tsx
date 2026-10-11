import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, Container, EmptyState, ErrorState, PageHeader, SectionHeading, SourceNote } from "@/components/ui";
import { roundLabels } from "@/lib/f1/round-labels";
import { driverName, f1, load } from "@/lib/f1/service";
import { OUTCOME_LABEL, type QualifyingRow, type RaceResultRow, type SessionResult } from "@/lib/f1/types";

export const revalidate = 600;
export const metadata: Metadata = {
  title: "Resultados",
  description: "Resultados da temporada de Fórmula 1: vencedores, poles, voltas mais rápidas e sprints de cada Grande Prêmio.",
  alternates: { canonical: "/results" },
};

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "short" });

function winner(r?: SessionResult<RaceResultRow>) {
  return r?.rows.find((x) => x.position === 1) ?? null;
}
function pole(q?: SessionResult<QualifyingRow>) {
  return q?.rows.find((x) => x.position === 1) ?? null;
}
function fastest(r?: SessionResult<RaceResultRow>) {
  return r?.rows.find((x) => x.fastestLapRank === 1) ?? null;
}

export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const sp = await searchParams;
  const thisYear = new Date().getUTCFullYear();
  const requested = /^\d{4}$/.test(sp.season ?? "") ? Math.min(Math.max(Number(sp.season), 1950), thisYear) : null;

  const eventsR = await load(f1.getSchedule(requested ?? "current"));
  const events = eventsR.ok ? eventsR.data : [];
  const season = events[0]?.season ?? requested ?? thisYear;
  const [racesR, sprintsR, qualisR] = await Promise.all([
    load(f1.getSeasonResults(season, "race")),
    load(f1.getSeasonResults(season, "sprint")),
    load(f1.getSeasonQualifying(season)),
  ]);

  const races = new Map((racesR.ok ? racesR.data : []).map((r) => [r.round, r]));
  const sprints = new Map((sprintsR.ok ? sprintsR.data : []).map((r) => [r.round, r]));
  const qualis = new Map((qualisR.ok ? qualisR.data : []).map((r) => [r.round, r]));
  const labels = roundLabels(events);
  const done = events.filter((e) => races.has(e.round));
  const awaiting = events.filter((e) => !races.has(e.round) && e.status === "awaiting_results");
  const last = done.at(-1);
  const lastRace = last ? races.get(last.round) : undefined;
  const lastQuali = last ? qualis.get(last.round) : undefined;
  const lastSprint = last ? sprints.get(last.round) : undefined;

  return (
    <>
      <PageHeader kicker={`Temporada ${season} · ${done.length} de ${events.length} etapas concluídas`} title="Resultados">
        Vencedores, poles e voltas mais rápidas de cada Grande Prêmio, conforme os resultados oficiais publicados. Clique numa etapa para ver
        a classificação completa, o grid e as sessões.
      </PageHeader>
      <Container className="mt-8">
        <form method="get" className="mb-8 flex items-end gap-2">
          <label className="text-xs text-muted">
            Temporada
            <input
              name="season"
              inputMode="numeric"
              pattern="\d{4}"
              defaultValue={season}
              className="ml-2 w-20 rounded border border-line bg-elev px-2 py-1 text-sm text-fg"
            />
          </label>
          <button className="rounded border border-line-strong px-3 py-1 text-sm hover:border-fg">Ver</button>
        </form>

        {!eventsR.ok && <ErrorState message={eventsR.error} />}
        {!racesR.ok && <ErrorState message={racesR.error} />}

        {awaiting.length > 0 && (
          <p role="status" className="mb-6 rounded border border-warn/50 p-3 text-sm">
            <strong className="text-warn">Aguardando resultado oficial:</strong>{" "}
            {awaiting.map((e, i) => (
              <span key={e.round}>
                {i > 0 && ", "}
                <Link href={`/calendar/${e.season}/${e.round}`} className="underline">
                  {e.name}
                </Link>
              </span>
            ))}
            . A fonte publica o resultado algumas horas após a corrida.
          </p>
        )}

        {/* ── Último GP ── */}
        {last && lastRace && (
          <section aria-labelledby="ultimo" className="mb-12">
            <SectionHeading id="ultimo" kicker={`Etapa ${last.round} · ${labels.get(last.round)?.detail ?? ""}`} title={`Último GP · ${last.name}`} />
            <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
              <Card className="p-5">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">Pódio</h3>
                <ol className="grid gap-3 sm:grid-cols-3">
                  {lastRace.rows
                    .filter((r) => r.position !== null && r.position <= 3)
                    .map((r) => (
                      <li key={r.driver.id} className="rounded bg-elev-2 p-3">
                        <span className="font-display text-3xl font-extrabold italic text-accent">P{r.position}</span>
                        <span className="block font-semibold">{driverName(r.driver)}</span>
                        <span className="text-xs text-faint">
                          {r.constructor.name} · {r.time ?? OUTCOME_LABEL[r.outcome]}
                        </span>
                      </li>
                    ))}
                </ol>
                <Link
                  href={`/calendar/${last.season}/${last.round}?tab=race`}
                  className="mt-4 inline-block text-sm font-semibold text-accent hover:underline"
                >
                  Resultado completo, grid e sessões →
                </Link>
              </Card>
              <Card className="p-5">
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-widest text-muted">Pole position</dt>
                    <dd className="font-semibold">
                      {pole(lastQuali) ? `${driverName(pole(lastQuali)!.driver)} · ${pole(lastQuali)!.q3 ?? pole(lastQuali)!.q2 ?? pole(lastQuali)!.q1 ?? ""}` : "—"}
                    </dd>
                    <dd className="text-xs text-faint">1º na classificação; penalidades podem mudar o grid.</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-widest text-muted">Volta mais rápida</dt>
                    <dd className="font-semibold">{fastest(lastRace) ? driverName(fastest(lastRace)!.driver) : "não informada pela fonte"}</dd>
                  </div>
                  {lastSprint && (
                    <div>
                      <dt className="text-xs uppercase tracking-widest text-muted">Vencedor da sprint</dt>
                      <dd className="font-semibold">{winner(lastSprint) ? driverName(winner(lastSprint)!.driver) : "—"}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs uppercase tracking-widest text-muted">Abandonos / não classificados</dt>
                    <dd className="font-semibold">{lastRace.rows.filter((r) => r.position === null).length}</dd>
                  </div>
                </dl>
              </Card>
            </div>
          </section>
        )}

        {/* ── Temporada ── */}
        <section aria-labelledby="temporada">
          <SectionHeading id="temporada" title={`Todas as etapas de ${season}`} />
          {events.length === 0 ? (
            <EmptyState title="Sem calendário para esta temporada" />
          ) : (
            <Card className="overflow-x-auto">
              <table className="data-table">
                <caption className="sr-only">Vencedor, pole, volta mais rápida e sprint de cada etapa</caption>
                <thead>
                  <tr>
                    <th scope="col">Etapa</th>
                    <th scope="col">Grande Prêmio</th>
                    <th scope="col">Vencedor</th>
                    <th scope="col">Pole</th>
                    <th scope="col">Volta mais rápida</th>
                    <th scope="col">Sprint</th>
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => {
                    const race = races.get(e.round);
                    const w = winner(race);
                    const p = pole(qualis.get(e.round));
                    const fl = fastest(race);
                    const sw = winner(sprints.get(e.round));
                    const raceDate = e.sessions.find((s) => s.type === "race")?.date;
                    return (
                      <tr key={e.round} className={race ? undefined : "text-faint"}>
                        <td className="tabular font-semibold">{e.round}</td>
                        <td>
                          <span className="font-medium text-fg">{e.name}</span>
                          <span className="block text-xs text-faint">
                            {e.locality}, {e.countryPt}
                            {raceDate ? ` · ${dateFmt.format(new Date(`${raceDate}T12:00:00Z`))}` : ""}
                          </span>
                        </td>
                        <td>
                          {w ? (
                            <>
                              <span className="font-semibold text-fg">{driverName(w.driver)}</span>
                              <span className="block text-xs text-faint">{w.constructor.name}</span>
                            </>
                          ) : e.status === "awaiting_results" ? (
                            <Badge tone="warn">Aguardando</Badge>
                          ) : (
                            <span className="text-xs">{e.status === "upcoming" ? "a disputar" : "em andamento"}</span>
                          )}
                        </td>
                        <td className="text-sm">{p ? driverName(p.driver) : "—"}</td>
                        <td className="text-sm">{fl ? driverName(fl.driver) : race ? <span className="text-faint">não informada</span> : "—"}</td>
                        <td className="text-sm">{e.format === "sprint" ? (sw ? driverName(sw.driver) : "—") : <span className="text-faint">sem sprint</span>}</td>
                        <td>
                          <Link href={`/calendar/${e.season}/${e.round}${race ? "?tab=race" : ""}`} className="whitespace-nowrap text-sm text-accent hover:underline">
                            {race ? "Resultado →" : "Ver etapa →"}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </section>
        <SourceNote>
          Fonte: resultados oficiais publicados na Jolpica-F1. Pole = 1º colocado na sessão de classificação (antes de penalidades de grid). A
          volta mais rápida só aparece quando a fonte informa.
        </SourceNote>
      </Container>
    </>
  );
}
