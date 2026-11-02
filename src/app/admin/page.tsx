import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, Container, SectionHeading } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { createEditorialAI } from "@/lib/news/ai-factory";
import { formatDuration, parseProgress } from "@/lib/news/progress";
import { RunProgressBanner } from "@/components/run-progress";
import { f1, load } from "@/lib/f1/service";
import { validateSeason, type DataIssue, type Severity } from "@/lib/f1/validate";
import { checkConfig, checkDatabase, checkNewsIngestion, checkSportsSource, deriveAlerts, overall, type CheckStatus } from "@/lib/ops/health";
import pkg from "../../../package.json";
import { sourceById } from "@/lib/news/sources";
import { ARTICLE_STATUS_LABEL, type ArticleStatus } from "@/lib/news/states";
import { SubmitButton } from "@/components/submit-button";
import { approveAllAction, logoutAction, refreshSportsDataAction, runCycleAction, toggleSourceAction } from "./actions";

export const metadata: Metadata = { title: "Painel", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
// Ações do painel (ex.: "Só buscar manchetes") rodam aqui: máximo do plano gratuito da Vercel.
export const maxDuration = 300;

const TRIGGER_LABEL: Record<string, string> = { admin: "Painel", cron: "Agendamento", cli: "Linha de comando" };
const RUN_STATUS_LABEL: Record<string, string> = { ok: "Concluída", partial: "Parcial", error: "Erro", running: "Rodando" };
const CHECK_LABEL: Record<CheckStatus, string> = { ok: "OK", degraded: "Degradado", down: "Fora", unknown: "Sem dados" };
const SEVERITY: Record<Severity, { label: string; tone: "accent" | "warn" | "info" | "neutral"; color: string }> = {
  critical: { label: "Crítico", tone: "accent", color: "var(--accent)" },
  high: { label: "Alto", tone: "accent", color: "var(--accent)" },
  medium: { label: "Médio", tone: "warn", color: "var(--warn)" },
  low: { label: "Baixo", tone: "neutral", color: "var(--line-strong)" },
};

/** Valida a temporada atual com dados em cache; null se a fonte estiver indisponível. */
async function seasonQuality(): Promise<{ season: number; issues: DataIssue[] } | null> {
  const ev = await load(f1.getSchedule("current"));
  if (!ev.ok || ev.data.length === 0) return null;
  const season = ev.data[0]!.season;
  const r = await load(
    Promise.all([
      f1.getSeasonResults(season, "race"),
      f1.getSeasonResults(season, "sprint"),
      f1.getSeasonQualifying(season),
      f1.getDriverStandings(season),
      f1.getConstructorStandings(season),
    ]),
  );
  if (!r.ok) return null;
  const [races, sprints, qualis, ds, cs] = r.data;
  return { season, issues: validateSeason({ season, events: ev.data, data: { races, sprints, qualis }, driverStandings: ds, constructorStandings: cs }) };
}

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
  const [sysDb, sysNews, quality, opsAlerts] = await Promise.all([
    checkDatabase(db),
    checkNewsIngestion(db),
    seasonQuality(),
    deriveAlerts(db, { aiEnabled: Boolean(aiSel.ai), aiReason: aiSel.reason, aiChain: aiSel.model }),
  ]);
  const sysChecks = [sysDb, checkSportsSource(), sysNews, checkConfig()];
  const sysOverall = overall(sysChecks);
  const dataIssues = quality?.issues ?? null;
  const dataSeason = quality?.season ?? null;
  const appVersion = `${pkg.version}${process.env.VERCEL_GIT_COMMIT_SHA ? ` (${process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)})` : ""}`;
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

      <RunProgressBanner />

      <section className="mb-10" aria-labelledby="sys">
        <SectionHeading id="sys" title="Estado do sistema" kicker="Medido agora · recarregue para atualizar" />
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <Card className="p-4">
            <p className="mb-3 flex items-center gap-2 text-sm">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${sysOverall === "ok" ? "bg-ok" : sysOverall === "down" ? "bg-accent" : "bg-warn"}`}
                aria-hidden="true"
              />
              <strong>{sysOverall === "ok" ? "Operando normalmente" : sysOverall === "down" ? "Indisponível" : "Degradado"}</strong>
              <span className="text-xs text-faint">· versão {appVersion}</span>
            </p>
            <ul className="space-y-2 text-sm">
              {sysChecks.map((c) => (
                <li key={c.name} className="flex items-start justify-between gap-3">
                  <span>
                    {c.name}
                    <span className="block text-xs text-faint">
                      {c.detail}
                      {c.latencyMs !== undefined ? ` · ${c.latencyMs} ms` : ""}
                    </span>
                  </span>
                  <Badge tone={c.status === "ok" ? "ok" : c.status === "unknown" ? "neutral" : c.status === "down" ? "accent" : "warn"}>
                    {CHECK_LABEL[c.status]}
                  </Badge>
                </li>
              ))}
              <li className="flex items-start justify-between gap-3">
                <span>
                  Qualidade dos dados {dataSeason ?? ""}
                  <span className="block text-xs text-faint">
                    {dataIssues === null
                      ? "não foi possível validar agora (fonte indisponível)"
                      : dataIssues.length === 0
                        ? "classificação, pontos e calendário conferem com a fonte"
                        : `${dataIssues.length} ponto(s) para revisar`}
                  </span>
                </span>
                <Badge tone={dataIssues === null ? "neutral" : dataIssues.some((i) => i.severity === "high" || i.severity === "critical") ? "accent" : dataIssues.length ? "warn" : "ok"}>
                  {dataIssues === null ? "Sem dados" : dataIssues.length === 0 ? "OK" : "Revisar"}
                </Badge>
              </li>
            </ul>
            <p className="mt-3 text-[0.7rem] text-faint">
              Monitoramento externo: <code>/api/health</code>. Ainda não há métricas de CPU/memória nem histórico de alertas (docs/DIAGNOSTICO.md).
            </p>
          </Card>
          <Card className="p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">Alertas ({opsAlerts.length + (dataIssues?.length ?? 0)})</h3>
            {opsAlerts.length === 0 && (dataIssues?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted">Nenhum alerta no momento.</p>
            ) : (
              <ul className="space-y-3">
                {opsAlerts.map((a) => (
                  <li key={a.id} className="border-l-2 pl-3" style={{ borderColor: SEVERITY[a.severity].color }}>
                    <p className="text-sm">
                      <Badge tone={SEVERITY[a.severity].tone}>{SEVERITY[a.severity].label}</Badge> <strong>{a.title}</strong>{" "}
                      <span className="text-xs text-faint">· {a.category}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{a.detail}</p>
                    <p className="mt-0.5 text-xs text-faint">
                      <strong className="text-muted">O que fazer:</strong> {a.action}
                    </p>
                  </li>
                ))}
                {(dataIssues ?? []).slice(0, 8).map((i, idx) => (
                  <li key={`${i.code}-${idx}`} className="border-l-2 pl-3" style={{ borderColor: SEVERITY[i.severity].color }}>
                    <p className="text-sm">
                      <Badge tone={SEVERITY[i.severity].tone}>{SEVERITY[i.severity].label}</Badge> <strong>{i.message}</strong>{" "}
                      <span className="text-xs text-faint">· dados</span>
                    </p>
                    {i.detail && <p className="mt-0.5 text-xs text-muted">{i.detail}</p>}
                    <p className="mt-0.5 text-xs text-faint">
                      <strong className="text-muted">O que fazer:</strong> conferir na fonte oficial; o site não corrige dados automaticamente. Detalhes:{" "}
                      <code>npm run data:check</code>.
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </section>

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
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="flex flex-col p-5">
            <h3 className="mb-2 font-display text-xl font-bold uppercase">1 · Buscar e escrever notícias</h3>
            <div className="mb-3 flex flex-wrap gap-1.5">
              <Badge tone="warn">Usa IA</Badge>
              <Badge>1 a 5 min · em segundo plano</Badge>
              <Badge>Só administrador</Badge>
            </div>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
              <li>Lê os {sources.filter((s) => s.enabled).length || "vários"} sites monitorados e guarda as manchetes novas.</li>
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
          <>
          <form action={approveAllAction} className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-line bg-elev p-3">
            {pending.map((a) => (
              <input key={a.id} type="hidden" name="id" value={a.id} />
            ))}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="confirm" required className="h-4 w-4 accent-[var(--accent)]" />
              Revisei {pending.length === 1 ? "a matéria" : `as ${pending.length} matérias`} da fila
            </label>
            <SubmitButton pending="Publicando…" className="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-white">
              Aprovar todas ({pending.length})
            </SubmitButton>
            <span className="text-xs text-faint">
              Só as listadas abaixo. Tema sensível continua exigindo administrador
              {pending.some((a) => a.sensitive) ? ` (${pending.filter((a) => a.sensitive).length} nesta fila)` : ""}.
            </span>
          </form>
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
          </>
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

      <div className="grid gap-8">
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
          <SectionHeading title="Execuções recentes" kicker="Últimas 8 · horários de Brasília" />
          <Card className="overflow-x-auto">
            <table className="data-table">
              <caption className="sr-only">Execuções recentes do ciclo de notícias</caption>
              <thead>
                <tr>
                  <th scope="col">Início</th>
                  <th scope="col">Fim</th>
                  <th scope="col" className="num">Duração</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Origem</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Resumo</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const st = JSON.parse(r.stats) as { newItems?: number; drafted?: number; published?: number; sentToReview?: number; aiCostUsd?: number; note?: string };
                  const label = parseProgress(r.progress)?.label ?? (isIngestOnly(r) ? "Só buscar manchetes" : "Buscar e escrever notícias");
                  const isRunning = r.status === "running";
                  const durationMs = (r.finishedAt ?? new Date()).getTime() - r.startedAt.getTime();
                  return (
                    <tr key={r.id} className={isRunning ? "bg-info/5" : undefined}>
                      <td className="whitespace-nowrap text-xs">{fmt.format(r.startedAt)}</td>
                      <td className="whitespace-nowrap text-xs">{r.finishedAt ? fmt.format(r.finishedAt) : <span className="text-info">em andamento</span>}</td>
                      <td className="num whitespace-nowrap text-xs">
                        {isRunning ? (
                          `${formatDuration(durationMs)}…`
                        ) : r.error?.startsWith("Interrompido") ? (
                          <span className="text-faint" title="O processo parou sem registrar o fim; o horário de fim é quando a interrupção foi detectada.">
                            interrompida
                          </span>
                        ) : (
                          formatDuration(durationMs)
                        )}
                      </td>
                      <td className="whitespace-nowrap text-xs">{label}</td>
                      <td className="text-xs">{TRIGGER_LABEL[r.trigger] ?? r.trigger}</td>
                      <td>
                        <Badge tone={r.status === "ok" ? "ok" : isRunning ? "info" : r.status === "error" ? "accent" : "warn"}>
                          {RUN_STATUS_LABEL[r.status] ?? r.status}
                        </Badge>
                      </td>
                      <td className="text-xs text-muted" title={r.error ?? st.note ?? ""}>
                        {isRunning ? (
                          "acompanhe no topo da página"
                        ) : (
                          <>
                            {st.newItems ?? 0} manchetes novas
                            {!isIngestOnly(r) && ` · ${st.drafted ?? 0} redigidas · ${st.sentToReview ?? 0} p/ revisão · ${st.published ?? 0} publicadas`}
                            {(st.aiCostUsd ?? 0) > 0 && ` · US$ ${(st.aiCostUsd ?? 0).toFixed(3)}`}
                          </>
                        )}
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
