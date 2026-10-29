import { siteUrl } from "@/lib/env";
import { buildIcs } from "@/lib/f1/ics";
import { f1 } from "@/lib/f1/service";

// Calendário assinável (.ics) de todas as sessões da temporada atual.
export const revalidate = 3600;

export async function GET() {
  try {
    const events = await f1.getSchedule("current");
    return new Response(buildIcs(events, { siteUrl: siteUrl() }), {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'inline; filename="f1-apex-grid.ics"',
        "cache-control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("Calendário indisponível no momento. Tente novamente em alguns minutos.", { status: 503 });
  }
}
