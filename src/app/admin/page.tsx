import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, Container, SectionHeading } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { createEditorialAI } from "@/lib/news/ai-factory";
import { sourceById } from "@/lib/news/sources";
import { ARTICLE_STATUS_LABEL, type ArticleStatus } from "@/lib/news/states";
import { logoutAction, refreshSportsDataAction, runCycleAction, toggleSourceAction } from "./actions";

export const metadata: Metadata = { title: "Painel", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const e = env();
  const aiSel = createEditorialAI(e);
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
  const lastRefresh = await db.auditLog.findFirst({ where: { action: "f1.cache_refreshed" }, orderBy: { createdAt: "desc" } });
  type Run = (typeof runs)[number];
  const parseStats = (r: Run) =>
    JSON.parse(r.stats) as { note?: string; newItems?: number; drafted?: number; sentToReview?: number; published?: number };
  const isIngestOnly = (r: Run) => (parseStats(r).note ?? "").startsWith("Somente monitoramento");
  const lastFull = runs.find((r) => !isIngestOnly(r));
  const lastIngest = runs.find((r) => isIngestOnly(r));
  const running = runs.find((r) => r.status === "running");
  const ago = (d: Date) => {
    const min = Math.round((Date.now() - d.getTime()) / 60_000);
    return min < 1 ? "agora há pouco" : min < 60 ? `há ${min} min` : min < 1440 ? `há ${Math.round(min / 60)} h` : `há ${Math.round(min / 1440)} dia(s)`;
  };
  const runSummary = (r?: Run) => {
    if (!r) return "nunca executado";
    if (r.status === "running") return `rodando agora (iniciado ${ago(r.startedAt)})`;
    const st = parseStats(r);
    const writing = isIngestOnly(r) ? "" : ` · ${st.drafted ?? 0} redigidas · ${st.sentToReview ?? 0} para revisão`;
    return `${ago(r.startedAt)} · ${st.newItems ?? 0} manchetes novas${writing}`;
  };

  return (
    <Container className="py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase">Painel da redação</h1>
          <p className="text-sm text-muted">
            {user.name} · {user.role === "admin" ? "Administrador" : "Editor"} · modo de publicação <strong>{e.NEWS_PUBLISH_MODE}</strong> ·
            IA{" "}
            {aiSel.ai ? (
              <span className="text-ok">
                {aiSel.provider} ({aiSel.model})
              </span>
            ) : (
              <span className="text-warn">desativada — {aiSel.reason}</span>
            )}
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

      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-widest text-muted">Aguardando revisão</p>
          <p className="font-display text-4xl font-bold">{pending.length}</p>
          {pending.length > 0 && (
            <a href="#fila" className="text-xs text-accent hover:underline">
              Ir para a fila ↓
            </a>
          )}
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
            {aiSel.provider === "gemini" && " · plano gratuito do Gemini: custo zero, com limite de uso"}
          </p>
        </Card>
      </div>

      <section className="mb-12" aria-labelledby="ops">
        <SectionHeading id="ops" title="Operações" kicker="O que cada botão faz" />
        {running && (
          <p role="status" className="mb-4 rounded border border-info/50 p-3 text-sm">
            <strong className="text-info">Há um ciclo rodando agora</strong> (iniciado {ago(running.startedAt)}). Você pode continuar revisando e
            aprovando matérias; recarregue a página em alguns minutos para ver o resultado em &quot;Execuções recentes&quot;.
          </p>
        )}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="flex flex-col p-5">
            <h3 className="mb-2 font-display text-xl font-bold uppercase">1 · Buscar e escrever notícias</h3>
            <div className="mb-3 flex flex-wrap gap-1.5">
              <Badge tone="warn">Usa IA</Badge>
              <Badge>1 a 5 min · em segundo plano</Badge>
              <Badge>Só administrador</Badge>
            </div>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
              <li>Lê os 7 sites monitorados e guarda as manchetes novas.</li>
              <li>
                Agrupa manchetes sobre o mesmo fato em <strong className="text-fg">pautas</strong>.
              </li>
              <li>
                Para cada pauta elegível (fonte oficial ou 2+ veículos independentes), a IA escreve a matéria e outra IA confere os fatos.
              </li>
              <li>
                {e.NEWS_PUBLISH_MODE === "auto_restricted"
                  ? "Publica sozinho só o que passar em todos os critérios; o resto vai para a Fila de revisão."
                  : "Tudo vai para a Fila de revisão abaixo: nada é publicado sem você aprovar."}
              </li>
            </ol>
            <p className="mt-3 text-xs text-faint">
              <strong className="text-muted">Quando usar:</strong> 30 a 60 min depois de treinos, classificação ou corrida. Escreve no máximo{" "}
              {e.NEWS_MAX_ARTICLES_PER_RUN} matérias por vez e {e.NEWS_MAX_ARTICLES_PER_DAY} por dia.{" "}
              <strong className="text-muted">Não altera</strong> resultados nem classificação.
              {!aiSel.ai && <span className="text-warn"> IA desativada agora: este botão fará só os passos 1 e 2.</span>}
            </p>
            <p className="mt-2 text-xs text-faint">Última execução: {runSummary(lastFull)}</p>
            <div className="mt-auto pt-4">
              {user.role === "admin" ? (
                <form action={runCycleAction}>
                  <button className="w-full rounded bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-strong">
                    Buscar e escrever notícias
                  </button>
                </form>
              ) : (
                <p className="text-xs text-faint">Somente administradores.</p>
              )}
            </div>
          </Card>

          <Card className="flex flex-col p-5">
            <h3 className="mb-2 font-display text-xl font-bold uppercase">2 · Só buscar manchetes</h3>
            <div className="mb-3 flex flex-wrap gap-1.5">
              <Badge tone="ok">Sem IA · custo zero</Badge>
              <Badge>Segundos</Badge>
              <Badge>Só administrador</Badge>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              <li>Faz apenas os passos 1 e 2 do botão ao lado: lê os sites e agrupa as manchetes.</li>
              <li>
                Atualiza o <strong className="text-fg">Radar das fontes</strong> (no site) e as <strong className="text-fg">Pautas abertas</strong>{" "}
                (mais abaixo).
              </li>
              <li>Não escreve nem publica nada.</li>
            </ul>
            <p className="mt-3 text-xs text-faint">
              <strong className="text-muted">Quando usar:</strong> para ver o que está saindo nos sites antes de gastar IA, ou quando o limite do
              plano gratuito estiver esgotado.
            </p>
            <p className="mt-2 text-xs text-faint">Última execução: {runSummary(lastIngest)}</p>
            <div className="mt-auto pt-4">
              {user.role === "admin" ? (
                <form action={runCycleAction}>
                  <input type="hidden" name="ingestOnly" value="1" />
                  <button className="w-full rounded border border-line-strong px-3 py-2 text-sm font-semibold hover:border-fg">
                    Só buscar manchetes
                  </button>
                </form>
              ) : (
                <p className="text-xs text-faint">Somente administradores.</p>
              )}
            </div>
          </Card>

          <Card className="flex flex-col p-5">
            <h3 className="mb-2 font-display text-xl font-bold uppercase">3 · Atualizar dados esportivos</h3>
            <div className="mb-3 flex flex-wrap gap-1.5">
              <Badge tone="ok">Sem IA</Badge>
              <Badge>Imediato</Badge>
              <Badge>Até 6× a cada 10 min</Badge>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              <li>
                Descarta a cópia guardada de{" "}
                <strong className="text-fg">calendário, resultados, grid, classificação, comparativos e probabilidades</strong>.
              </li>
              <li>A próxima visita a essas páginas busca tudo de novo na fonte oficial (Jolpica).</li>
              <li>Não mexe em notícias.</li>
            </ul>
            <p className="mt-3 text-xs text-faint">
              <strong className="text-muted">Quando usar:</strong> depois que o resultado oficial for publicado (algumas horas após a corrida).
              Sem clicar, o site já se atualiza sozinho a cada 10 a 60 min. Clicar antes de a fonte publicar não traz o resultado mais cedo.
            </p>
            <p className="mt-2 text-xs text-faint">Última atualização manual: {lastRefresh ? ago(lastRefresh.createdAt) : "nunca"}</p>
            <div className="mt-auto pt-4">
              <form action={refreshSportsDataAction}>
                <button className="w-full rounded border border-line-strong px-3 py-2 text-sm font-semibold hover:border-fg">
                  Atualizar dados esportivos agora
                </button>
              </form>
            </div>
          </Card>
        </div>
      </section>

      <section id="fila" className="mb-12 scroll-mt-24">
        <SectionHeading title="Fila de revisão" kicker="Clique no título para revisar e aprovar" />
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
