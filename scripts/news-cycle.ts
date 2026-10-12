// Executa um ciclo da redação pela linha de comando (útil com Agendador de Tarefas/cron do sistema).
// Uso: npm run news:cycle            (monitorar + redigir conforme NEWS_PUBLISH_MODE)
//      npm run news:ingest           (somente monitorar e agrupar pautas)
try {
  process.loadEnvFile(".env");
} catch {}

async function main() {
  const { runConfiguredCycle } = await import("../src/lib/news/run");
  const { db } = await import("../src/lib/db");
  const ingestOnly = process.argv.includes("--ingest-only");
  const { runId, stats } = await runConfiguredCycle(process.env.NEWS_TRIGGER === "cron" ? "cron" : "cli", { ingestOnly, log: (m) => console.log(m) });
  console.log(`\nCiclo ${runId} concluído:`);
  console.log(JSON.stringify(stats, null, 2));
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

export {};
