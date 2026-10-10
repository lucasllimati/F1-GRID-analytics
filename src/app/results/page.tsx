import { redirect } from "next/navigation";
import { Container, ErrorState } from "@/components/ui";
import { lastCompletedEvent } from "@/lib/f1/schedule";
import { f1, load } from "@/lib/f1/service";

export const dynamic = "force-dynamic";

/** Resultados: abre o último evento com resultado oficial publicado. */
export default async function Results() {
  const r = await load(f1.getSchedule("current"));
  if (!r.ok) return <Container className="py-16"><ErrorState message={r.error} /></Container>;
  const e = lastCompletedEvent(r.data);
  if (!e) redirect("/calendar");
  redirect(`/calendar/${e.season}/${e.round}?tab=race`);
}
