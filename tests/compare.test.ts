import { describe, expect, it } from "vitest";
import { analyzeEntity, championshipPositions, headToHead, seasonEntities, teammateDuels, type SeasonData } from "@/lib/f1/compare";
import type { QualifyingRow, RaceResultRow, ResultOutcome, SessionResult } from "@/lib/f1/types";

// Dados SINTÉTICOS de teste.
const src = { id: "t", name: "teste", url: "", licenseNote: "" };
const PTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

function rr(driver: string, team: string, position: number | null, grid: number | null, outcome: ResultOutcome = "finished", points?: number): RaceResultRow {
  return {
    position,
    positionText: position ? String(position) : "R",
    number: null,
    driver: { id: driver, code: null, number: null, givenName: driver.toUpperCase(), familyName: driver, nationality: "" },
    constructor: { id: team, name: team.toUpperCase(), nationality: "" },
    grid,
    pitLaneStart: false,
    laps: null,
    status: "",
    outcome,
    time: null,
    points: points ?? (position ? (PTS[position - 1] ?? 0) : 0),
    fastestLapRank: null,
  };
}

function race(round: number, rows: RaceResultRow[], kind: "race" | "sprint" = "race"): SessionResult<RaceResultRow> {
  return { season: 2030, round, raceName: `GP ${round}`, kind, rows, source: src, fetchedAt: "" };
}

function quali(round: number, order: [string, string][]): SessionResult<QualifyingRow> {
  return {
    season: 2030,
    round,
    raceName: `GP ${round}`,
    kind: "qualifying",
    rows: order.map(([d, t], i) => ({
      position: i + 1,
      number: null,
      driver: { id: d, code: null, number: null, givenName: d, familyName: d, nationality: "" },
      constructor: { id: t, name: t, nationality: "" },
      q1: "1:30",
      q2: i < 3 ? "1:29" : null,
      q3: i < 2 ? "1:28" : null,
    })),
    source: src,
    fetchedAt: "",
  };
}

const data: SeasonData = {
  races: [
    race(1, [rr("a", "red", 1, 2), rr("b", "red", 2, 1), rr("c", "blue", 3, 3), rr("d", "blue", null, 4, "retired")]),
    race(2, [rr("c", "blue", 1, 1), rr("a", "red", 2, 3), rr("d", "blue", 3, 2), rr("b", "red", null, 4, "retired")]),
    race(3, [rr("c", "blue", 1, 2), rr("d", "blue", 2, 1), rr("b", "red", 3, 4), rr("a", "red", 4, 3)]),
  ],
  sprints: [race(2, [rr("b", "red", 1, 1, "finished", 8), rr("a", "red", 2, 2, "finished", 7), rr("c", "blue", 3, 3, "finished", 6)], "sprint")],
  qualis: [
    quali(1, [["b", "red"], ["a", "red"], ["c", "blue"], ["d", "blue"]]),
    quali(2, [["c", "blue"], ["d", "blue"], ["a", "red"], ["b", "red"]]),
    quali(3, [["d", "blue"], ["c", "blue"], ["a", "red"], ["b", "red"]]),
  ],
};

describe("análise comparativa", () => {
  it("lista entidades pelos pontos publicados", () => {
    // a: 25+18+7+12 = 62 · c: 15+25+6+25 = 71
    const e = seasonEntities(data, "driver");
    expect(e[0]).toMatchObject({ id: "c", points: 71 });
    expect(e.find((x) => x.id === "a")?.points).toBe(62);
  });

  it("recalcula a posição no campeonato após cada etapa", () => {
    const champ = championshipPositions(data, "driver");
    expect(champ.get(1)?.get("a")).toBe(1);
    expect(champ.get(3)?.get("c")).toBe(1);
  });

  it("resume estatísticas de piloto sem inventar posições em abandonos", () => {
    const a = analyzeEntity(data, "driver", "b")!;
    expect(a.summary).toMatchObject({ wins: 0, podiums: 2, dnfs: 1, poles: 1, sprintWins: 1, sprintPoints: 8, starts: 3 });
    expect(a.rounds[1]!.racePos).toBeNull();
    expect(a.rounds[1]!.raceOutcome).toBe("retired");
    // Média só de provas terminadas: (2 + 3) / 2
    expect(a.summary.avgFinish).toBe(2.5);
    // Posições ganhas: (1→2) = −1, (4→3) = +1
    expect(a.summary.positionsGained).toBe(0);
  });

  it("acumula pontos de corrida e sprint", () => {
    const a = analyzeEntity(data, "driver", "a")!;
    expect(a.rounds.map((r) => r.cumulative)).toEqual([25, 50, 62]);
  });

  it("equipe usa o melhor carro em posições e soma pontos dos dois", () => {
    const blue = analyzeEntity(data, "team", "blue")!;
    expect(blue.rounds.map((r) => r.racePos)).toEqual([3, 1, 1]);
    expect(blue.rounds[2]!.points).toBe(43);
    expect(blue.summary.doublePoints).toBe(2);
    expect(blue.rounds.map((r) => r.qualiPos)).toEqual([3, 1, 1]);
  });

  it("confronto direto: classificado vence quem abandonou; qualificação compara posições", () => {
    const h = headToHead(analyzeEntity(data, "driver", "a")!, analyzeEntity(data, "driver", "b")!);
    expect(h.raceAhead).toEqual([2, 1]);
    expect(h.raceComparable).toBe(3);
    expect(h.qualiAhead).toEqual([2, 1]);
    expect(h.sprintAhead).toEqual([0, 1]);
  });

  it("tendência indefinida com amostra curta", () => {
    expect(analyzeEntity(data, "driver", "a")!.summary.trend.direction).toBe("indefinida");
  });

  it("duelo de companheiros mostra o líder primeiro", () => {
    const duels = teammateDuels(data);
    const red = duels.find((d) => d.team === "RED")!;
    expect(red.drivers).toEqual(["A a", "B b"]);
    expect(red.points).toEqual([62, 41]);
  });

  it("entidade inexistente retorna null", () => {
    expect(analyzeEntity(data, "driver", "zzz")).toBeNull();
  });
});
