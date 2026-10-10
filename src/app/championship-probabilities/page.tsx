import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, Container, ErrorState, PageHeader, SectionHeading, SourceNote } from "@/components/ui";
import type { EntryOutcome, ModelOutput } from "@/lib/f1/probability";
import { getChampionshipModel, load } from "@/lib/f1/service";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Probabilidades de título",
  description: "Probabilidade estimada de título de pilotos e construtores por simulação de Monte Carlo, com metodologia aberta.",
  alternates: { canonical: "/championship-probabilities" },
};

function pct(p: number): string {
  if (p === 0) return "0%";
  if (p < 0.001) return "<0,1%";
  if (p > 0.999 && p < 1) return ">99,9%";
  return `${(p * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
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

export default async function ProbabilitiesPage() {
  const thisYear = new Date().getUTCFullYear();
  const r = await load(getChampionshipModel(thisYear));
  if (!r.ok) {
    return (
      <>
        <PageHeader kicker="Modelo experimental" title="Probabilidades de título" />
        <Container className="mt-8">
          <ErrorState message={r.error} />
        </Container>
      </>
    );
  }
  const m = r.data;
  const showNumbers = !m.warnings.some((w) => w.includes("não devem ser exibidas"));
  const drivers = m.drivers.filter((d) => d.mathematicallyAlive || d.titleProbability > 0).slice(0, 12);
  const teams = m.constructors.filter((d) => d.mathematicallyAlive || d.titleProbability > 0);

  return (
    <>
      <PageHeader kicker={`Temporada ${m.season} · modelo ${m.modelVersion}`} title="Probabilidades de título">
        Estimativas estatísticas, não previsões certas. A chance <strong>matemática</strong> diz se o título ainda é possível pelos
        pontos em disputa; a probabilidade <strong>estimada</strong> depende das hipóteses do modelo descritas abaixo.
      </PageHeader>
      <Container className="mt-8">
        <div className="mb-6 flex flex-wrap gap-2 text-xs">
          <Badge tone="warn">Experimental · ainda sem backtest publicado</Badge>
          <Badge>Base: após a etapa {m.basedOnRound}</Badge>
          <Badge>
            {m.remainingRaces} corridas e {m.remainingSprints} sprints restantes
          </Badge>
          <Badge>{m.assumptions.simulations.toLocaleString("pt-BR")} simulações</Badge>
          <Badge>
            Gerado em {new Date(m.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasília)
          </Badge>
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

        <SectionHeading title="Pilotos" kicker="Campeonato de pilotos" />
        <ProbTable rows={drivers} kind="Piloto" model={m} showNumbers={showNumbers} />

        <div className="mt-12">
          <SectionHeading title="Construtores" kicker="Campeonato de construtores" />
          <ProbTable rows={teams} kind="Equipe" model={m} showNumbers={showNumbers} />
        </div>

        <section className="mt-12 grid gap-6 lg:grid-cols-2" aria-labelledby="hipoteses">
          <Card className="p-5">
            <h2 id="hipoteses" className="mb-3 font-display text-xl font-bold uppercase">
              Hipóteses desta versão
            </h2>
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
            <h2 className="mb-3 font-display text-xl font-bold uppercase">Limitações conhecidas</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
              <li>Não considera características de circuitos, atualizações de carro, clima ou penalidades futuras.</li>
              <li>Sprints usam a mesma força estimada das corridas principais.</li>
              <li>Mudanças de piloto ao longo da temporada não são previstas.</li>
              <li>O modelo ainda não foi validado por backtest (Brier score, calibração) — previsto na próxima fase.</li>
              <li>Muitas simulações reduzem o ruído numérico, mas não corrigem hipóteses erradas.</li>
            </ul>
          </Card>
        </section>
        <SourceNote>
          Dados de entrada: classificação e resultados oficiais publicados na Jolpica-F1. Metodologia completa em{" "}
          <Link href="/methodology" className="underline">
            /methodology
          </Link>
          . Semente {m.assumptions.seed} (resultados reprodutíveis).
        </SourceNote>
      </Container>
    </>
  );
}
