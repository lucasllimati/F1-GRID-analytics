import { describe, expect, it } from "vitest";
import type { SeasonData } from "@/lib/f1/compare";
import { gpName } from "@/lib/f1/gp-names";
import { pointsSystem } from "@/lib/f1/points";
import { buildSeasonGrid } from "@/lib/f1/season-grid";
import { eliminationTimeline, titleStatus, type RemainingEvent } from "@/lib/f1/title-math";
import type { RaceEvent, RaceResultRow, ResultOutcome, SessionResult } from "@/lib/f1/types";

// Dados SINTÉTICOS de teste.
const src = { id: "t", name: "teste", url: "", licenseNote: "" };
const PTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

function rr(driver: string, team: string, position: number | null, outcome: ResultOutcome = "finished", points?: number): RaceResultRow {
  return {
    position,
    positionText: position ? String(position) : "R",
    number: null,
    driver: { id: driver, code: null, number: null, givenName: driver.toUpperCase(), familyName: driver, nationality: "Brazilian" },
    constructor: { id: team, name: team.toUpperCase(), nationality: "" },
    grid: 1,
    pitLaneStart: false,
    laps: null,
    status: "",
    outcome,
    time: null,
    points: points ?? (position ? (PTS[position - 1] ?? 0) : 0),
    fastestLapRank: null,
  };
}
const race = (round: number, rows: RaceResultRow[], kind: "race" | "sprint" = "race"): SessionResult<RaceResultRow> => ({
  season: 2030, round, raceName: `Test ${round} Grand Prix`, kind, rows, source: src, fetchedAt: "",
});
const ev = (round: number, sprint = false): RaceEvent => ({
  season: 2030, round, name: `Test ${round} Grand Prix`, circuitId: `c${round}`, circuitName: "C", locality: `Cidade${round}`, country: "X",
  countryPt: "X", flag: "🏁", timeZone: null, format: sprint ? "sprint" : "standard",
  sessions: [{ type: "race", startsAt: null, date: `2030-0${round}-01` }], status: "upcoming", referenceUrl: null,
});
const rem = (n: number, sprintAt: number[] = []): RemainingEvent[] =>
  Array.from({ length: n }, (_, i) => ({ round: 19 + i, name: `GP ${19 + i}`, flag: "", date: "", sprint: sprintAt.includes(i) }));

describe("tabela etapa por etapa", () => {
  const data: SeasonData = {
    races: [race(1, [rr("a", "red", 1), rr("b", "red", 2), rr("c", "blue", null, "retired")]), race(2, [rr("c", "blue", 1), rr("a", "red", 3), rr("b", "red", 2)])],
    sprints: [race(2, [rr("b", "red", 1, "finished", 8), rr("a", "red", 2, "finished", 7)], "sprint")],
    qualis: [],
  };
  const grid = buildSeasonGrid({ data, kind: "driver", events: [ev(1), ev(2, true), ev(3)], labels: new Map() });

  it("uma coluna por etapa do calendário, incluindo as futuras", () => {
    expect(grid.columns.map((c) => [c.round, c.sprint, c.done])).toEqual([[1, false, true], [2, true, true], [3, false, false]]);
  });

  it("célula soma corrida + sprint e mostra a faixa de resultado", () => {
    const b = grid.rows.find((r) => r.id === "b")!;
    expect(b.cells[1]).toMatchObject({ points: 26, racePos: 2, sprintPos: 1, tier: "p2" });
    const c = grid.rows.find((r) => r.id === "c")!;
    expect(c.cells[0]).toMatchObject({ points: 0, racePos: null, tier: "dnf" });
    expect(c.cells[1]).toMatchObject({ tier: "win" });
    expect(grid.rows[0]!.cells[2]).toBeNull(); // etapa futura
  });

  it("ordem, distância para o líder e variação de posição", () => {
    // a: 25+15+7=47 · b: 18+18+8=44 · c: 25
    expect(grid.rows.map((r) => [r.id, r.points, r.gapToLeader])).toEqual([["a", 47, 0], ["b", 44, 3], ["c", 25, 22]]);
    expect(grid.rows.find((r) => r.id === "c")!.delta).toBe(0);
  });

  it("equipes: soma dos carros, melhor posição e pilotos no subtítulo", () => {
    const teams = buildSeasonGrid({ data, kind: "team", events: [ev(1), ev(2, true)], labels: new Map() });
    const red = teams.rows.find((r) => r.id === "red")!;
    expect(red.cells[0]).toMatchObject({ points: 43, racePos: 1, tier: "win" });
    expect(red.subtitle).toBe("a, b");
  });

  it("classificação oficial prevalece sobre a soma (punições posteriores)", () => {
    const g = buildSeasonGrid({ data, kind: "driver", events: [], labels: new Map(), official: new Map([["b", { position: 1, points: 50 }], ["a", { position: 2, points: 47 }]]) });
    expect(g.rows[0]!.id).toBe("b");
  });
});

describe("matemática do título", () => {
  const sys = pointsSystem(2026);
  // Cenário real de out/2026 (após o GP dos EUA): 5 corridas restantes, nenhuma sprint.
  const drivers = [
    { id: "ant", name: "Antonelli", points: 365, wins: 9 },
    { id: "rus", name: "Russell", points: 242, wins: 3 },
    { id: "ham", name: "Hamilton", points: 241, wins: 1 },
    { id: "ver", name: "Verstappen", points: 236, wins: 1 },
  ];

  it("quem ainda pode ser campeão e quanto precisa descontar por corrida", () => {
    const t = titleStatus({ kind: "driver", sys, standings: drivers, remaining: rem(5) });
    expect(t.maxInPlay).toBe(125);
    expect(t.contenders.filter((c) => c.alive).map((c) => c.id)).toEqual(["ant", "rus", "ham"]);
    const rus = t.contenders.find((c) => c.id === "rus")!;
    expect(rus.perRace).toBeCloseTo(24.6);
    expect(rus.maxPossible).toBe(367);
  });

  it("condições exatas para fechar na próxima corrida (desempate por vitórias incluído)", () => {
    const t = titleStatus({ kind: "driver", sys, standings: drivers, remaining: rem(5) });
    expect(t.clinch?.isNext).toBe(true);
    expect(t.clinch?.conditions).toEqual([
      "Se chegar em 9º ou melhor.",
      "Ou se chegar em 10º, com Russell em 2º ou pior.",
      "Ou se não pontuar, com Russell em 2º ou pior e Hamilton em 2º ou pior.",
    ]);
    expect(t.clinch?.then).toMatchObject({ leadNeeded: 75 });
  });

  it("equipes: dobradinha e limite de pontos do rival", () => {
    const teams = [
      { id: "mer", name: "Mercedes", points: 607, wins: 12 },
      { id: "fer", name: "Ferrari", points: 474, wins: 2 },
    ];
    const t = titleStatus({ kind: "team", sys, standings: teams, remaining: rem(5) });
    expect(t.maxInPlay).toBe(215);
    expect(t.clinch?.conditions[0]).toBe("Se fizer dobradinha e Ferrari somar no máximo 4 pts.");
  });

  it("título ainda distante: aponta a primeira etapa possível, sem condições", () => {
    const t = titleStatus({ kind: "driver", sys, standings: [{ id: "a", name: "A", points: 100, wins: 3 }, { id: "b", name: "B", points: 90, wins: 3 }], remaining: rem(6) });
    expect(t.clinch?.isNext).toBe(false);
    // 10 + 25·(k+1) > 25·(6−k−1) → k = 2: a 3ª etapa restante.
    expect(t.clinch?.event.round).toBe(21);
    expect(t.clinch?.conditions).toEqual([]);
  });

  it("título decidido: nenhum rival vivo", () => {
    const t = titleStatus({ kind: "driver", sys, standings: [{ id: "a", name: "A", points: 400, wins: 12 }, { id: "b", name: "B", points: 200, wins: 2 }], remaining: rem(2) });
    expect(t.decided).toBe(true);
    expect(t.clinch).toBeNull();
  });

  it("fim de semana com sprint: condições por pontos", () => {
    const t = titleStatus({ kind: "driver", sys, standings: [{ id: "a", name: "A", points: 300, wins: 8 }, { id: "b", name: "B", points: 260, wins: 2 }], remaining: rem(2, [0]) });
    expect(t.clinch?.isNext).toBe(true);
    expect(t.clinch?.conditions[0]).toMatch(/^Se somar \d+ pts ou mais no fim de semana\.$/);
  });

  it("linha do tempo de eliminação", () => {
    const data: SeasonData = {
      races: [race(1, [rr("a", "x", 1), rr("b", "y", 10)]), race(2, [rr("a", "x", 1), rr("b", "y", 10)])],
      sprints: [],
      qualis: [],
    };
    const out = eliminationTimeline({ kind: "driver", sys, data, events: [ev(1), ev(2), ev(3)] });
    // Após a etapa 2: b tem 2, a tem 50; resta 1 corrida (25) → b eliminado.
    expect(out).toEqual([{ id: "b", name: "B b", round: 2, raceName: "GP Test 2" }]);
  });
});

describe("nomes de GP em português", () => {
  it("traduz os conhecidos e não inventa os desconhecidos", () => {
    expect(gpName("United States Grand Prix")).toBe("GP dos Estados Unidos");
    expect(gpName("Mexico City Grand Prix")).toBe("GP da Cidade do México");
    expect(gpName("Atlantis Grand Prix")).toBe("GP Atlantis");
    expect(gpName("Bahrain Grand Prix in Malaysia")).toBe("GP do Bahrein na Malásia");
  });
});

describe("resumo automático da corrida", async () => {
  const { buildRecap, marginText } = await import("@/lib/f1/recap");
  const withTime = (row: RaceResultRow, time: string | null, grid: number) => ({ ...row, time, grid });
  const r1 = race(1, [withTime(rr("b", "y", 1), "1:30:00", 1), withTime(rr("a", "x", 2), "+5.2", 2)]);
  const r2 = race(2, [
    withTime(rr("a", "x", 1), "1:31:00.1", 2),
    withTime(rr("b", "y", 2), "+13.105", 1),
    withTime(rr("c", "z", 3), "+20.0", 9),
    { ...rr("d", "z", null, "retired"), status: "Engine", grid: 4 },
  ]);

  it("vantagem em segundos e nunca para voltas atrás", () => {
    expect(marginText("+13.105")).toBe("13,1 s");
    expect(marginText("+1:02.500")).toBe("62,5 s");
    expect(marginText("+1 Lap")).toBeNull();
  });

  it("manchete, pódio, destaques e campeonato, só com dados oficiais", () => {
    const r = buildRecap({ race: r2, races: [r1, r2], sprints: [] })!;
    // a: 18+25=43 · b: 25+18=43 → empate em pontos; a não "assume" porque a ordenação mantém b.
    expect(r.podium.map((p) => p.pos)).toEqual([1, 2, 3]);
    expect(r.chips).toContain("Vantagem: 13,1 s");
    expect(r.chips).toContain("Escalada: c, 9º → 3º");
    expect(r.chips).toContain("1 abandono");
    expect(r.paragraphs[0]).toBe("A a (X) venceu largando em 2º, 13,1 s à frente de B b. É a 1ª vitória dele na temporada.");
    expect(r.paragraphs.join(" ")).toContain("d (motor)");
    expect(r.paragraphs.some((p) => p.startsWith("🇧🇷"))).toBe(true);
  });

  it("sem vencedor publicado, não inventa resumo", () => {
    expect(buildRecap({ race: race(3, [rr("a", "x", null, "retired")]), races: [], sprints: [] })).toBeNull();
  });
});

describe("histórico e recordes", async () => {
  const { combineHistory, ranking, recordChases, onThisDay } = await import("@/lib/f1/history");
  const drv = (id: string, wins: number, extra: Partial<Record<string, number>> = {}) => ({
    id, name: id.toUpperCase(), nationality: "British", starts: 100, wins, podiums: wins, poles: 0, fastestLaps: 0, titles: 0, points: 0,
    firstSeason: 2000, lastSeason: 2025, seasons: {}, ...extra,
  });
  const h = {
    generatedAt: "", firstSeason: 1950, lastSeason: 2025, notes: { poles: "", fastestLaps: "" },
    seasons: [{ season: 2024, races: 2, champion: { id: "a", name: "A", team: "T", points: 1, wins: 1 }, runnerUp: null, teamChampion: null }],
    races: [
      { season: 2024, round: 2, name: "British Grand Prix", date: "2024-10-29", circuit: "", country: "", winner: { id: "a", name: "A", team: "T" }, pole: null },
      { season: 2010, round: 1, name: "Bahrain Grand Prix", date: "2010-10-29", circuit: "", country: "", winner: null, pole: null },
      { season: 2011, round: 1, name: "X Grand Prix", date: "2011-03-01", circuit: "", country: "", winner: null, pole: null },
    ],
    drivers: [drv("a", 105), drv("b", 91), drv("c", 89), drv("d", 25), drv("e", 25), drv("f", 25)],
    teams: [],
  };

  it("ranking com empates: mesma posição e resumo dos que não couberam", () => {
    const r = ranking(h.drivers, (x) => x.wins, new Set(["c"]), 4);
    expect(r.rows.map((x) => [x.rank, x.id])).toEqual([[1, "a"], [2, "b"], [3, "c"], [4, "d"]]);
    expect(r.rows[2]!.active).toBe(true);
    expect(r.moreTied).toEqual({ count: 2, value: 25, names: ["E", "F"] });
  });

  it("recorde em jogo: piloto em atividade perto de passar quem está acima", () => {
    const chases = recordChases(h.drivers, new Set(["c"]));
    expect(chases.find((c) => c.metric === "Vitórias")).toMatchObject({ chaser: "C", need: 3, target: "B", targetValue: 91 });
  });

  it("temporada em andamento soma vitórias e largadas, mas não títulos", () => {
    const live = { season: 2026, races: [race(1, [rr("c", "t", 1), rr("novato", "t", 2)])], qualis: [] };
    const c = combineHistory(h, live);
    expect(c.drivers.find((x) => x.id === "c")).toMatchObject({ wins: 90, starts: 101, titles: 0 });
    expect(c.drivers.find((x) => x.id === "novato")).toMatchObject({ starts: 1, podiums: 1 });
    expect(c.activeDrivers.has("c")).toBe(true);
    expect(h.drivers.find((x) => x.id === "c")!.wins).toBe(89); // original intacto
  });

  it("neste dia: mesmo dia e mês, do mais recente ao mais antigo", () => {
    const out = onThisDay(h, new Date("2026-10-29T15:00:00Z"));
    expect(out.map((x) => [x.race.season, x.years])).toEqual([[2024, 2], [2010, 16]]);
    expect(out[0]!.label).toBe("A venceu o GP da Grã-Bretanha (T) — última etapa do ano, com A campeão.");
    expect(out[1]!.label).toBe("GP do Bahrein.");
  });
});

describe("calendário .ics", async () => {
  const { buildIcs, icsEscape } = await import("@/lib/f1/ics");
  it("escapa texto e gera um evento por sessão com horário", () => {
    expect(icsEscape(String.raw`a,b;c\d` + "\ne")).toBe(String.raw`a\,b\;c\\d\ne`);
    const e = { ...ev(3), sessions: [{ type: "race" as const, startsAt: "2030-03-01T14:00:00Z", date: "2030-03-01" }, { type: "fp1" as const, startsAt: null, date: "2030-02-27" }] };
    const ics = buildIcs([e], { siteUrl: "https://x.test", now: new Date("2030-01-01T00:00:00Z") });
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain("DTSTART:20300301T140000Z");
    expect(ics).toContain("DTEND:20300301T160000Z");
    expect(ics).toContain("UID:2030-3-race@apexgrid");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});

describe("classificação de construtores atrasada na fonte", async () => {
  const { freshConstructorStandings } = await import("@/lib/f1/compare");
  const data: SeasonData = {
    races: [race(1, [rr("a", "red", 1), rr("b", "blue", 2)]), race(2, [rr("b", "blue", 1), rr("c", "blue", 2), rr("a", "red", 3)])],
    sprints: [],
    qualis: [],
  };
  const stale = { season: 2030, round: 1, rows: [{ position: 1, positionText: "1", points: 25, wins: 1, constructor: { id: "red", name: "RED", nationality: "" } }] };

  it("recalcula pelos resultados quando a fonte está uma etapa atrás", () => {
    const fresh = freshConstructorStandings(stale, data);
    expect(fresh.round).toBe(2);
    expect(fresh.rows.map((r) => [r.constructor.id, r.points, r.wins, r.position])).toEqual([["blue", 61, 1, 1], ["red", 40, 1, 2]]);
  });

  it("classificação em dia prevalece (punições aplicadas pela FIA)", () => {
    const current = { ...stale, round: 2 };
    expect(freshConstructorStandings(current, data)).toBe(current);
  });
});

describe("correções da revisão", async () => {
  const { freshConstructorStandings, freshDriverStandings } = await import("@/lib/f1/compare");
  const { fold } = await import("@/lib/f1/ics");
  const data: SeasonData = { races: [race(1, [rr("a", "red", 1)]), race(2, [rr("b", "blue", 1), rr("a", "red", 2)])], sprints: [], qualis: [] };

  it("não inventa classificação de construtores (temporada sem tabela ou antes de 2010)", () => {
    const empty = { season: 2030, round: 0, rows: [] };
    expect(freshConstructorStandings(empty, data)).toBe(empty);
    const old = { season: 1975, round: 1, rows: [{ position: 1, positionText: "1", points: 9, wins: 1, constructor: { id: "red", name: "RED", nationality: "" } }] };
    expect(freshConstructorStandings(old, data)).toBe(old);
  });

  it("classificação de pilotos atrasada também é recalculada pelos resultados", () => {
    const stale = { season: 2030, round: 1, rows: [{ position: 1, positionText: "1", points: 25, wins: 1, driver: rr("a", "red", 1).driver, constructors: [] }] };
    const fresh = freshDriverStandings(stale, data);
    expect(fresh.round).toBe(2);
    expect(fresh.rows.map((r) => [r.driver.id, r.points, r.wins])).toEqual([["a", 43, 1], ["b", 25, 1]]);
  });

  it("calendário: dobra por octetos UTF-8 e nunca parte um emoji", () => {
    const line = `SUMMARY:${"🇧🇷 Classificação Sprint · Grande Prêmio de São Paulo ".repeat(3)}`;
    const parts = fold(line).split("\r\n");
    for (const p of parts) expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75);
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join("")).toBe(line);
    expect(fold(line)).not.toContain("\uFFFD");
  });
});
