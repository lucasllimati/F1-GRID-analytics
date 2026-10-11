import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkDatabase, checkNewsIngestion, checkSportsSource, overall } from "@/lib/ops/health";
import pkg from "../../../../package.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Health check público para monitoramento externo (uptime).
// Expõe só estados agregados — nenhum erro interno, caminho ou segredo.
// 200 = ok/degradado (site no ar), 503 = banco fora (site sem conteúdo editorial).
export async function GET() {
  const checks = [await checkDatabase(db), checkSportsSource()];
  try {
    checks.push(await checkNewsIngestion(db));
  } catch {
    checks.push({ name: "Monitoramento de notícias", status: "unknown", detail: "" });
  }
  const status = overall(checks);
  return NextResponse.json(
    {
      status,
      version: pkg.version,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      time: new Date().toISOString(),
      checks: Object.fromEntries(checks.map((c) => [c.name, c.status])),
    },
    { status: status === "down" ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
