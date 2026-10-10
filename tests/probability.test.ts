import { describe, expect, it } from "vitest";
import { DEFAULT_ASSUMPTIONS, estimateStrengths, mulberry32, runChampionshipModel, type ModelInput } from "@/lib/f1/probability";
import type { RaceResultRow, SessionResult } from "@/lib/f1/types";

// Dados SINTÉTICOS de teste (não representam nenhuma temporada real).
function row(id: string, team: string, position: number | null, outcome: RaceResultRow["outcome"] = "finished"): RaceResultRow {
  return {
    position,
    positionText: position ? String(position) : "R",
    number: null,
    driver: { id, code: id.toUpperCase(), number: null, givenName: id, familyName: id, nationality: "" },
    constructor: { id: team, name: team, nationality: "" },
    grid: null,
    pitLaneStart: false,
    laps: null,
    status: outcome === "finished" ? "Finished" : "Engine",
    outcome,
    time: null,
    points: 0,
    fastestLapRank: null,
  };
}

function race(round: number, order: [string, string][], dnf: [string, string][] = []): SessionResult<RaceResultRow> {
  return {
    season: 2030,
    round,
    raceName: `Teste ${round}`,
    kind: "race",
    rows: [...order.map(([d, t], i) => row(d, t, i + 1)), ...dnf.map(([d, t]) => row(d, t, null, "retired"))],
    source: { id: "test", name: "sintético", url: "", licenseNote: "" },
    fetchedAt: "",
  };
}

const ORDER: [string, string][] = [
  ["a", "red"],
  ["b", "red"],
  ["c", "blue"],
  ["d", "blue"],
  ["e", "green"],
  ["f", "green"],
];
const races = Array.from({ length: 8 }, (_, i) => race(i + 1, ORDER));

function input(over: Partial<ModelInput> = {}): ModelInput {
  return {
    season: 2030,
    driverPoints: new Map([["a", 200], ["b", 150], ["c", 120], ["d", 90], ["e", 40], ["f", 10]]),
    constructorPoints: new Map([["red", 350], ["blue", 210], ["green", 50]]),
    raceResults: races,
    remainingRaces: 4,
    remainingSprints: 1,
    driverNames: new Map(),
    constructorNames: new Map(),
    ...over,
  };
}

describe("estimativa de força (Plackett-Luce)", () => {
  it("ordena as forças conforme os resultados", () => {
    const s = estimateStrengths(races, DEFAULT_ASSUMPTIONS);
    const v = (id: string) => s.logStrength.get(id)!;
    expect(v("a")).toBeGreaterThan(v("c"));
    expect(v("c")).toBeGreaterThan(v("e"));
  });
  it("abandonos elevam a taxa de quebra estimada", () => {
    const withDnf = [...races.slice(0, 4), ...Array.from({ length: 4 }, (_, i) => race(i + 5, ORDER.filter(([d]) => d !== "a"), [["a", "red"]]))];
    const s = estimateStrengths(withDnf, DEFAULT_ASSUMPTIONS);
    expect(s.dnfRate.get("a")!).toBeGreaterThan(s.dnfRate.get("b")!);
  });
});

describe("simulação de Monte Carlo", () => {
  const a = { ...DEFAULT_ASSUMPTIONS, simulations: 4000 };

  it("probabilidades somam 1", () => {
    const out = runChampionshipModel(input(), a);
    const sum = out.drivers.reduce((s, d) => s + d.titleProbability, 0);
    expect(sum).toBeCloseTo(1, 6);
    const tsum = out.constructors.reduce((s, d) => s + d.titleProbability, 0);
    expect(tsum).toBeCloseTo(1, 6);
  });

  it("piloto matematicamente eliminado tem probabilidade zero", () => {
    const out = runChampionshipModel(input(), a);
    const f = out.drivers.find((d) => d.id === "f")!;
    // 10 + 4×25 + 8 = 118 < 200
    expect(f.mathematicallyAlive).toBe(false);
    expect(f.titleProbability).toBe(0);
  });

  it("é reprodutível com a mesma semente", () => {
    const x = runChampionshipModel(input(), a);
    const y = runChampionshipModel(input(), a);
    expect(x.drivers.map((d) => d.titleProbability)).toEqual(y.drivers.map((d) => d.titleProbability));
  });

  it("título já decidido quando não restam corridas", () => {
    const out = runChampionshipModel(input({ remainingRaces: 0, remainingSprints: 0 }), a);
    expect(out.drivers[0]!.id).toBe("a");
    expect(out.drivers[0]!.titleProbability).toBe(1);
  });

  it("avisa quando há poucas corridas para estimar", () => {
    const out = runChampionshipModel(input({ raceResults: races.slice(0, 2) }), a);
    expect(out.warnings.join(" ")).toMatch(/não devem ser exibidas/);
  });

  it("o líder com mais força é favorito", () => {
    const out = runChampionshipModel(input(), a);
    expect(out.drivers[0]!.id).toBe("a");
    expect(out.drivers[0]!.titleProbability).toBeGreaterThan(0.5);
  });
});

describe("RNG", () => {
  it("gera valores em [0,1)", () => {
    const r = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
