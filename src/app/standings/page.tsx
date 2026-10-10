import type { Metadata } from "next";
import Link from "next/link";
import { LineChart, type Series } from "@/components/line-chart";
import { Card, Container, ErrorState, PageHeader, SectionHeading, SourceNote } from "@/components/ui";
import { driverName, f1, load } from "@/lib/f1/service";

export const revalidate = 900;
export const metadata: Metadata = {
  title: "Classificação",
  description: "Classificação de pilotos e construtores da Fórmula 1, com evolução de pontos por etapa.",
  alternates: { canonical: "/standings" },
};

export default async function StandingsPage({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const sp = await searchParams;
  const thisYear = new Date().getUTCFullYear();
  const season = /^\d{4}$/.test(sp.season ?? "") ? Math.min(Math.max(Number(sp.season), 1950), thisYear) : null;
  const key = season ?? "current";

  const [dsR, csR] = await Promise.all([load(f1.getDriverStandings(key)), load(f1.getConstructorStandings(key))]);
  const seasonNum = dsR.ok ? dsR.data.season : (season ?? thisYear);
  const [racesR, sprintsR] = await Promise.all([load(f1.getSeasonResults(seasonNum, "race")), load(f1.getSeasonResults(seasonNum, "sprint"))]);

  // Posição na etapa anterior: recalculada somando os pontos publicados até a rodada anterior.
  const rounds = racesR.ok ? racesR.data.map((r) => r.round) : [];
  const cumulative = new Map<string, number[]>();
  const names = new Map<string, string>();
  if (racesR.ok) {
    const sprintByRound = new Map((sprintsR.ok ? sprintsR.data : []).map((s) => [s.round, s]));
    const running = new Map<string, number>();
    rounds.forEach((round, idx) => {
      const race = racesR.data[idx]!;
      for (const row of [...race.rows, ...(sprintByRound.get(round)?.rows ?? [])]) {
        names.set(row.driver.id, driverName(row.driver));
        running.set(row.driver.id, (running.get(row.driver.id) ?? 0) + row.points);
      }
      for (const [id, pts] of running) {
        const arr = cumulative.get(id) ?? new Array(idx).fill(0);
        while (arr.length < idx) arr.push(0);
        arr.push(pts);
        cumulative.set(id, arr);
      }
    });
  }
  const prevRank = new Map<string, number>();
  if (rounds.length >= 2) {
    const prev = [...cumulative.entries()].map(([id, arr]) => [id, arr[rounds.length - 2] ?? 0] as const).sort((a, b) => b[1] - a[1]);
    prev.forEach(([id], i) => prevRank.set(id, i + 1));
  }

  const ds = dsR.ok ? dsR.data : null;
  const top: Series[] = (ds?.rows.slice(0, 5) ?? [])
    .map((r) => ({ id: r.driver.id, label: r.driver.code ?? r.driver.familyName, values: cumulative.get(r.driver.id) ?? [] }))
    .filter((s) => s.values.length > 0);

  return (
    <>
      <PageHeader kicker={`Temporada ${seasonNum}${ds ? ` · após a etapa ${ds.round}` : ""}`} title="Classificação">
        Pontuação oficial de pilotos e construtores, com regras da própria temporada (inclui pontos de sprint quando aplicável).
      </PageHeader>
      <Container className="mt-8">
        <form method="get" className="mb-8 flex items-end gap-2">
          <label className="text-xs text-muted">
            Temporada
            <input name="season" inputMode="numeric" pattern="\d{4}" defaultValue={seasonNum} className="ml-2 w-20 rounded border border-line bg-elev px-2 py-1 text-sm text-fg" />
          </label>
          <button className="rounded border border-line-strong px-3 py-1 text-sm hover:border-fg">Ver</button>
        </form>

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
                    {dsR.data.rows.map((r) => {
                      const leader = dsR.data.rows[0]!.points;
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
                    {csR.data.rows.map((r) => (
                      <tr key={r.constructor.id}>
                        <td className="font-semibold tabular">{r.positionText}</td>
                        <td className="font-medium">{r.constructor.name}</td>
                        <td className="num">{r.wins}</td>
                        <td className="num font-semibold">{r.points}</td>
                        <td className="num text-muted">
                          {r.points === csR.data.rows[0]!.points ? "—" : `−${csR.data.rows[0]!.points - r.points}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </section>
        </div>

        {top.length > 0 && (
          <section className="mt-12" aria-labelledby="evolution">
            <SectionHeading id="evolution" kicker="Top 5 atual" title="Evolução dos pontos" />
            <Card className="p-4">
              <LineChart series={top} xLabels={rounds.map((r) => `E${r}`)} title="Pontos acumulados por etapa (corrida + sprint)" unit="pontos" />
            </Card>
          </section>
        )}
        <SourceNote>
          Fonte: Jolpica-F1. Variação de posição calculada pela soma de pontos de corridas e sprints publicados até a etapa anterior; pode
          divergir em casos de pontos retirados por decisão posterior. Veja também as{" "}
          <Link href="/championship-probabilities" className="underline">
            probabilidades de título
          </Link>
          .
        </SourceNote>
      </Container>
    </>
  );
}
