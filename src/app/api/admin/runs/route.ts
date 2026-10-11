import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { LOCK_MINUTES } from "@/lib/news/pipeline";
import { parseProgress } from "@/lib/news/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Estado da execução em andamento (e da última concluída) para o banner de progresso do painel.
// Exige sessão administrativa; não expõe erros internos além do resumo já visível no painel.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const noStore = { "Cache-Control": "no-store, private" };

  const since = new Date(Date.now() - LOCK_MINUTES * 60_000);
  const [running, last] = await Promise.all([
    db.ingestionRun.findFirst({ where: { kind: "news_cycle", status: "running", startedAt: { gt: since } }, orderBy: { startedAt: "desc" } }),
    db.ingestionRun.findFirst({ where: { kind: "news_cycle", finishedAt: { not: null } }, orderBy: { finishedAt: "desc" } }),
  ]);

  const progress = running ? parseProgress(running.progress) : null;
  const updatedAt = progress?.updatedAt ? Date.parse(progress.updatedAt) : running?.startedAt.getTime();
  return NextResponse.json(
    {
      now: Date.now(),
      running: running
        ? {
            id: running.id,
            trigger: running.trigger,
            startedAt: running.startedAt.getTime(),
            progress,
            // Sem atualização há mais de 2 min: processo provavelmente interrompido (a trava expira em LOCK_MINUTES).
            stale: updatedAt !== undefined && Date.now() - updatedAt > 120_000,
          }
        : null,
      lastFinished: last
        ? {
            id: last.id,
            status: last.status,
            finishedAt: last.finishedAt!.getTime(),
            durationMs: last.finishedAt!.getTime() - last.startedAt.getTime(),
          }
        : null,
    },
    { headers: noStore },
  );
}
