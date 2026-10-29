import type { Metadata } from "next";
import Link from "next/link";
import { SeasonStrip } from "@/components/season-strip";
import { TitleSimulator } from "@/components/title-simulator";
import { Badge, Card, Container, ErrorState, PageHeader, SectionHeading, SourceNote } from "@/components/ui";
import { finishCounts, freshConstructorStandings, freshDriverStandings, type SeasonData } from "@/lib/f1/compare";
import { nationalityFlag } from "@/lib/f1/nationality";
import { pointsSystem } from "@/lib/f1/points";
import type { EntryOutcome, ModelOutput } from "@/lib/f1/probability";
import { driverName, f1, getChampionshipModel, load } from "@/lib/f1/service";
import { teamColor } from "@/lib/f1/team-colors";
import { eliminationTimeline, remainingEvents, titleStatus, type Elimination, type TitleStatus } from "@/lib/f1/title-math";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Título: quem ainda pode ser campeão",
  description:
    "Quem ainda pode ser campeão de pilotos e de construtores da F1, onde o líder pode fechar o título e com quais resultados, simulador e probabilidades.",
  alternates: { canonical: "/championship-probabilities" },
};

function pct(p: number): string {
  if (p === 0) return "0%";
  if (p < 0.001) return "<0,1%";
  if (p > 0.999 && p < 1) return ">99,9%";
  return `${(p * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

const dayMonth = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
const fmt1 = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

type Meta = { subtitle: string; flag: string; color: string };
type Gender = "campeão" | "campeã";

function headline(t: TitleStatus, season: number, label: Gender): { title: string; text: string } | null {
  const leader = t.contenders[0];
  if (!leader) return null;
  if (t.decided) return { title: `${leader.name} é ${label} de ${season}.`, text: "Nenhum rival consegue mais alcançar a pontuação." };
  if (!t.clinch) return null;
  const ev = t.clinch.event;
  const when = `${ev.flag} ${ev.name}${ev.date ? ` · ${dayMonth.format(new Date(`${ev.date}T12:00:00Z`))}` : ""}`;
  if (!t.clinch.isNext)
    return { title: `${leader.name} pode ser ${label} a partir do ${when}.`, text: "No melhor cenário: somando o máximo em cada etapa, com os rivais sem pontuar." };
  return { title: `${leader.name} pode ser ${label} já no ${when}.`, text: t.clinch.conditions.join(" ") };
}

function LeaderDetail({ t, label }: { t: TitleStatus; label: Gender }) {
  if (!t.clinch) return <span>Ainda não dá para fechar o título com as etapas restantes.</span>;
  const c = t.clinch;
  return (
    <details>
      <summary className="cursor-pointer">
        Pode fechar o título já em:{" "}
        <strong className="text-fg">
          {c.event.flag} {c.event.name}
        </strong>
      </summary>
      <div className="mt-2 rounded border border-line bg-elev-2 p-3 text-sm text-fg">
        {c.isNext ? (
          <>
            <p className="mb-1">
              {label === "campeão" ? "Campeão" : "Campeã"} já no {c.event.name}:
            </p>
            <ul className="space-y-0.5">
              {c.conditions.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            {c.then && (
              <p className="mt-2 text-muted">
                Se não fechar lá, dá para fechar no {c.then.event.flag} {c.then.event.name}, saindo de lá com mais de {c.then.leadNeeded} pts de
                vantagem sobre cada rival.
              </p>
            )}
          </>
        ) : (
          <p>No melhor cenário — somando o máximo em cada etapa, com os rivais sem pontuar —, o título pode ser confirmado no {c.event.name}.</p>
        )}
      </div>
    </details>
  );
}

function ContenderList({
  t,
  meta,
  chance,
  label,
  eliminated,
}: {
  t: TitleStatus;
  meta: Map<string, Meta>;
  chance: Map<string, number>;
  label: Gender;
  eliminated: Elimination[];
}) {
  const alive = t.contenders.filter((c) => c.alive);
  const scale = Math.max(...alive.map((c) => c.maxPossible), 1);
  const leader = t.contenders[0];
  const out = t.contenders.filter((c) => !c.alive);
  // Lista = exatamente quem está fora pela regra da página; a etapa vem da linha do tempo, quando conhecida.
  const when = new Map(eliminated.map((e, i) => [e.id, { raceName: e.raceName, order: i }]));
  const outList = out
    .map((c) => ({ id: c.id, name: c.name, raceName: when.get(c.id)?.raceName ?? null, order: when.get(c.id)?.order ?? -1 }))
    .sort((a, b) => b.order - a.order);
  const lastOut = outList.find((x) => x.raceName !== null) ?? null;
  return (
    <div>
      <ul className="divide-y divide-line">
        {alive.map((c) => {
          const m = meta.get(c.id);
          const raw = chance.get(c.id);
          // Ainda vivo pela matemática: nunca "0%" nem "100%" — o modelo só arredonda.
          const p = raw === undefined ? undefined : alive.length > 1 ? Math.min(Math.max(raw, 0.0009), 0.9991) : raw;
          return (
            <li key={c.id} className="py-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 h-9 w-[3px] shrink-0 rounded-full" style={{ background: m?.color }} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {m?.flag && <span aria-hidden="true">{m.flag} </span>}
                    {c.name}
                  </p>
                  {m?.subtitle && <p className="text-xs text-muted">{m.subtitle}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <span className="font-display text-xl font-bold tabular">{c.points}</span> <span className="text-xs text-faint">pts</span>
                  <span className="ml-3 text-sm tabular text-muted">{c === leader ? "líder" : `−${c.gap}`}</span>
                  {p !== undefined && (
                    <span className="ml-2 rounded bg-elev-2 px-1.5 py-0.5 text-xs font-semibold tabular" title="Chance estimada pelo modelo">
                      {pct(p)}
                    </span>
                  )}
                </div>
              </div>
              {/* Pontos de hoje (cheio), máximo possível (claro) e a linha dos pontos do líder. */}
              <div className="relative mt-3 h-2 rounded bg-elev-2" aria-hidden="true">
                <div className="absolute inset-y-0 left-0 rounded opacity-35" style={{ width: `${(c.maxPossible / scale) * 100}%`, background: m?.color }} />
                <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${(c.points / scale) * 100}%`, background: m?.color }} />
                {leader && <div className="absolute -top-1 h-4 w-0.5 bg-fg" style={{ left: `${(leader.points / scale) * 100}%` }} />}
              </div>
              <div className="mt-2 text-xs text-muted">
                {c === leader ? (
                  <LeaderDetail t={t} label={label} />
                ) : (
                  <span>
                    Precisa descontar <strong className="text-fg">{c.perRace !== null ? fmt1(c.perRace) : "—"}</strong> pts por corrida · Máx. {c.maxPossible} pts
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {out.length > 0 && (
        <details className="border-t border-line pt-3 text-sm text-muted">
          <summary className="cursor-pointer">
            Fora da disputa: {out.length}
            {lastOut && (
              <>
                {" "}
                · último a sair: <strong className="text-fg">{lastOut.name}</strong> ({lastOut.raceName})
              </>
            )}
          </summary>
          <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {outList.map((e) => (
              <li key={e.id}>
                {e.name}
                {e.raceName && <span className="text-faint"> · {e.raceName}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ProbTable({ rows, kind, model, showNumbers }: { rows: EntryOutcome[]; kind: "Piloto" | "Equipe"; model: ModelOutput; showNumbers: boolean }) {
  return (
    <Card className="overflow-x-auto">
      <table className="data-table">
        <caption className="sr-only">Probabilidade estimada de título por {kind.toLowerCase()}</caption>
        <thead>
          <tr>
            <th scope="col">{kind}</th>
            <th scope="col" className="num">Pontos</th>
            <th scope="col">Chance matemática</th>
            <th scope="col">Probabilidade estimada</th>
            <th scope="col" className="num">Pontos finais (P10–P90)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <th scope="row" className="text-left font-medium normal-case tracking-normal text-fg">
                {r.name}
              </th>
              <td className="num">{r.currentPoints}</td>
              <td>{r.mathematicallyAlive ? <Badge tone="ok">Possível</Badge> : <Badge>Eliminado</Badge>}</td>
              <td className="min-w-[220px]">
                {showNumbers ? (
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded bg-elev-2" aria-hidden="true">
                      <div className="h-2 rounded bg-accent" style={{ width: `${Math.max(r.titleProbability * 100, r.titleProbability > 0 ? 0.8 : 0)}%` }} />
                    </div>
                    <span className="w-16 text-right font-semibold tabular">{pct(r.titleProbability)}</span>
                  </div>
                ) : (
                  <span className="text-faint">não exibida</span>
                )}
              </td>
              <td className="num text-muted">
                {Math.round(r.p10FinalPoints)}–{Math.round(r.p90FinalPoints)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-2 text-xs text-faint">
        Erro de amostragem de Monte Carlo ≤ ±{(Math.max(...rows.map((r) => r.monteCarloSe)) * 196).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} p.p. (95%). Esse valor NÃO
        mede a incerteza do modelo — apenas o ruído das {model.assumptions.simulations.toLocaleString("pt-BR")} simulações.
      </p>
    </Card>
  );
}

export default async function TitlePage() {
  const thisYear = new Date().getUTCFullYear();
  const [r, eventsR, dsR, csR, racesR, sprintsR] = await Promise.all([
    load(getChampionshipModel(thisYear)),
    load(f1.getSchedule(thisYear)),
    load(f1.getDriverStandings(thisYear)),
    load(f1.getConstructorStandings(thisYear)),
    load(f1.getSeasonResults(thisYear, "race")),
    load(f1.getSeasonResults(thisYear, "sprint")),
  ]);

  const data: SeasonData = { races: racesR.ok ? racesR.data : [], sprints: sprintsR.ok ? sprintsR.data : [], qualis: [] };
  const sys = pointsSystem(thisYear);
  const remaining = eventsR.ok ? remainingEvents(eventsR.data, data) : [];
  const ds = dsR.ok ? freshDriverStandings(dsR.data, data).rows : [];
  const cs = csR.ok ? freshConstructorStandings(csR.data, data).rows : [];
  // Sem os resultados, "o que falta" seria o calendário inteiro: melhor não mostrar contas erradas.
  const ready = eventsR.ok && dsR.ok && csR.ok && racesR.ok && sprintsR.ok;
  const drivers = ready
    ? titleStatus({ kind: "driver", sys, remaining, standings: ds.map((x) => ({ id: x.driver.id, name: driverName(x.driver), points: x.points, wins: x.wins })) })
    : null;
  const teams = ready
    ? titleStatus({ kind: "team", sys, remaining, standings: cs.map((x) => ({ id: x.constructor.id, name: x.constructor.name, points: x.points, wins: x.wins })) })
    : null;

  const driverMeta = new Map<string, Meta>(
    ds.map((x) => {
      const team = x.constructors.at(-1);
      return [x.driver.id, { subtitle: team?.name ?? "", flag: nationalityFlag(x.driver.nationality), color: teamColor(team?.id ?? "") }];
    }),
  );
  const teamDrivers = new Map<string, string[]>();
  for (const x of ds) {
    const id = x.constructors.at(-1)?.id;
    if (id) teamDrivers.set(id, [...(teamDrivers.get(id) ?? []), x.driver.familyName]);
  }
  const teamMeta = new Map<string, Meta>(
    cs.map((x) => [x.constructor.id, { subtitle: (teamDrivers.get(x.constructor.id) ?? []).slice(0, 2).join(", "), flag: "", color: teamColor(x.constructor.id) }]),
  );
  const driverOut = eventsR.ok ? eliminationTimeline({ kind: "driver", sys, data, events: eventsR.data }) : [];
  const teamOut = eventsR.ok ? eliminationTimeline({ kind: "team", sys, data, events: eventsR.data }) : [];
  const chanceD = new Map(r.ok ? r.data.drivers.map((d) => [d.id, d.titleProbability] as const) : []);
  const chanceT = new Map(r.ok ? r.data.constructors.map((d) => [d.id, d.titleProbability] as const) : []);
  const heads = [drivers && headline(drivers, thisYear, "campeão"), teams && headline(teams, thisYear, "campeã")].filter((h): h is { title: string; text: string } => Boolean(h));
  const finishes = finishCounts(data);
  const simContenders = (drivers?.contenders.filter((c) => c.alive) ?? []).slice(0, 4).map((c) => {
    const row = ds.find((x) => x.driver.id === c.id);
    return {
      id: c.id,
      name: c.name,
      code: row?.driver.code ?? c.name.slice(0, 3).toUpperCase(),
      points: c.points,
      wins: c.wins,
      finishes: finishes.get(c.id) ?? [],
      color: driverMeta.get(c.id)?.color ?? "",
    };
  });
  const sprintsLeft = remaining.filter((e) => e.sprint).length;

  const m = r.ok ? r.data : null;
  const showNumbers = m ? !m.warnings.some((w) => w.includes("não devem ser exibidas")) : false;

  return (
    <>
      <SeasonStrip />
      <PageHeader kicker={`Temporada ${thisYear}`} title="Quem ainda pode ser campeão">
        {drivers ? (
          <>
            Restam {drivers.racesLeft} {drivers.racesLeft === 1 ? "corrida" : "corridas"}
            {sprintsLeft > 0 ? ` e ${sprintsLeft} ${sprintsLeft === 1 ? "sprint" : "sprints"}` : ""}. Contas exatas, com a pontuação de cada etapa.{" "}
            {simContenders.length >= 2 && remaining.length > 0 && (
              <a href="#simulador" className="underline">
                Simule o resto da temporada ↓
              </a>
            )}
          </>
        ) : (
          "Contas exatas de quem ainda pode ser campeão, simulador e probabilidades estimadas."
        )}
      </PageHeader>

      <Container className="mt-8">
        {!drivers || !teams ? (
          <ErrorState
            message={
              !eventsR.ok ? eventsR.error : !dsR.ok ? dsR.error : !csR.ok ? csR.error : !racesR.ok ? racesR.error : !sprintsR.ok ? sprintsR.error : "Dados indisponíveis."
            }
          />
        ) : (
          <>
            {heads.length > 0 && (
              <div className="mb-8 rounded-md border border-line border-l-4 border-l-accent bg-elev p-4">
                {heads.map((h) => (
                  <div key={h.title} className="mb-2 last:mb-0">
                    <p className="font-semibold">{h.title}</p>
                    <p className="text-sm text-muted">{h.text}</p>
                  </div>
                ))}
              </div>
            )}
            <p className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-faint">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-6 rounded bg-muted" /> pontos hoje
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-6 rounded bg-muted opacity-35" /> máximo possível
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-0.5 bg-fg" /> pontos do líder
              </span>
              <span>Quem não alcança a linha está fora.</span>
            </p>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-5">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-display text-2xl font-bold uppercase">Pilotos</h2>
                  <p className="text-right text-xs text-muted">até {drivers.maxInPlay} pts em jogo</p>
                </div>
                <ContenderList t={drivers} meta={driverMeta} chance={chanceD} label="campeão" eliminated={driverOut} />
              </Card>
              <Card className="p-5">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-display text-2xl font-bold uppercase">Equipes</h2>
                  <p className="text-right text-xs text-muted">até {teams.maxInPlay} pts em jogo</p>
                </div>
                <ContenderList t={teams} meta={teamMeta} chance={chanceT} label="campeã" eliminated={teamOut} />
              </Card>
            </div>
            <SourceNote>
              &quot;Já em&quot; supõe o melhor cenário para o líder. Máximo por etapa: {sys.race[0]} pts por corrida e {sys.sprint[0] ?? 0} por sprint para
              pilotos; {(sys.race[0] ?? 0) + (sys.race[1] ?? 0)} e {(sys.sprint[0] ?? 0) + (sys.sprint[1] ?? 0)} para equipes (dobradinha). Empate em pontos:
              decide o número de vitórias; se nem isso garante, consideramos o título ainda em aberto. A porcentagem ao lado de cada nome é a estimativa
              do modelo (abaixo).
            </SourceNote>

            {simContenders.length >= 2 && remaining.length > 0 && (
              <section id="simulador" className="mt-12 scroll-mt-24" aria-labelledby="sim-title">
                <SectionHeading id="sim-title" kicker="Pilotos" title="Simulador: e se…?" />
                <p className="mb-4 text-sm text-muted">Escolha a posição de cada um nas etapas que faltam e veja quem termina campeão.</p>
                <TitleSimulator
                  contenders={simContenders}
                  events={remaining.map((e) => ({ round: e.round, name: e.name, flag: e.flag, sprint: e.sprint }))}
                  race={sys.race}
                  sprint={sys.sprint}
                />
              </section>
            )}
          </>
        )}

        <section id="probabilidades" className="mt-16 scroll-mt-24" aria-labelledby="prob-title">
          <SectionHeading id="prob-title" kicker={m ? `Modelo ${m.modelVersion} · experimental` : "Modelo experimental"} title="Probabilidade estimada" />
          {!m ? (
            <ErrorState message={r.ok ? "" : r.error} />
          ) : (
            <>
              <p className="mb-4 max-w-3xl text-sm text-muted">
                Estimativas estatísticas, não previsões certas. A chance <strong>matemática</strong> diz se o título ainda é possível pelos pontos
                em disputa; a probabilidade <strong>estimada</strong> depende das hipóteses do modelo descritas abaixo.
              </p>
              <div className="mb-6 flex flex-wrap gap-2 text-xs">
                <Badge tone="warn">Experimental · ainda sem backtest publicado</Badge>
                <Badge>Base: após a etapa {m.basedOnRound}</Badge>
                <Badge>
                  {m.remainingRaces} corridas e {m.remainingSprints} sprints restantes
                </Badge>
                <Badge>{m.assumptions.simulations.toLocaleString("pt-BR")} simulações</Badge>
                <Badge>Gerado em {new Date(m.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasília)</Badge>
              </div>

              {m.warnings.length > 0 && (
                <div role="note" className="mb-6 rounded-md border border-warn/50 bg-warn/5 p-4 text-sm">
                  <strong className="text-warn">Atenção:</strong>
                  <ul className="mt-1 list-disc pl-5 text-muted">
                    {m.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <h3 className="mb-3 font-display text-xl font-bold uppercase">Pilotos</h3>
              <ProbTable
                rows={m.drivers.filter((d) => d.mathematicallyAlive || d.titleProbability > 0).slice(0, 12)}
                kind="Piloto"
                model={m}
                showNumbers={showNumbers}
              />

              <h3 className="mb-3 mt-10 font-display text-xl font-bold uppercase">Construtores</h3>
              <ProbTable rows={m.constructors.filter((d) => d.mathematicallyAlive || d.titleProbability > 0)} kind="Equipe" model={m} showNumbers={showNumbers} />

              <div className="mt-12 grid gap-6 lg:grid-cols-2">
                <Card className="p-5">
                  <h3 className="mb-3 font-display text-xl font-bold uppercase">Hipóteses desta versão</h3>
                  <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
                    <li>
                      Força de cada piloto estimada por um modelo de Plackett-Luce sobre as corridas da temporada, com peso maior para resultados
                      recentes (meia-vida de {m.assumptions.recencyHalfLife} corridas).
                    </li>
                    <li>
                      Encolhimento de {Math.round(m.assumptions.teamShrinkage * 100)}% em direção à média da equipe: o carro explica parte do
                      desempenho.
                    </li>
                    <li>
                      Choque de desempenho por corrida compartilhado entre companheiros de equipe (σ = {m.assumptions.teamShockSd}) mais choque
                      individual (σ = {m.assumptions.driverShockSd}) — resultados no mesmo GP não são tratados como independentes.
                    </li>
                    <li>
                      Abandono com taxa própria de cada piloto na temporada, suavizada por um prior Beta({m.assumptions.dnfPrior.a},
                      {m.assumptions.dnfPrior.b}).
                    </li>
                    <li>Pontuação da temporada {m.season}; desempate de pilotos por número de vitórias, 2º lugares etc.</li>
                  </ul>
                </Card>
                <Card className="p-5">
                  <h3 className="mb-3 font-display text-xl font-bold uppercase">Limitações conhecidas</h3>
                  <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
                    <li>Não considera características de circuitos, atualizações de carro, clima ou penalidades futuras.</li>
                    <li>Sprints usam a mesma força estimada das corridas principais.</li>
                    <li>Mudanças de piloto ao longo da temporada não são previstas.</li>
                    <li>O modelo ainda não foi validado por backtest (Brier score, calibração) — previsto na próxima fase.</li>
                    <li>Muitas simulações reduzem o ruído numérico, mas não corrigem hipóteses erradas.</li>
                  </ul>
                </Card>
              </div>
              <SourceNote>
                Dados de entrada: classificação e resultados oficiais publicados na Jolpica-F1. Metodologia completa em{" "}
                <Link href="/methodology" className="underline">
                  /methodology
                </Link>
                . Semente {m.assumptions.seed} (resultados reprodutíveis).
              </SourceNote>
            </>
          )}
        </section>
      </Container>
    </>
  );
}
