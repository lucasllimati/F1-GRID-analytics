import { db } from "../db";
import { env } from "../env";
import { logger, newRequestId } from "../log";
import { createEditorialAI } from "./ai-factory";
import { runNewsCycle } from "./pipeline";

/** Executa um ciclo com a configuração do ambiente (usado por cron, painel e CLI). */
export async function runConfiguredCycle(trigger: "cron" | "admin" | "cli", opts: { ingestOnly?: boolean; log?: (m: string) => void } = {}) {
  const e = env();
  const selection = createEditorialAI(e);
  const log = logger("news.cycle", { requestId: newRequestId(), trigger, ingestOnly: Boolean(opts.ingestOnly) });
  opts.log?.(`[ia] provedor=${selection.provider} modelo=${selection.model}${selection.ai ? "" : ` (desativada: ${selection.reason})`}`);
  const started = Date.now();
  log.info("ciclo iniciado", { provider: selection.provider, model: selection.model, aiEnabled: Boolean(selection.ai), mode: e.NEWS_PUBLISH_MODE });
  try {
    const result = await runNewsCycle({
      db,
      trigger,
      ingestOnly: opts.ingestOnly,
      mode: e.NEWS_PUBLISH_MODE,
      ai: selection.ai,
      aiUnavailableReason: selection.reason,
      maxPerRun: e.NEWS_MAX_ARTICLES_PER_RUN,
      maxPerDay: e.NEWS_MAX_ARTICLES_PER_DAY,
      fetchFullText: e.NEWS_FETCH_FULLTEXT,
      log: opts.log,
    });
    const s = result.stats;
    const failedSources = Object.entries(s.sources).filter(([, v]) => !v.ok).map(([k]) => k);
    log.info("ciclo concluído", {
      runId: result.runId,
      durationMs: Date.now() - started,
      newItems: s.newItems,
      storiesCreated: s.storiesCreated,
      drafted: s.drafted,
      published: s.published,
      sentToReview: s.sentToReview,
      failed: s.failed,
      aiCostUsd: s.aiCostUsd,
      failedSources,
    });
    return result;
  } catch (err) {
    log.error("ciclo falhou", { durationMs: Date.now() - started, error: err });
    throw err;
  }
}
