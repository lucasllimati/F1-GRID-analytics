import { describe, expect, it } from "vitest";
import { mapOutcome, mapRace } from "@/lib/f1/providers/jolpica";
import { compareCountback, maxRemainingDriverPoints, maxRemainingTeamPoints, pointsSystem, racePoints, sprintPoints } from "@/lib/f1/points";
import { deriveEventStatus, nextSession } from "@/lib/f1/schedule";
import type { Session } from "@/lib/f1/types";

// Fixture no formato real da Jolpica (etapa Sprint de 2026, campos reduzidos).
const sprintRace = {
  season: "2026",
  round: "17",
  raceName: "Singapore Grand Prix",
  Circuit: { circuitId: "marina_bay", circuitName: "Marina Bay Street Circuit", Location: { locality: "Marina Bay", country: "Singapore" } },
  date: "2026-10-11",
  time: "12:00:00Z",
  FirstPractice: { date: "2026-10-09", time: "08:30:00Z" },
  SprintQualifying: { date: "2026-10-09", time: "12:30:00Z" },
  Sprint: { date: "2026-10-10", time: "09:00:00Z" },
  Qualifying: { date: "2026-10-10", time: "13:00:00Z" },
};

describe("adaptador Jolpica", () => {
  it("detecta formato Sprint e não inventa sessões ausentes (sem TL2/TL3)", () => {
    const e = mapRace(sprintRace, false, new Date("2026-10-01T00:00:00Z"));
    expect(e.format).toBe("sprint");
    expect(e.sessions.map((s) => s.type)).toEqual(["fp1", "sprint_qualifying", "sprint", "qualifying", "race"]);
    expect(e.timeZone).toBe("Asia/Singapore");
    expect(e.status).toBe("upcoming");
  });

  it("sessão sem horário publicado fica com startsAt nulo", () => {
    const e = mapRace({ ...sprintRace, time: undefined }, false, new Date("2026-10-01T00:00:00Z"));
    const race = e.sessions.find((s) => s.type === "race")!;
    expect(race.startsAt).toBeNull();
    expect(race.date).toBe("2026-10-11");
  });

  it("circuito desconhecido não recebe fuso inventado", () => {
    const e = mapRace({ ...sprintRace, Circuit: { ...sprintRace.Circuit, circuitId: "novo_circuito" } }, false, new Date());
    expect(e.timeZone).toBeNull();
  });

  it("mapeia estados especiais sem convertê-los em posição", () => {
    expect(mapOutcome("1", "Finished")).toBe("finished");
    expect(mapOutcome("12", "+1 Lap")).toBe("lapped");
    expect(mapOutcome("R", "Engine")).toBe("retired");
    expect(mapOutcome("D", "Disqualified")).toBe("disqualified");
    expect(mapOutcome("W", "Did not start")).toBe("did_not_start");
    expect(mapOutcome("N", "Collision")).toBe("not_classified");
    expect(mapOutcome("F", "107% Rule")).toBe("did_not_qualify");
  });
});

describe("estado do evento", () => {
  const sessions: Session[] = [
    { type: "fp1", date: "2026-10-09", startsAt: "2026-10-09T08:30:00.000Z" },
    { type: "race", date: "2026-10-11", startsAt: "2026-10-11T12:00:00.000Z" },
  ];
  it("upcoming → em andamento → aguardando → concluído, sem 'ao vivo'", () => {
    expect(deriveEventStatus(sessions, false, new Date("2026-10-08T00:00:00Z"))).toBe("upcoming");
    expect(deriveEventStatus(sessions, false, new Date("2026-10-10T00:00:00Z"))).toBe("weekend_underway");
    expect(deriveEventStatus(sessions, false, new Date("2026-10-11T13:00:00Z"))).toBe("awaiting_results");
    expect(deriveEventStatus(sessions, true, new Date("2026-10-11T13:00:00Z"))).toBe("completed");
  });
  it("próxima sessão ignora sessões sem horário", () => {
    const e = mapRace(sprintRace, false, new Date("2026-10-09T10:00:00Z"));
    expect(nextSession(e, new Date("2026-10-09T10:00:00Z"))?.type).toBe("sprint_qualifying");
  });
});

describe("pontuação por temporada", () => {
  it("2026: sem ponto de volta mais rápida; sprint 8→1", () => {
    const s = pointsSystem(2026);
    expect(racePoints(s, 1, true)).toBe(25);
    expect(racePoints(s, 10)).toBe(1);
    expect(racePoints(s, 11)).toBe(0);
    expect(sprintPoints(s, 1)).toBe(8);
    expect(sprintPoints(s, 9)).toBe(0);
  });
  it("2019–2024: ponto extra de volta mais rápida só no top 10", () => {
    const s = pointsSystem(2023);
    expect(racePoints(s, 1, true)).toBe(26);
    expect(racePoints(s, 11, true)).toBe(0);
  });
  it("2021: sprint 3-2-1", () => {
    expect(pointsSystem(2021).sprint).toEqual([3, 2, 1]);
  });
  it("recusa temporadas não suportadas", () => {
    expect(() => pointsSystem(1990)).toThrow();
  });
  it("máximo restante (piloto e equipe)", () => {
    const s = pointsSystem(2026);
    expect(maxRemainingDriverPoints(s, 6, 0)).toBe(150);
    expect(maxRemainingDriverPoints(s, 6, 1)).toBe(158);
    expect(maxRemainingTeamPoints(s, 1, 1)).toBe(43 + 15);
  });
  it("desempate por countback (mais vitórias, depois mais 2º lugares)", () => {
    expect(compareCountback([3, 1], [2, 5])).toBeLessThan(0);
    expect(compareCountback([2, 1], [2, 3])).toBeGreaterThan(0);
    expect(compareCountback([1, 1], [1, 1])).toBe(0);
  });
});
