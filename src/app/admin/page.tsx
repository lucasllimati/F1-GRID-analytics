import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, Container, SectionHeading } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sourceById } from "@/lib/news/sources";
import { ARTICLE_STATUS_LABEL, type ArticleStatus } from "@/lib/news/states";
import { logoutAction, runCycleAction, toggleSourceAction } from "./actions";

export const metadata: Metadata = { title: "Painel", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const e = env();
  const dayAgo = new Date(Date.now() - 86_400_000);
  const monthAgo = new Date(Date.now() - 30 * 86_400_000);

  const [sources, runs, pending, recent, statusCounts, cost24, cost30, openStories, failedRuns] = await Promise.all([
    db.newsSource.findMany({ orderBy: { id: "asc" }, include: { _count: { select: { items: true } } } }),
    db.ingestionRun.findMany({ orderBy: { startedAt: "desc" }, take: 8 }),
    db.article.findMany({ where: { status: "in_review" }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.article.findMany({ where: { status: { in: ["published", "rejected", "retracted"] } }, orderBy: { updatedAt: "desc" }, take: 15 }),
    db.article.groupBy({ by: ["status"], _count: true }),
    db.agentRun.aggregate({ where: { startedAt: { gt: dayAgo } }, _sum: { costUsd: true, inputTokens: true, outputTokens: true } }),
    db.agentRun.aggregate({ where: { startedAt: { gt: monthAgo } }, _sum: { costUsd: true } }),
    db.story.findMany({
      where: { status: "open", lastSeenAt: { gt: new Date(Date.now() - 36 * 3600_000) } },
      orderBy: { lastSeenAt: "desc" },
      take: 25,
      include: { items: { select: { title: true, sourceId: true, url: true }, take: 6 } },
    }),
    db.agentRun.findMany({ where: { status: { not: "ok" } }, orderBy: { startedAt: "desc" }, take: 5 }),
  ]);

  return (
    <Container className="py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase">Painel da redação</h1>
          <p className="text-sm text-muted">
            {user.name} · {user.role === "admin" ? "Administrador" : "Editor"} · modo de publicação <strong>{e.NEWS_PUBLISH_MODE}</strong> ·
            IA {e.ANTHROPIC_API_KEY ? <span className="text-ok">configurada ({e.NEWS_AI_MODEL})</span> : <span className="text-warn">sem chave</span>}
          </p>
        </div>
        <form action={logoutAction}>
          <button className="rounded border border-line px-3 py-1.5 text-sm">Sair</button>
        </form>
      </div>

      {sp.ok && (
        <p role="status" className="mb-6 rounded border border-ok/50 p-3 text-sm">
          {sp.ok.slice(0, 400)}
        </p>
      )}
      {sp.erro && (
        <p role="alert" className="mb-6 rounded border border-accent/60 bg-accent-soft p-3 text-sm">
          {sp.erro.slice(0, 400)}
        </p>
      )}

      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-widest text-muted">Aguardando revisão</p>
          <p className="font-display text-4xl font-bold">{pending.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-widest text-muted">Artigos por estado</p>
          <ul className="mt-1 text-sm">
            {statusCounts.map((s) => (
              <li key={s.status}>
                {ARTICLE_STATUS_LABEL[s.status as ArticleStatus] ?? s.status}: <strong>{s._count}</strong>
              </li>
            ))}
            {statusCounts.length === 0 && <li className="text-faint">nenhum</li>}
          </ul>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-widest text-muted">Custo de IA</p>
          <p className="font-display text-3xl font-bold">US$ {(cost24._sum.costUsd ?? 0).toFixed(2)}</p>
          <p className="text-xs text-faint">
            24h · {(cost24._sum.inputTokens ?? 0).toLocaleString("pt-BR")} tokens in / {(cost24._sum.outputTokens ?? 0).toLocaleString("pt-BR")} out ·
            30 dias: US$ {(cost30._sum.costUsd ?? 0).toFixed(2)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-widest text-muted">Executar ciclo</p>
          {user.role === "admin" ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <form action={runCycleAction}>
                <button className="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-white">Ciclo completo</button>
              </form>
              <form action={runCycleAction}>
                <input type="hidden" name="ingestOnly" value="1" />
                <button className="rounded border border-line px-3 py-1.5 text-sm">Só monitorar</button>
              </form>
            </div>
          ) : (
            <p className="mt-2 text-xs text-faint">Somente administradores.</p>
          )}
        </Card>
      </div>

      <section className="mb-12">
        <SectionHeading title="Fila de revisão" />
        {pending.length === 0 ? (
          <p className="text-sm text-muted">Nada pendente.</p>
        ) : (
          <Card className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Título</th>
                  <th scope="col">Motivos</th>
                  <th scope="col">Checagem</th>
                  <th scope="col">Criado</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((a) => {
                  const reasons = JSON.parse(a.reviewReasons) as string[];
                  return (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/admin/articles/${a.id}`} className="font-medium hover:text-accent">
                          {a.headline}
                        </Link>
                        {a.sensitive && (
                          <span className="ml-2">
                            <Badge tone="warn">Sensível</Badge>
                          </span>
                        )}
                      </td>
                      <td className="max-w-md text-xs text-muted">{reasons.slice(0, 3).join(" · ")}</td>
                      <td className="tabular">{a.factCheckScore === null ? "—" : `${Math.round(a.factCheckScore * 100)}%`}</td>
                      <td className="whitespace-nowrap text-xs text-faint">{fmt.format(a.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <section className="mb-12">
        <SectionHeading title="Pautas abertas (36h)" />
        <p className="mb-3 text-xs text-faint">
          Agrupamentos de manchetes. Pautas com fonte oficial ou ≥2 grupos independentes são redigidas automaticamente nos próximos ciclos.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {openStories.map((s) => {
            const groups = new Set(s.items.map((i) => sourceById(i.sourceId)?.group));
            return (
              <Card key={s.id} className="p-3 text-sm">
                <div className="mb-1 flex gap-2">
                  <Badge tone={groups.size >= 2 ? "ok" : "neutral"}>{groups.size} grupo(s)</Badge>
                  <span className="text-xs text-faint">{fmt.format(s.lastSeenAt)}</span>
                </div>
                <ul className="space-y-1">
                  {s.items.map((i) => (
                    <li key={i.url}>
                      <a href={i.url} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-accent">
                        <span className="text-xs text-muted">[{sourceById(i.sourceId)?.name ?? i.sourceId}]</span> {i.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
          {openStories.length === 0 && <p className="text-sm text-muted">Nenhuma pauta aberta.</p>}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <SectionHeading title="Fontes" />
          <Card className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Fonte</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="num">Itens</th>
                  <th scope="col">Última coleta</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>
                      {!s.enabled ? (
                        <Badge>Desativada</Badge>
                      ) : s.lastStatus === "error" ? (
                        <span title={s.lastError ?? ""}>
                          <Badge tone="warn">Erro</Badge>
                        </span>
                      ) : s.lastStatus === "ok" ? (
                        <Badge tone="ok">OK</Badge>
                      ) : (
                        <Badge>Nunca coletada</Badge>
                      )}
                    </td>
                    <td className="num">{s._count.items}</td>
                    <td className="text-xs text-faint">{s.lastFetchedAt ? fmt.format(s.lastFetchedAt) : "—"}</td>
                    <td>
                      {user.role === "admin" && (
                        <form action={toggleSourceAction}>
                          <input type="hidden" name="id" value={s.id} />
                          <button className="text-xs underline">{s.enabled ? "Desativar" : "Ativar"}</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          {sources.length === 0 && <p className="mt-2 text-sm text-muted">Execute um ciclo para registrar as fontes.</p>}
        </section>
        <section>
          <SectionHeading title="Execuções recentes" />
          <Card className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Início</th>
                  <th scope="col">Origem</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Resumo</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const st = JSON.parse(r.stats) as { newItems?: number; published?: number; sentToReview?: number; aiCostUsd?: number; note?: string };
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap text-xs">{fmt.format(r.startedAt)}</td>
                      <td className="text-xs">{r.trigger}</td>
                      <td>
                        <Badge tone={r.status === "ok" ? "ok" : r.status === "running" ? "info" : "warn"}>{r.status}</Badge>
                      </td>
                      <td className="text-xs text-muted" title={r.error ?? st.note ?? ""}>
                        {st.newItems ?? 0} novos · {st.published ?? 0} pub. · {st.sentToReview ?? 0} rev. · US$ {(st.aiCostUsd ?? 0).toFixed(3)}
                        {r.error && <span className="block text-accent">{r.error.slice(0, 120)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          {failedRuns.length > 0 && (
            <div className="mt-4 text-xs text-muted">
              <p className="mb-1 font-semibold uppercase tracking-widest">Falhas recentes de agentes</p>
              <ul className="space-y-1">
                {failedRuns.map((f) => (
                  <li key={f.id}>
                    {fmt.format(f.startedAt)} · {f.agent} · {f.status}: {f.error?.slice(0, 140)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <section className="mt-12">
        <SectionHeading title="Decisões recentes" />
        <ul className="space-y-1 text-sm">
          {recent.map((a) => (
            <li key={a.id}>
              <Badge tone={a.status === "published" ? "ok" : "neutral"}>{ARTICLE_STATUS_LABEL[a.status as ArticleStatus] ?? a.status}</Badge>{" "}
              <Link href={`/admin/articles/${a.id}`} className="hover:text-accent">
                {a.headline}
              </Link>{" "}
              <span className="text-xs text-faint">{a.approvedById ? "(humano)" : a.status === "published" ? "(automático)" : ""}</span>
            </li>
          ))}
        </ul>
      </section>
    </Container>
  );
}
