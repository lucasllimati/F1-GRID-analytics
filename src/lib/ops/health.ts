import type { PrismaClient } from "@prisma/client";
import { jolpicaBreaker } from "../f1/providers/jolpica";
import { NEWS_SOURCES } from "../news/sources";
import type { Severity } from "../f1/validate";

// Estado do sistema e alertas DERIVADOS de medições reais (nunca um "verde" presumido).
// Os alertas são recalculados a cada consulta; não há (ainda) histórico/reconhecimento persistido —
// limitação registrada em docs/DIAGNOSTICO.md.

export type CheckStatus = "ok" | "degraded" | "down" | "unknown";
export type HealthCheck = { name: string; status: CheckStatus; detail: string; latencyMs?: number };
export type OpsAlert = {
  id: string;
  severity: Severity;
  category: "dados" | "notícias" | "infraestrutura" | "ia" | "editorial";
  title: string;
  detail: string;
  component: string;
  since?: Date;
  action: string;
};

const HOUR = 3_600_000;

export async function checkDatabase(db: PrismaClient): Promise<HealthCheck> {
  const t = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return { name: "Banco de dados", status: "ok", detail: "respondendo", latencyMs: Date.now() - t };
  } catch {
    return { name: "Banco de dados", status: "down", detail: "sem resposta", latencyMs: Date.now() - t };
  }
}

export function checkSportsSource(): HealthCheck {
  const b = jolpicaBreaker.snapshot();
  if (b.open) return { name: "Fonte esportiva (Jolpica)", status: "down", detail: "consultas pausadas pelo disjuntor após falhas seguidas" };
  if (b.failures > 0) return { name: "Fonte esportiva (Jolpica)", status: "degraded", detail: `${b.failures} falha(s) recente(s) nesta instância` };
  return { name: "Fonte esportiva (Jolpica)", status: "ok", detail: "sem falhas recentes nesta instância" };
}

export async function checkNewsIngestion(db: PrismaClient, now = new Date()): Promise<HealthCheck> {
  const last = await db.ingestionRun.findFirst({ where: { kind: "news_cycle", finishedAt: { not: null } }, orderBy: { startedAt: "desc" } });
  if (!last) return { name: "Monitoramento de notícias", status: "unknown", detail: "nenhum ciclo executado ainda" };
  const age = now.getTime() - last.startedAt.getTime();
  const h = Math.round(age / HOUR);
  if (age > 24 * HOUR) return { name: "Monitoramento de notícias", status: "down", detail: `último ciclo há ${h} h` };
  if (age > 6 * HOUR || last.status === "error") return { name: "Monitoramento de notícias", status: "degraded", detail: `último ciclo há ${h} h (${last.status})` };
  return { name: "Monitoramento de notícias", status: "ok", detail: `último ciclo há ${Math.max(1, Math.round(age / 60_000))} min (${last.status})` };
}

export type ConfigProblem = { severity: Severity; message: string; action: string };

/** Erros de configuração que quebram (ou degradam) a produção. Só mensagens — nunca valores. */
export function configProblems(e: NodeJS.ProcessEnv = process.env): ConfigProblem[] {
  const prod = e.NODE_ENV === "production";
  const out: ConfigProblem[] = [];
  if ((e.SESSION_SECRET ?? "").length < 32)
    out.push({ severity: prod ? "critical" : "low", message: "SESSION_SECRET ausente ou curto: o login do painel não funciona", action: "Gere 64 caracteres aleatórios (docs/DEPLOY.md) e configure na hospedagem." });
  if (prod && (e.DATABASE_URL ?? "").startsWith("file:"))
    out.push({ severity: "critical", message: "Banco SQLite em produção: os dados se perdem a cada deploy", action: "Use PostgreSQL (Neon) e o build \"npm run build:vercel\"." });
  if (prod && /^http:\/\/localhost/.test(e.SITE_URL ?? "") && !e.VERCEL_PROJECT_PRODUCTION_URL)
    out.push({ severity: "medium", message: "SITE_URL aponta para localhost: links do RSS, sitemap e compartilhamento ficam errados", action: "Configure SITE_URL com o domínio público (https://…)." });
  return out;
}

export function checkConfig(): HealthCheck {
  const p = configProblems();
  if (p.some((x) => x.severity === "critical")) return { name: "Configuração", status: "down", detail: p.map((x) => x.message).join("; ") };
  if (p.some((x) => x.severity !== "low")) return { name: "Configuração", status: "degraded", detail: p.map((x) => x.message).join("; ") };
  return { name: "Configuração", status: "ok", detail: p.length ? p.map((x) => x.message).join("; ") : "variáveis essenciais presentes" };
}

export function overall(checks: HealthCheck[]): CheckStatus {
  if (checks.some((c) => c.name === "Banco de dados" && c.status === "down")) return "down";
  if (checks.some((c) => c.status === "down" || c.status === "degraded")) return "degraded";
  return "ok";
}

/** Alertas operacionais a partir do estado atual. */
export async function deriveAlerts(db: PrismaClient, opts: { aiEnabled: boolean; aiReason?: string; now?: Date }): Promise<OpsAlert[]> {
  const now = opts.now ?? new Date();
  const alerts: OpsAlert[] = [];

  const dbCheck = await checkDatabase(db);
  if (dbCheck.status === "down") {
    alerts.push({ id: "db.down", severity: "critical", category: "infraestrutura", title: "Banco de dados sem resposta", detail: dbCheck.detail, component: "banco", action: "Verifique DATABASE_URL e o serviço do banco; veja docs/RUNBOOK.md." });
    return alerts;
  }

  for (const [i, p] of configProblems().entries()) {
    alerts.push({ id: `config.${i}`, severity: p.severity, category: "infraestrutura", title: p.message, detail: "", component: "configuração", action: p.action });
  }

  const sports = checkSportsSource();
  if (sports.status !== "ok") {
    alerts.push({
      id: "sports.source",
      severity: sports.status === "down" ? "high" : "medium",
      category: "dados",
      title: "Fonte de dados esportivos instável",
      detail: sports.detail,
      component: "Jolpica",
      action: "Páginas exibem estado de erro sem inventar dados. Aguarde; se persistir, verifique o status da Jolpica e os logs \"f1.jolpica\".",
    });
  }

  const ingestion = await checkNewsIngestion(db, now);
  if (ingestion.status === "down" || ingestion.status === "degraded") {
    alerts.push({
      id: "news.stale",
      severity: ingestion.status === "down" ? "high" : "medium",
      category: "notícias",
      title: "Monitoramento de notícias atrasado",
      detail: ingestion.detail,
      component: "pipeline de notícias",
      action: "Confirme o agendamento (Vercel Cron / Agendador de Tarefas) ou rode \"Só buscar manchetes\".",
    });
  }

  const sources = await db.newsSource.findMany();
  for (const s of sources) {
    if (!s.enabled) continue;
    if (s.lastStatus === "error") {
      alerts.push({
        id: `source.${s.id}`,
        severity: "medium",
        category: "notícias",
        title: `Fonte ${s.name} com erro na última coleta`,
        detail: (s.lastError ?? "erro desconhecido").slice(0, 200),
        component: s.id,
        since: s.lastFetchedAt ?? undefined,
        action: "Verifique se o feed mudou de endereço (docs/DATA_SOURCES.md). Outras fontes seguem funcionando.",
      });
    }
  }
  const unknownSources = NEWS_SOURCES.filter((d) => !sources.some((s) => s.id === d.id));
  if (unknownSources.length && sources.length > 0) {
    alerts.push({ id: "source.unregistered", severity: "low", category: "notícias", title: "Fontes ainda não registradas no banco", detail: unknownSources.map((s) => s.name).join(", "), component: "fontes", action: "Rode um ciclo de monitoramento." });
  }

  if (!opts.aiEnabled) {
    alerts.push({ id: "ai.disabled", severity: "low", category: "ia", title: "Redação automática desativada", detail: opts.aiReason ?? "IA não configurada", component: "IA", action: "Configure a chave no .env (docs/GEMINI.md) e rode npm run ai:check." });
  }
  const dayAgo = new Date(now.getTime() - 24 * HOUR);
  const [aiFails, aiTotal] = await Promise.all([
    db.agentRun.count({ where: { startedAt: { gt: dayAgo }, status: { not: "ok" } } }),
    db.agentRun.count({ where: { startedAt: { gt: dayAgo } } }),
  ]);
  if (aiTotal >= 3 && aiFails / aiTotal >= 0.5) {
    alerts.push({
      id: "ai.failures",
      severity: "medium",
      category: "ia",
      title: "Muitas falhas da IA nas últimas 24 h",
      detail: `${aiFails} de ${aiTotal} execuções falharam`,
      component: "IA",
      action: "Veja \"Falhas recentes de agentes\". No plano gratuito é comum \"limite atingido\"; reduza NEWS_MAX_ARTICLES_PER_RUN.",
    });
  }

  const oldestPending = await db.article.findFirst({ where: { status: "in_review" }, orderBy: { createdAt: "asc" } });
  if (oldestPending && now.getTime() - oldestPending.createdAt.getTime() > 12 * HOUR) {
    alerts.push({
      id: "editorial.backlog",
      severity: "low",
      category: "editorial",
      title: "Matéria aguardando revisão há mais de 12 h",
      detail: oldestPending.headline.slice(0, 120),
      component: "fila de revisão",
      since: oldestPending.createdAt,
      action: "Revise ou rejeite: notícias perdem relevância rapidamente.",
    });
  }

  const order: Severity[] = ["critical", "high", "medium", "low"];
  return alerts.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
}
