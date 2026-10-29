import type { Metadata } from "next";
import Link from "next/link";
import { Card, Container, PageHeader, SectionHeading, SourceNote } from "@/components/ui";
import { gpName } from "@/lib/f1/gp-names";
import { combineHistory, HISTORY, onThisDay, ranking, recordChases, type RankRow } from "@/lib/f1/history";
import { nationalityFlag } from "@/lib/f1/nationality";
import { f1, load } from "@/lib/f1/service";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Recordes da F1 desde 1950",
  description: "Campeões de cada ano e quem mais venceu, largou na pole, subiu ao pódio e correu na F1 desde 1950 — com a temporada atual somada ao vivo.",
  alternates: { canonical: "/records" },
};

function RankCard({ title, since, rows, moreTied }: { title: string; since: string; rows: RankRow[]; moreTied: { count: number; value: number; names: string[] } | null }) {
  return (
    <Card className="p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-faint">
        {title} <span className="normal-case tracking-normal">({since})</span>
      </h3>
      <ol className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular ${r.rank === 1 ? "bg-[var(--sg-win)]" : "text-faint"}`}
            >
              {r.rank}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {nationalityFlag(r.nationality) && <span aria-hidden="true">{nationalityFlag(r.nationality)} </span>}
              {r.name}
              {r.active && <span className="ml-1.5 rounded-full border border-line-strong px-1.5 py-px text-[0.6rem] text-muted">em atividade</span>}
            </span>
            <span className="font-display text-lg font-bold tabular">{r.value}</span>
          </li>
        ))}
      </ol>
      {moreTied && (
        <p className="mt-2 text-xs text-faint">
          +{moreTied.count} {moreTied.count === 1 ? "empatado" : "empatados"} com {moreTied.value}: {moreTied.names.join(", ")}
          {moreTied.count > moreTied.names.length ? "…" : ""}
        </p>
      )}
    </Card>
  );
}

export default async function RecordsPage() {
  const eventsR = await load(f1.getSchedule("current"));
  const live = eventsR.ok ? (eventsR.data[0]?.season ?? null) : null;
  const [racesR, qualisR] = live
    ? await Promise.all([load(f1.getSeasonResults(live, "race")), load(f1.getSeasonQualifying(live))])
    : [null, null];
  const liveOk = live !== null && racesR?.ok;
  const h = combineHistory(HISTORY, liveOk ? { season: live, races: racesR.data, qualis: qualisR?.ok ? qualisR.data : [] } : null);
  const gap = live !== null && live - 1 > h.lastSeason;

  const d = h.drivers;
  const t = h.teams;
  const A = h.activeDrivers;
  const AT = h.activeTeams;
  const chases = recordChases(d, A);
  const today = onThisDay(h, new Date());
  const brazil = d.filter((x) => x.nationality === "Brazilian").sort((a, b) => b.titles - a.titles || b.wins - a.wins || b.podiums - a.podiums || b.starts - a.starts);
  const seasons = [...h.seasons].reverse();
  const since = `desde ${h.firstSeason}`;

  return (
    <>
      <PageHeader kicker="História" title={`Recordes da F1 desde ${h.firstSeason}`}>
        Campeões de cada ano e quem mais venceu, largou na pole e subiu ao pódio desde {h.firstSeason}, o primeiro ano do Mundial.
        {h.liveSeason ? ` A temporada ${h.liveSeason}, em andamento, entra nos números, mas não nos títulos.` : ""}
      </PageHeader>
      <Container className="mt-6">
        <nav aria-label="Seções" className="mb-8 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
          {[
            ["#pilotos", "Pilotos"],
            ["#equipes", "Equipes"],
            ["#brasileiros", "Brasileiros"],
            ["#campeoes", "Campeões"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="underline underline-offset-4 hover:text-accent">
              {label}
            </a>
          ))}
        </nav>

        <div className="mb-10 grid gap-4 lg:grid-cols-2">
          {chases.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 font-display text-xl font-bold uppercase">Recordes em jogo</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {chases.map((c) => (
                  <li key={c.metric}>
                    <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-faint">{c.metric}</p>
                    <p className="text-sm">
                      <strong>{c.chaser}</strong> precisa de <strong>{c.need}</strong> para passar {c.target} ({c.targetValue})
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {today.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 font-display text-xl font-bold uppercase">Neste dia</h2>
              <ul className="space-y-2 text-sm">
                {today.slice(0, 5).map((x) => (
                  <li key={`${x.race.season}-${x.race.round}`}>
                    <span className="font-semibold tabular">{x.race.season}</span> <span className="text-faint">· há {x.years} anos ·</span> {x.label}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <section id="pilotos" className="scroll-mt-24" aria-labelledby="pilotos-t">
          <SectionHeading id="pilotos-t" title="Pilotos" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <RankCard title="Títulos" since={since} {...ranking(d, (x) => x.titles, A)} />
            <RankCard title="Vitórias" since={since} {...ranking(d, (x) => x.wins, A)} />
            <RankCard title="Poles" since={since} {...ranking(d, (x) => x.poles, A)} />
            <RankCard title="Pódios" since={since} {...ranking(d, (x) => x.podiums, A)} />
            <RankCard title="Voltas mais rápidas" since="desde 2004" {...ranking(d, (x) => x.fastestLaps, A)} />
            <RankCard title="Corridas" since={since} {...ranking(d, (x) => x.starts, A)} />
          </div>
        </section>

        <section id="equipes" className="mt-12 scroll-mt-24" aria-labelledby="equipes-t">
          <SectionHeading id="equipes-t" title="Equipes" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <RankCard title="Títulos de construtores" since="desde 1958" {...ranking(t, (x) => x.titles, AT)} />
            <RankCard title="Vitórias" since={since} {...ranking(t, (x) => x.wins, AT)} />
            <RankCard title="Poles" since={since} {...ranking(t, (x) => x.poles, AT)} />
          </div>
        </section>

        <section id="brasileiros" className="mt-12 scroll-mt-24" aria-labelledby="br-t">
          <SectionHeading id="br-t" kicker="🇧🇷" title="Brasileiros na F1" />
          <Card className="overflow-x-auto">
            <table className="data-table">
              <caption className="sr-only">Pilotos brasileiros na história da F1</caption>
              <thead>
                <tr>
                  <th scope="col">Piloto</th>
                  <th scope="col" className="num">Títulos</th>
                  <th scope="col" className="num">Vitórias</th>
                  <th scope="col" className="num">Poles</th>
                  <th scope="col" className="num">Pódios</th>
                  <th scope="col" className="num">Corridas</th>
                  <th scope="col">Temporadas</th>
                </tr>
              </thead>
              <tbody>
                {brazil.slice(0, 20).map((x) => (
                  <tr key={x.id}>
                    <th scope="row" className="text-left font-medium normal-case tracking-normal text-fg">
                      {x.name}
                      {A.has(x.id) && <span className="ml-1.5 rounded-full border border-line-strong px-1.5 py-px text-[0.6rem] text-muted">em atividade</span>}
                    </th>
                    <td className="num font-semibold">{x.titles || "—"}</td>
                    <td className="num">{x.wins}</td>
                    <td className="num">{x.poles}</td>
                    <td className="num">{x.podiums}</td>
                    <td className="num">{x.starts}</td>
                    <td className="tabular text-muted">
                      {x.firstSeason === x.lastSeason ? x.firstSeason : `${x.firstSeason}–${x.lastSeason}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>

        <section id="campeoes" className="mt-12 scroll-mt-24" aria-labelledby="camp-t">
          <SectionHeading id="camp-t" title="Campeões de cada ano" />
          <Card className="overflow-x-auto">
            <table className="data-table">
              <caption className="sr-only">Campeões de pilotos e de construtores por temporada</caption>
              <thead>
                <tr>
                  <th scope="col">Ano</th>
                  <th scope="col">Pilotos</th>
                  <th scope="col" className="num">Pts</th>
                  <th scope="col">Vice</th>
                  <th scope="col">Construtores</th>
                </tr>
              </thead>
              <tbody>
                {seasons.map((s) => (
                  <tr key={s.season}>
                    <td className="font-semibold tabular">
                      <Link href={`/standings?season=${s.season}`} className="hover:underline">
                        {s.season}
                      </Link>
                    </td>
                    <td>
                      <span className="font-medium">{s.champion?.name ?? "—"}</span>
                      {s.champion?.team && <span className="block text-xs text-muted">{s.champion.team}</span>}
                    </td>
                    <td className="num">{s.champion?.points ?? "—"}</td>
                    <td className="text-muted">{s.runnerUp ? `${s.runnerUp.name} (${s.runnerUp.points})` : "—"}</td>
                    <td>{s.teamChampion?.name ?? <span className="text-faint">não havia</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>

        <SourceNote>
          Fonte: Jolpica-F1 (CC BY-NC-SA 4.0), histórico gerado em {new Date(h.generatedAt).toLocaleDateString("pt-BR")} até {h.lastSeason}
          {h.liveSeason ? `, mais a temporada ${h.liveSeason} ao vivo` : ""}. {h.notes.poles} {h.notes.fastestLaps} Pontos de temporadas antigas seguem as
          regras da época (inclusive descartes).
          {gap && " Atenção: há temporadas encerradas ainda fora do histórico — rode scripts/build-history.mjs para atualizar."}
          {" "}Primeira corrida: {gpName(h.races[0]?.name ?? "")} de {h.firstSeason}.
        </SourceNote>
      </Container>
    </>
  );
}
