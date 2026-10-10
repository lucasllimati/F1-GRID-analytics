import { db } from "../db";
import { env } from "../env";
import { runNewsCycle } from "./pipeline";

/** Executa um ciclo com a configuração do ambiente (usado por cron, painel e CLI). */
export function runConfiguredCycle(trigger: "cron" | "admin" | "cli", opts: { ingestOnly?: boolean; log?: (m: string) => void } = {}) {
  const e = env();
  return runNewsCycle({
    db,
    trigger,
    ingestOnly: opts.ingestOnly,
    mode: e.NEWS_PUBLISH_MODE,
    apiKey: e.ANTHROPIC_API_KEY,
    model: e.NEWS_AI_MODEL,
    maxPerRun: e.NEWS_MAX_ARTICLES_PER_RUN,
    maxPerDay: e.NEWS_MAX_ARTICLES_PER_DAY,
    fetchFullText: e.NEWS_FETCH_FULLTEXT,
    log: opts.log,
  });
}
