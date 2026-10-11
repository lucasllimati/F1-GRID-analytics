import type { Metadata } from "next";
import Link from "next/link";
import { RoundBars, TrendChart, type ChartSeries } from "@/components/charts";
import { Card, Container, EmptyState, ErrorState, PageHeader, SectionHeading, SourceNote } from "@/components/ui";
import {
  analyzeEntity,
  championshipPositions,
  headToHead,
  seasonRounds,
  seasonEntities,
  teammateDuels,
  type EntityAnalysis,
  type EntityKind,
  type SeasonData,
  type Summary,
} from "@/lib/f1/compare";
import { f1, load } from "@/lib/f1/service";
import { OUTCOME_LABEL } from "@/lib/f1/types";

export const revalidate = 900;
export const metadata: Metadata = {
  title: "Comparar pilotos e equipes",
  description: "Compare pilotos e equipes da Fórmula 1: pontos, posição no campeonato, corridas, sprints e classificações etapa a etapa.",
  alternates: { canonical: "/head-to-head" },
};

const MAX = 4;

type SP = { season?: string; kind?: string; id?: string | string[] };

const fmt1 = (v: number | null) => (v === null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));

type Metric = { label: string; get: (s: Summary) => number | null; better: "high" | "low"; format?: (v: number | null) => string; help?: string };

const METRICS: Metric[] = [
  { label: "Pontos", get: (s) => s.points, better: "high" },
  { label: "Vitórias", get: (s) => s.wins, better: "high" },
  { label: "Pódios", get: (s) => s.podiums, better: "high" },
  { label: "Poles", get: (s) => s.poles, better: "high", help: "1º na classificação (antes de penalidades)" },
  { label: "Chegadas no top 10", get: (s) => s.top10, better: "high" },
  { label: "Presenças no Q3", get: (s) => s.q3, better: "high" },
  { label: "Voltas mais rápidas", get: (s) => s.fastestLaps, better: "high" },
  { label: "Pontos em sprints", get: (s) => s.sprintPoints, better: "high" },
  { label: "Vitórias em sprints", get: (s) => s.sprintWins, better: "high" },
  { label: "Melhor chegada", get: (s) => s.bestFinish, better: "low", format: (v) => (v === null ? "—" : `P${v}`) },
  { label: "Chegada média", get: (s) => s.avgFinish, better: "low", format: fmt1, help: "só provas terminadas classificado" },
  { label: "Classificação média", get: (s) => s.avgQuali, better: "low", format: fmt1 },
  { label: "Posições ganhas (largada → chegada)", get: (s) => s.positionsGained, better: "high", format: (v) => (v === null ? "—" : `${v > 0 ? "+" : ""}${v}`) },
  { label: "Abandonos / não classificado", get: (s) => s.dnfs, better: "low" },
  { label: "Largadas", get: (s) => s.starts, better: "high" },
  { label: "Pontos nas últimas 5 etapas", get: (s) => s.formLast5, better: "high" },
];

const TREND: Record<Summary["trend"]["direction"], { icon: string; label: string; cls: string }> = {
  alta: { icon: "▲", label: "Em alta", cls: "text-ok" },
  estavel: { icon: "▬", label: "Estável", cls: "text-muted" },
  queda: { icon: "▼", label: "Em queda", cls: "text-accent" },
  indefinida: { icon: "·", label: "Amostra curta", cls: "text-faint" },
};

function qs(p: { season: number; kind: EntityKind; ids: string[] }) {
  const u = new URLSearchParams({ season: String(p.season), kind: p.kind });
  for (const id of p.ids) u.append("id", id);
  return `/head-to-head?${u.toString()}`;
}

export default async function HeadToHeadPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const thisYear = new Date().getUTCFullYear();
  const season = /^\d{4}$/.test(sp.season ?? "") ? Math.min(Math.max(Number(sp.season), 2010), thisYear) : thisYear;
  const kind: EntityKind = sp.kind === "team" ? "team" : "driver";

  const [racesR, sprintsR, qualisR] = await Promise.all([
    load(f1.getSeasonResults(season, "race")),
    load(f1.getSeasonResults(season, "sprint")),
    load(f1.getSeasonQualifying(season)),
  ]);

  const header = (
    <PageHeader kicker={`Temporada ${season}`} title="Comparar">
      Escolha até {MAX} {kind === "driver" ? "pilotos" : "equipes"} e compare pontos, posição no campeonato e resultados em corridas, sprints
      e classificações, etapa a etapa. Tudo calculado a partir de resultados oficiais publicados.
    </PageHeader>
  );

  if (!racesR.ok) {
    return (
      <>
        {header}
        <Container className="mt-8">
          <ErrorState message={racesR.error} />
        </Container>
      </>
    );
  }

  const data: SeasonData = {
    races: racesR.data,
    sprints: sprintsR.ok ? sprintsR.data : [],
    qualis: qualisR.ok ? qualisR.data : [],
  };
  const entities = seasonEntities(data, kind);
  const requested = (Array.isArray(sp.id) ? sp.id : sp.id ? [sp.id] : []).filter((id) => entities.some((e) => e.id === id));
  const ids = [...new Set(requested)].slice(0, MAX);
  const selected = ids.length > 0 ? ids : entities.slice(0, 2).map((e) => e.id);
  const champ = championshipPositions(data, kind);
  const analyses = selected.map((id) => analyzeEntity(data, kind, id, champ)).filter((a): a is EntityAnalysis => a !== null);

  const allRounds = seasonRounds(data);
  const rounds = allRounds.map((r) => r.round);
  const xLabels = rounds.map((r) => `E${r}`);
  const xTitles = allRounds.map((r) => r.raceName.replace(" Grand Prix", "") + (r.hasRace ? "" : " (corrida sem resultado ainda)"));
  const series = (get: (a: EntityAnalysis, i: number) => number | null, note?: (a: EntityAnalysis, i: number) => string | null): ChartSeries[] =>
    analyses.map((a, slot) => ({
      id: a.id,
      // Piloto: sobrenome (cabe no rótulo direto); equipe: nome completo ("Red Bull", não "Bull").
      label: kind === "driver" ? (a.name.split(" ").slice(-1)[0] ?? a.name) : a.name,
      slot,
      values: a.rounds.map((_, i) => get(a, i)),
      notes: note ? a.rounds.map((_, i) => note(a, i)) : undefined,
    }));

  const sprintIdx = allRounds.map((r, i) => (r.hasSprint ? i : -1)).filter((i) => i >= 0);
  const sprintSeries = series((a, i) => a.rounds[i]!.sprintPos).map((s) => ({ ...s, values: sprintIdx.map((i) => s.values[i] ?? null) }));
  const h2h = analyses.length >= 2 ? headToHead(analyses[0]!, analyses[1]!) : null;
  const duels = kind === "driver" ? teammateDuels(data) : [];
  const lastRound = rounds[rounds.length - 1];

  return (
    <>
      {header}
      <Container className="mt-8">
        {/* ── Seletor ── */}
        <form method="get" action="/head-to-head" className="mb-10 rounded-md border border-line bg-elev p-4">
          <div className="mb-3 flex flex-wrap items-end gap-4">
            <label className="text-xs text-muted">
              Temporada
              <input
                name="season"
                inputMode="numeric"
                pattern="\d{4}"
                defaultValue={season}
                className="ml-2 w-20 rounded border border-line bg-bg px-2 py-1 text-sm text-fg"
              />
            </label>
            <div className="flex gap-1.5" role="group" aria-label="Comparar">
              {(["driver", "team"] as const).map((k) => (
                <Link
                  key={k}
                  href={qs({ season, kind: k, ids: [] })}
                  aria-current={kind === k ? "page" : undefined}
                  className={`rounded-sm border px-3 py-1 text-sm ${kind === k ? "border-accent bg-accent-soft" : "border-line text-muted hover:text-fg"}`}
                >
                  {k === "driver" ? "Pilotos" : "Equipes"}
                </Link>
              ))}
            </div>
            <input type="hidden" name="kind" value={kind} />
          </div>
          <fieldset>
            <legend className="mb-2 text-xs text-muted">
              Selecione até {MAX} (as cores seguem a ordem desta lista). {requested.length > MAX && <strong className="text-warn">Só os {MAX} primeiros foram usados.</strong>}
            </legend>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
              {entities.map((e) => (
                <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-elev-2">
                  <input type="checkbox" name="id" value={e.id} defaultChecked={selected.includes(e.id)} className="accent-[var(--accent)]" />
                  <span>
                    {e.name}
                    {e.subtitle && <span className="ml-1 text-xs text-faint">{e.subtitle}</span>}
                  </span>
                  <span className="ml-auto text-xs tabular text-faint">{e.points} pts</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button className="mt-4 rounded bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong">Comparar</button>
        </form>

        {analyses.length === 0 ? (
          <EmptyState title="Nada para comparar">Não há resultados publicados para esta temporada.</EmptyState>
        ) : (
          <>
            {/* ── Cartões-resumo ── */}
            <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {analyses.map((a, slot) => {
                const t = TREND[a.summary.trend.direction];
                const lastChamp = a.rounds[a.rounds.length - 1]?.champPos;
                return (
                  <Card key={a.id} className="relative overflow-hidden p-4">
                    <span className="absolute inset-x-0 top-0 h-1" style={{ background: `var(--series-${slot + 1})` }} aria-hidden="true" />
                    <p className="font-display text-xl font-bold uppercase leading-tight">{a.name}</p>
                    <p className="text-xs text-faint">{a.subtitle}</p>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <dt className="text-[0.6rem] uppercase tracking-widest text-faint">Pontos</dt>
                        <dd className="font-display text-2xl font-bold tabular">{a.summary.points}</dd>
                      </div>
                      <div>
                        <dt className="text-[0.6rem] uppercase tracking-widest text-faint">Campeonato</dt>
                        <dd className="font-display text-2xl font-bold tabular">{lastChamp ? `P${lastChamp}` : "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-[0.6rem] uppercase tracking-widest text-faint">Vitórias</dt>
                        <dd className="font-display text-2xl font-bold tabular">{a.summary.wins}</dd>
                      </div>
                    </dl>
                    <p className={`mt-3 text-xs ${t.cls}`}>
                      <span aria-hidden="true">{t.icon}</span> {t.label}
                      {a.summary.trend.earlierAvg !== null && (
                        <span className="text-faint">
                          {" "}
                          · {fmt1(a.summary.trend.recentAvg)} pts/etapa nas últimas 5 vs. {fmt1(a.summary.trend.earlierAvg)} antes
                        </span>
                      )}
                    </p>
                  </Card>
                );
              })}
            </div>

            {/* ── Gráficos ── */}
            <div className="grid gap-10">
              <Card className="p-4 sm:p-6">
                <TrendChart
                  title="Pontos acumulados"
                  caption="Soma de pontos de corridas e sprints após cada etapa."
                  series={series((a, i) => a.rounds[i]!.cumulative)}
                  xLabels={xLabels}
                  xTitles={xTitles}
                />
              </Card>
              <Card className="p-4 sm:p-6">
                <TrendChart
                  title="Posição no campeonato"
                  caption="Recalculada após cada etapa a partir dos resultados publicados, com o desempate oficial (vitórias, 2º lugares…). 1º no topo."
                  series={series((a, i) => a.rounds[i]!.champPos)}
                  xLabels={xLabels}
                  xTitles={xTitles}
                  invert
                  format="position"
                />
              </Card>
              <Card className="p-4 sm:p-6">
                <RoundBars
                  title="Pontos por etapa"
                  caption="Corrida + sprint de cada fim de semana."
                  series={series((a, i) => a.rounds[i]!.points)}
                  xLabels={xLabels}
                  xTitles={xTitles}
                />
              </Card>
              <div className="grid gap-10">
                <Card className="p-4 sm:p-6">
                  <TrendChart
                    title="Chegada nas corridas"
                    caption={`Posição final classificada${kind === "team" ? " do melhor carro" : ""}. Interrupção na linha = não classificado (motivo no tooltip).`}
                    series={series(
                      (a, i) => a.rounds[i]!.racePos,
                      (a, i) => {
                        const r = a.rounds[i]!;
                        if (!r.participated) return "não participou";
                        return r.racePos === null && r.raceOutcome ? OUTCOME_LABEL[r.raceOutcome] : null;
                      },
                    )}
                    xLabels={xLabels}
                    xTitles={xTitles}
                    invert
                    format="position"
                  />
                </Card>
                <Card className="p-4 sm:p-6">
                  <TrendChart
                    title="Classificação (qualifying)"
                    caption={`Posição na sessão de classificação${kind === "team" ? " do melhor carro" : ""}, antes de penalidades de grid.`}
                    series={series((a, i) => a.rounds[i]!.qualiPos)}
                    xLabels={xLabels}
                    xTitles={xTitles}
                    invert
                    format="position"
                  />
                </Card>
              </div>
              {sprintIdx.length > 0 && (
                <Card className="p-4 sm:p-6">
                  <TrendChart
                    title="Chegada nas sprints"
                    caption="Somente fins de semana com corrida sprint."
                    series={sprintSeries}
                    xLabels={sprintIdx.map((i) => xLabels[i]!)}
                    xTitles={sprintIdx.map((i) => xTitles[i]!)}
                    invert
                    format="position"
                  />
                </Card>
              )}
            </div>

            {/* ── Confronto direto ── */}
            {h2h && (
              <section className="mt-12" aria-labelledby="h2h">
                <SectionHeading id="h2h" kicker={`${analyses[0]!.name} × ${analyses[1]!.name}`} title="Confronto direto" />
                <div className="grid gap-4 md:grid-cols-3">
                  {(
                    [
                      ["Corridas", h2h.raceAhead, "terminou à frente (classificado vence não classificado)"],
                      ["Classificações", h2h.qualiAhead, "melhor posição na sessão"],
                      ["Sprints", h2h.sprintAhead, "terminou à frente"],
                    ] as const
                  ).map(([label, [a, b], help]) => {
                    const total = a + b;
                    return (
                      <Card key={label} className="p-4">
                        <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
                        <p className="mt-1 font-display text-3xl font-bold tabular">
                          {a} <span className="text-faint">×</span> {b}
                        </p>
                        {total > 0 && (
                          <div className="mt-2 flex h-2 overflow-hidden rounded" aria-hidden="true">
                            <div style={{ width: `${(a / total) * 100}%`, background: "var(--series-1)" }} />
                            <div className="w-0.5 bg-elev" />
                            <div style={{ width: `${(b / total) * 100}%`, background: "var(--series-2)" }} />
                          </div>
                        )}
                        <p className="mt-2 text-xs text-faint">
                          {kind === "driver" ? analyses[0]!.name.split(" ").slice(-1) : analyses[0]!.name} ×{" "}
                          {kind === "driver" ? analyses[1]!.name.split(" ").slice(-1) : analyses[1]!.name} · {help}
                        </p>
                      </Card>
                    );
                  })}
                </div>
                <p className="mt-3 text-sm text-muted">
                  Diferença de pontos: <strong className="text-fg">{h2h.pointsDiff > 0 ? "+" : ""}{h2h.pointsDiff}</strong> para{" "}
                  {h2h.pointsDiff >= 0 ? analyses[0]!.name : analyses[1]!.name}.
                </p>
              </section>
            )}

            {/* ── Tabela de estatísticas ── */}
            <section className="mt-12" aria-labelledby="stats">
              <SectionHeading id="stats" title="Estatísticas da temporada" />
              <Card className="overflow-x-auto">
                <table className="data-table">
                  <caption className="sr-only">Comparação de estatísticas. O melhor valor de cada linha está em negrito e marcado com ▲.</caption>
                  <thead>
                    <tr>
                      <th scope="col">Métrica</th>
                      {analyses.map((a) => (
                        <th scope="col" key={a.id} className="num">
                          {a.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {METRICS.map((m) => {
                      const vals = analyses.map((a) => m.get(a.summary));
                      const valid = vals.filter((v): v is number => v !== null);
                      const best = valid.length ? (m.better === "high" ? Math.max(...valid) : Math.min(...valid)) : null;
                      const unique = valid.filter((v) => v === best).length === 1;
                      return (
                        <tr key={m.label}>
                          <th scope="row" className="text-left font-normal normal-case tracking-normal text-sm text-fg">
                            {m.label}
                            {m.help && <span className="block text-xs text-faint">{m.help}</span>}
                          </th>
                          {vals.map((v, i) => {
                            const isBest = unique && v === best && analyses.length > 1;
                            return (
                              <td key={analyses[i]!.id} className={`num ${isBest ? "font-bold text-fg" : "text-muted"}`}>
                                {isBest && <span aria-label="melhor">▲ </span>}
                                {m.format ? m.format(v) : (v ?? "—")}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    {kind === "team" && (
                      <tr>
                        <th scope="row" className="text-left font-normal normal-case tracking-normal text-sm text-fg">
                          Provas com os dois carros no top 10
                        </th>
                        {analyses.map((a) => (
                          <td key={a.id} className="num text-muted">
                            {a.summary.doublePoints ?? "—"}
                          </td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
              </Card>
            </section>
          </>
        )}

        {/* ── Duelo de companheiros ── */}
        {duels.length > 0 && (
          <section className="mt-12" aria-labelledby="duels">
            <SectionHeading id="duels" kicker="Mesmo carro, quem anda mais?" title="Duelo de companheiros" />
            <Card className="overflow-x-auto">
              <table className="data-table">
                <caption className="sr-only">Duelo entre companheiros de equipe: classificações e corridas à frente, e pontos.</caption>
                <thead>
                  <tr>
                    <th scope="col">Equipe</th>
                    <th scope="col">Dupla</th>
                    <th scope="col" className="num">Classificação</th>
                    <th scope="col" className="num">Corrida</th>
                    <th scope="col" className="num">Pontos</th>
                  </tr>
                </thead>
                <tbody>
                  {duels.map((d) => (
                    <tr key={d.team + d.drivers.join()}>
                      <td className="font-medium">{d.team}</td>
                      <td>
                        {d.drivers[0]} <span className="text-faint">×</span> {d.drivers[1]}
                      </td>
                      <td className="num tabular">
                        {d.quali[0]} × {d.quali[1]}
                      </td>
                      <td className="num tabular">
                        {d.race[0]} × {d.race[1]}
                      </td>
                      <td className="num tabular">
                        {d.points[0]} × {d.points[1]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <p className="mt-2 text-xs text-faint">
              Considera a dupla que mais correu junta em cada equipe. Corrida: conta quando ao menos um terminou classificado.
            </p>
          </section>
        )}

        <SourceNote>
          Fonte: resultados oficiais de corridas, sprints e classificações publicados na Jolpica-F1
          {lastRound ? ` (até a etapa ${lastRound})` : ""}. Tendência compara a média de pontos por etapa nas últimas 5 com a média anterior; variação
          menor que 15% é considerada estável. Posição no campeonato recalculada a partir dos resultados e pode divergir da oficial em casos de
          pontos retirados por decisão posterior.
          {!qualisR.ok && " Classificações indisponíveis no momento."}
        </SourceNote>
      </Container>
    </>
  );
}
