import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { runConfiguredCycle } from "@/lib/news/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 24) return false; // sem segredo configurado, o endpoint fica fechado
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ingestOnly = req.nextUrl.searchParams.get("ingestOnly") === "1";
  try {
    const { runId, stats } = await runConfiguredCycle("cron", { ingestOnly });
    if (stats.published > 0) {
      revalidatePath("/");
      revalidatePath("/news");
    }
    return NextResponse.json({ runId, stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro";
    const status = message.includes("em execução") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// Vercel Cron usa GET com "Authorization: Bearer <CRON_SECRET>".
export const GET = handle;
export const POST = handle;
