import { describe, expect, it, vi } from "vitest";
import { mapRace } from "@/lib/f1/providers/jolpica";
import type { RaceResultRow, SessionResult } from "@/lib/f1/types";
import { validateSeason } from "@/lib/f1/validate";
import { redact } from "@/lib/log";
import { CircuitBreaker, CircuitOpenError, RateLimiter, RetryableHttpError, isRetryable, withRetry } from "@/lib/net/resilient";

describe("novas tentativas com backoff", () => {
  const fast = { retries: 2, baseDelayMs: 10, maxDelayMs: 100, sleep: async () => {}, random: () => 0.5 };

  it("tenta de novo em 503 e devolve o sucesso", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new RetryableHttpError(503, "x")).mockResolvedValueOnce("ok");
    expect(await withRetry(fn, fast)).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("não insiste em erro 4xx (exceto 429)", async () => {
    const fn = vi.fn().mockRejectedValue(new RetryableHttpError(404, "x"));
    await expect(withRetry(fn, fast)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("número de tentativas é limitado (nunca infinito)", async () => {
    const fn = vi.fn().mockRejectedValue(new RetryableHttpError(500, "x"));
    await expect(withRetry(fn, fast)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("respeita Retry-After do 429, com teto", async () => {
    const delays: number[] = [];
    const fn = vi.fn().mockRejectedValueOnce(new RetryableHttpError(429, "x", 3_000)).mockResolvedValueOnce("ok");
    await withRetry(fn, { ...fast, sleep: async (ms) => void delays.push(ms) });
    expect(delays[0]).toBe(3_000);
  });

  it("classifica erros de rede como transitórios", () => {
    expect(isRetryable(new TypeError("fetch failed"))).toBe(true);
    expect(isRetryable(new CircuitOpenError("x", 1000))).toBe(false);
  });
});

describe("disjuntor", () => {
  it("abre após N falhas, bloqueia durante o cooldown e fecha após sucesso", () => {
    let t = 0;
    const b = new CircuitBreaker("teste", 3, 1_000, () => t);
    b.failure();
    b.failure();
    expect(() => b.guard()).not.toThrow();
    b.failure();
    expect(() => b.guard()).toThrow(CircuitOpenError);
    t = 1_500; // passou o cooldown: deixa uma tentativa passar
    expect(() => b.guard()).not.toThrow();
    b.success();
    expect(b.snapshot().open).toBe(false);
  });
});

describe("limitador de taxa", () => {
  it("nunca excede a concorrência configurada", async () => {
    const lim = new RateLimiter(2, 0);
    let active = 0;
    let peak = 0;
    const job = () =>
      lim.run(async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
      });
    await Promise.all(Array.from({ length: 8 }, job));
    expect(peak).toBeLessThanOrEqual(2);
  });
});

describe("logs", () => {
  it("mascara segredos em qualquer nível", () => {
    const out = redact({ user: "a", password: "x", nested: { apiKey: "k", authorization: "Bearer y", ok: 1 } }) as Record<string, any>;
    expect(out.password).toBe("[redacted]");
    expect(out.nested.apiKey).toBe("[redacted]");
    expect(out.nested.authorization).toBe("[redacted]");
    expect(out.nested.ok).toBe(1);
  });
});

describe("validação de dados", () => {
  const src = { id: "t", name: "t", url: "", licenseNote: "" };
  const row = (id: string, pos: number | null, pts: number): RaceResultRow => ({
    position: pos,
    positionText: pos ? String(pos) : "R",
    number: null,
    driver: { id, code: null, number: null, givenName: id, familyName: id, nationality: "" },
    constructor: { id: "t", name: "T", nationality: "" },
    grid: 1,
    pitLaneStart: false,
    laps: 10,
    status: "Finished",
    outcome: pos ? "finished" : "retired",
    time: null,
    points: pts,
    fastestLapRank: null,
  });
  const race = (round: number, rows: RaceResultRow[]): SessionResult<RaceResultRow> => ({ season: 2026, round, raceName: `GP ${round}`, kind: "race", rows, source: src, fetchedAt: "" });
  const ev = (round: number) =>
    mapRace(
      { season: "2026", round: String(round), raceName: `GP ${round}`, Circuit: { circuitId: "monza", circuitName: "Monza", Location: { locality: "Monza", country: "Italy" } }, date: "2026-09-06", time: "13:00:00Z" },
      true,
      new Date(),
    );
  const standings = (pts: [string, number][]) => ({
    season: 2026,
    round: 1,
    rows: pts.map(([id, p], i) => ({ position: i + 1, positionText: String(i + 1), points: p, wins: i === 0 ? 1 : 0, driver: { id, code: null, number: null, givenName: id, familyName: id, nationality: "" }, constructors: [] })),
  });

  it("dados coerentes não geram alertas", () => {
    const issues = validateSeason({
      season: 2026,
      events: [ev(1)],
      data: { races: [race(1, [row("a", 1, 25), row("b", 2, 18)])], sprints: [], qualis: [] },
      driverStandings: standings([["a", 25], ["b", 18]]),
      constructorStandings: { season: 2026, round: 1, rows: [{ position: 1, positionText: "1", points: 43, wins: 1, constructor: { id: "t", name: "T", nationality: "" } }] },
    });
    expect(issues).toEqual([]);
  });

  it("detecta piloto duplicado, pontos fora da regra e soma divergente da oficial", () => {
    const issues = validateSeason({
      season: 2026,
      events: [ev(1)],
      data: { races: [race(1, [row("a", 1, 25), row("a", 2, 18), row("c", 3, 99)])], sprints: [], qualis: [] },
      driverStandings: standings([["a", 50], ["c", 15]]),
      constructorStandings: { season: 2026, round: 1, rows: [] },
    });
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("results.duplicate_driver");
    expect(codes).toContain("points.rule_mismatch");
    expect(codes).toContain("standings.points_mismatch");
    expect(issues[0]!.severity).toBe("high"); // ordenado por severidade
  });

  it("resultado de etapa fora do calendário é alerta alto", () => {
    const issues = validateSeason({
      season: 2026,
      events: [ev(1)],
      data: { races: [race(1, [row("a", 1, 25)]), race(9, [row("a", 1, 25)])], sprints: [], qualis: [] },
      driverStandings: standings([["a", 50]]),
      constructorStandings: { season: 2026, round: 1, rows: [] },
    });
    expect(issues.some((i) => i.code === "results.orphan_round" && i.severity === "high")).toBe(true);
  });
});
