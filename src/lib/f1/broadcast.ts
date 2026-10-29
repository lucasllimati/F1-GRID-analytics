import type { RaceEvent, SessionType } from "./types";

// Onde assistir no Brasil. Direitos de transmissão mudam e a grade das emissoras também:
// por isso o texto sempre pede para confirmar na programação e a data da última revisão aparece.
// Para atualizar: edite este arquivo (TV aberta por circuito/sessão) e a data abaixo.

export const BROADCAST_REVIEWED = "2026-10-29";

/** Todas as sessões da temporada. */
export const BROADCAST_DEFAULT = ["SporTV", "Globoplay", "F1 TV Pro"];

/** Sessões com transmissão em TV aberta conhecida (circuito → sessões). */
const OPEN_TV: Record<string, { channel: string; sessions: SessionType[] }> = {
  interlagos: { channel: "Globo", sessions: ["race"] },
};

export function openTvChannel(event: Pick<RaceEvent, "circuitId">, session: SessionType): string | null {
  const o = OPEN_TV[event.circuitId];
  return o && o.sessions.includes(session) ? o.channel : null;
}

export function broadcastSummary(event: Pick<RaceEvent, "circuitId">): string {
  const open = OPEN_TV[event.circuitId];
  const base = `Todas as sessões no ${BROADCAST_DEFAULT.slice(0, -1).join(", ")} e ${BROADCAST_DEFAULT.at(-1)}.`;
  return open ? `${base} ${open.sessions.includes("race") ? "Corrida" : "Sessões selecionadas"} também na ${open.channel} (TV aberta).` : `Sem TV aberta prevista. ${base}`;
}
