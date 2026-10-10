import { redirect } from "next/navigation";
import { Container, ErrorState } from "@/components/ui";
import { lastCompletedEvent, nextEvent } from "@/lib/f1/schedule";
import { f1, load } from "@/lib/f1/service";

export const dynamic = "force-dynamic";

/** Race Center: abre o evento em andamento/próximo (ou o último, se a temporada acabou). */
export default async function RaceCenter() {
  const r = await load(f1.getSchedule("current"));
  if (!r.ok) return <Container className="py-16"><ErrorState message={r.error} /></Container>;
  const e = nextEvent(r.data) ?? lastCompletedEvent(r.data);
  if (!e) return <Container className="py-16"><ErrorState message="Calendário vazio na fonte." /></Container>;
  redirect(`/calendar/${e.season}/${e.round}`);
}
