import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NextSessionCountdown } from "@/components/countdown";
import { ResultsTable, type Row } from "@/components/results-table";
import { StartingGrid } from "@/components/starting-grid";
import { SessionTimesTable } from "@/components/timezone";
import { Badge, Card, Container, EmptyState, ErrorState, SectionHeading, SourceNote, statusTone } from "@/components/ui";
import { driverName, f1, load } from "@/lib/f1/service";
import { EVENT_STATUS_LABEL, OUTCOME_LABEL, SESSION_LABEL, type RaceResultRow, type SessionResult } from "@/lib/f1/types";

export const revalidate = 600;

type Params = { season: string; round: string };
const TABS = ["race", "sprint", "qualifying", "grid"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { race: "Corrida", sprint: "Sprint", qualifying: "Classificação", grid: "Grid de largada" };

function parseParams(p: Params): { season: number; round: number } | null {
  if (!/^\d{4}$/.test(p.season) || !/^\d{1,2}$/.test(p.round)) return null;
  return { season: Number(p.season), round: Number(p.round) };
}

async function getEvent(season: number, round: number) {
  const r = await load(f1.getSchedule(season));
  if (!r.ok) return { error: r.error, event: null, prev: null, next: null };
  const idx = r.data.findIndex((e) => e.round === round);
  return { error: null, event: r.data[idx] ?? null, prev: idx > 0 ? r.data[idx - 1]! : null, next: r.data[idx + 1] ?? null };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = parseParams(await params);
  if (!p) return {};
  const { event } = await getEvent(p.season, p.round);
  return event
    ? {
        title: `${event.name} ${event.season}`,
        description: `Horários, resultados e grid do ${event.name} ${event.season} em ${event.circuitName}.`,
        alternates: { canonical: `/calendar/${p.season}/${p.round}` },
      }
    : {};
}

function resultRows(res: SessionResult<RaceResultRow>): Row[] {
  return res.rows.map((r) => ({
    _id: r.driver.id,
    pos: r.position ?? r.positionText, // estados especiais aparecem como texto (R, D, W…), nunca posição inventada
    number: r.number,
    driver: driverName(r.driver),
    team: r.constructor.name,
    grid: r.grid ?? (r.pitLaneStart ? "Pit lane" : null),
    laps: r.laps,
    time: r.time ?? (r.outcome === "finished" ? null : r.status),
    outcome: OUTCOME_LABEL[r.outcome],
    points: r.points,
  }));
}

const RESULT_COLUMNS = [
  { key: "pos", label: "Pos", numeric: true },
  { key: "number", label: "Nº", numeric: true },
  { key: "driver", label: "Piloto" },
  { key: "team", label: "Equipe" },
  { key: "grid", label: "Grid", numeric: true },
  { key: "laps", label: "Voltas", numeric: true },
  { key: "time", label: "Tempo / Status" },
  { key: "outcome", label: "Situação" },
  { key: "points", label: "Pts", numeric: true },
];

export default async function EventPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ tab?: string }> }) {
  const p = parseParams(await params);
  if (!p) notFound();
  const { event, error, prev, next } = await getEvent(p.season, p.round);
  if (error) {
    return (
      <Container className="py-16">
        <ErrorState message={error} />
      </Container>
    );
  }
  if (!event) notFound();

  const sp = await searchParams;
  const hasSprint = event.format === "sprint";
  const available = TABS.filter((t) => t !== "sprint" || hasSprint);
  const tab: Tab = available.includes(sp.tab as Tab) ? (sp.tab as Tab) : event.status === "completed" ? "race" : "qualifying";

  const [raceR, sprintR, qualiR] = await Promise.all([
    tab === "race" || tab === "grid" ? load(f1.getRaceResult(p.season, p.round)) : Promise.resolve(null),
    tab === "sprint" ? load(f1.getSprintResult(p.season, p.round)) : Promise.resolve(null),
    tab === "qualifying" || tab === "grid" ? load(f1.getQualifying(p.season, p.round)) : Promise.resolve(null),
  ]);

  return (
    <>
      <div className="telemetry-bg border-b border-line">
        <Container className="py-10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <nav aria-label="Trilha">
              <span>Race Center</span> ·{" "}
              <Link href={`/calendar?season=${event.season}`} className="hover:text-fg">
                Calendário {event.season}
              </Link>{" "}
              ·{" "}
              <Link href={`/results?season=${event.season}`} className="hover:text-fg">
                Resultados
              </Link>{" "}
              / Etapa {event.round}
            </nav>
            <nav aria-label="Etapas vizinhas" className="flex gap-3">
              {prev && (
                <Link href={`/calendar/${prev.season}/${prev.round}`} className="hover:text-fg">
                  ← {prev.name.replace(" Grand Prix", "")}
                </Link>
              )}
              {next && (
                <Link href={`/calendar/${next.season}/${next.round}`} className="hover:text-fg">
                  {next.name.replace(" Grand Prix", "")} →
                </Link>
              )}
            </nav>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge tone="accent">Etapa {event.round}</Badge>
            <Badge tone={statusTone(event.status)}>{EVENT_STATUS_LABEL[event.status]}</Badge>
            {hasSprint && <Badge tone="warn">Fim de semana Sprint</Badge>}
          </div>
          <h1 className="font-display text-4xl font-extrabold uppercase italic tracking-tight sm:text-6xl">
            {event.name}
          </h1>
          <p className="mt-2 text-muted">
            {event.circuitName} · {event.locality}, {event.countryPt}
            {event.timeZone && <span className="text-faint"> · fuso do circuito: {event.timeZone}</span>}
          </p>
          {event.status !== "completed" && (
            <div className="mt-6">
              <NextSessionCountdown sessions={event.sessions.map((s) => ({ label: SESSION_LABEL[s.type], startsAt: s.startsAt }))} />
            </div>
          )}
        </Container>
      </div>

      <Container className="mt-10">
        <SectionHeading kicker="Programação" title="Horários das sessões" />
        <Card className="p-4">
          <SessionTimesTable
            circuitTz={event.timeZone}
            sessions={event.sessions.map((s) => ({ label: SESSION_LABEL[s.type], startsAt: s.startsAt, date: s.date }))}
          />
        </Card>
        <SourceNote>
          Fonte: Jolpica-F1 (UTC). “+1d/−1d” indica que, no fuso exibido, a sessão cai em outro dia do calendário em relação ao circuito.
        </SourceNote>
      </Container>

      <Container className="mt-12">
        <SectionHeading kicker="Dados oficiais publicados" title="Resultados" />
        <nav className="mb-5 flex flex-wrap gap-1.5" aria-label="Sessões">
          {available.map((t) => (
            <Link
              key={t}
              href={`?tab=${t}`}
              aria-current={tab === t ? "page" : undefined}
              className={`rounded-sm border px-3 py-1.5 text-sm ${tab === t ? "border-accent bg-accent-soft" : "border-line text-muted hover:text-fg"}`}
            >
              {TAB_LABEL[t]}
            </Link>
          ))}
        </nav>

        {tab === "race" &&
          (raceR && !raceR.ok ? (
            <ErrorState message={raceR.error} />
          ) : raceR?.ok && raceR.data ? (
            <>
              <ResultsTable columns={RESULT_COLUMNS} rows={resultRows(raceR.data)} caption={`Resultado da corrida — ${event.name}`} filename={`${event.season}-${event.round}-corrida`} />
              <SourceNote>
                Resultado conforme publicado pela fonte em {new Date(raceR.data.fetchedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasília).
                Revisões posteriores dos comissários podem alterar a classificação.
              </SourceNote>
            </>
          ) : (
            <EmptyState title="Resultado ainda não publicado">A fonte oficial ainda não publicou o resultado desta corrida.</EmptyState>
          ))}

        {tab === "sprint" &&
          (sprintR && !sprintR.ok ? (
            <ErrorState message={sprintR.error} />
          ) : sprintR?.ok && sprintR.data ? (
            <ResultsTable columns={RESULT_COLUMNS} rows={resultRows(sprintR.data)} caption={`Resultado da Sprint — ${event.name}`} filename={`${event.season}-${event.round}-sprint`} />
          ) : (
            <EmptyState title="Resultado da Sprint ainda não publicado" />
          ))}

        {tab === "qualifying" &&
          (qualiR && !qualiR.ok ? (
            <ErrorState message={qualiR.error} />
          ) : qualiR?.ok && qualiR.data ? (
            <>
              <ResultsTable
                columns={[
                  { key: "pos", label: "Pos", numeric: true },
                  { key: "number", label: "Nº", numeric: true },
                  { key: "driver", label: "Piloto" },
                  { key: "team", label: "Equipe" },
                  { key: "q1", label: "Q1" },
                  { key: "q2", label: "Q2" },
                  { key: "q3", label: "Q3" },
                ]}
                rows={qualiR.data.rows.map((r) => ({
                  _id: r.driver.id,
                  pos: r.position,
                  number: r.number,
                  driver: driverName(r.driver),
                  team: r.constructor.name,
                  q1: r.q1,
                  q2: r.q2,
                  q3: r.q3,
                }))}
                caption={`Classificação — ${event.name}`}
                filename={`${event.season}-${event.round}-classificacao`}
              />
              <SourceNote>Ordem da classificação. Não é necessariamente o grid de largada: penalidades podem alterar as posições.</SourceNote>
            </>
          ) : (
            <EmptyState title="Classificação ainda não publicada" />
          ))}

        {tab === "grid" &&
          (raceR?.ok && raceR.data ? (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge tone="ok">Confirmado</Badge>
                <span className="text-sm text-muted">Grid efetivo, conforme publicado junto ao resultado oficial da corrida.</span>
              </div>
              <StartingGrid
                slots={raceR.data.rows
                  .filter((r) => r.grid !== null)
                  .map((r) => ({ position: r.grid!, label: driverName(r.driver), team: r.constructor.name, number: r.number }))}
                pitLane={raceR.data.rows
                  .filter((r) => r.pitLaneStart)
                  .map((r) => ({ position: 0, label: driverName(r.driver), team: r.constructor.name, number: r.number }))}
              />
              {qualiR?.ok && qualiR.data && (
                <details className="mt-12">
                  <summary className="cursor-pointer text-sm text-muted">Comparar com a ordem da classificação (antes de penalidades)</summary>
                  <ol className="mt-3 columns-2 text-sm">
                    {qualiR.data.rows.map((q) => (
                      <li key={q.driver.id}>
                        P{q.position} {driverName(q.driver)}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
              <SourceNote>Fonte: Jolpica-F1. Pilotos que não largaram não ocupam posição no grid.</SourceNote>
            </>
          ) : (
            <EmptyState title="Grid oficial indisponível">
              O grid de largada oficial ainda não foi publicado pela fonte de dados integrada. Não exibimos estimativas no lugar do grid
              oficial{qualiR?.ok && qualiR.data ? " — veja a aba Classificação para a ordem da sessão." : "."}
            </EmptyState>
          ))}
      </Container>
    </>
  );
}
