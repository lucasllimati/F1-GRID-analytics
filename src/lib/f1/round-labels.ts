import type { RaceEvent } from "./types";

// Rótulos de etapa para gráficos: curto no eixo (país, ou cidade quando o país se repete
// na temporada — EUA, Espanha…) e detalhado no tooltip (GP, circuito, cidade, data).

export type RoundLabel = { round: number; short: string; title: string; detail: string };

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "short" });

export function roundLabels(events: RaceEvent[]): Map<number, RoundLabel> {
  const countryCount = new Map<string, number>();
  for (const e of events) countryCount.set(e.countryPt, (countryCount.get(e.countryPt) ?? 0) + 1);
  const out = new Map<number, RoundLabel>();
  for (const e of events) {
    const race = e.sessions.find((s) => s.type === "race");
    const date = race ? dateFmt.format(new Date(`${race.date}T12:00:00Z`)) : "";
    const repeated = (countryCount.get(e.countryPt) ?? 0) > 1;
    out.set(e.round, {
      round: e.round,
      short: repeated ? e.locality : e.countryPt,
      title: `Etapa ${e.round} · ${e.name}`,
      detail: [e.circuitName, `${e.locality}, ${e.countryPt}`, date, e.format === "sprint" ? "fim de semana Sprint" : null]
        .filter(Boolean)
        .join(" · "),
    });
  }
  return out;
}

/** Fallback quando o calendário não carregou: usa o nome do GP vindo dos resultados. */
export function fallbackLabel(round: number, raceName: string): RoundLabel {
  const short = raceName.replace(/ Grand Prix.*$/, "");
  return { round, short, title: `Etapa ${round} · ${raceName}`, detail: "" };
}
