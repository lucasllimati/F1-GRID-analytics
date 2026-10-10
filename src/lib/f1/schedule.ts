import type { EventStatus, RaceEvent, Session, SessionType } from "./types";

/** Ordem cronológica nominal; a ordenação real usa o horário oficial quando existe. */
const SESSION_ORDER: SessionType[] = ["fp1", "fp2", "fp3", "sprint_qualifying", "sprint", "qualifying", "race"];

export function sortSessions(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => {
    const ta = a.startsAt ? Date.parse(a.startsAt) : Date.parse(`${a.date}T12:00:00Z`);
    const tb = b.startsAt ? Date.parse(b.startsAt) : Date.parse(`${b.date}T12:00:00Z`);
    if (ta !== tb) return ta - tb;
    return SESSION_ORDER.indexOf(a.type) - SESSION_ORDER.indexOf(b.type);
  });
}

/**
 * Deriva o estado do evento SOMENTE a partir de fatos publicados:
 * horários oficiais e a existência de resultado oficial na fonte.
 * Nunca retorna "ao vivo".
 */
export function deriveEventStatus(sessions: Session[], raceResultPublished: boolean, now: Date): EventStatus {
  if (raceResultPublished) return "completed";
  const race = sessions.find((s) => s.type === "race");
  const raceStart = race?.startsAt ? Date.parse(race.startsAt) : race ? Date.parse(`${race.date}T23:59:59Z`) : NaN;
  if (!Number.isNaN(raceStart) && now.getTime() >= raceStart) return "awaiting_results";
  const first = sortSessions(sessions)[0];
  const firstStart = first?.startsAt ? Date.parse(first.startsAt) : NaN;
  if (!Number.isNaN(firstStart) && now.getTime() >= firstStart) return "weekend_underway";
  return "upcoming";
}

/** Próximo evento ainda não concluído (inclui fim de semana em andamento). */
export function nextEvent(events: RaceEvent[]): RaceEvent | null {
  return events.find((e) => e.status !== "completed") ?? null;
}

/** Próxima sessão com horário oficial ainda no futuro. */
export function nextSession(event: RaceEvent, now: Date): Session | null {
  return (
    sortSessions(event.sessions).find((s) => s.startsAt !== null && Date.parse(s.startsAt) > now.getTime()) ?? null
  );
}

export function lastCompletedEvent(events: RaceEvent[]): RaceEvent | null {
  const done = events.filter((e) => e.status === "completed");
  return done[done.length - 1] ?? null;
}

export function eventStart(event: RaceEvent): Date | null {
  const first = sortSessions(event.sessions)[0];
  if (!first) return null;
  return new Date(first.startsAt ?? `${first.date}T00:00:00Z`);
}

export function raceSession(event: RaceEvent): Session | null {
  return event.sessions.find((s) => s.type === "race") ?? null;
}
