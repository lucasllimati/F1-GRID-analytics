import { z } from "zod";
import { circuitMeta } from "../circuits";
import { deriveEventStatus, sortSessions } from "../schedule";
import type {
  ConstructorRef,
  ConstructorStanding,
  DataSourceInfo,
  DriverRef,
  DriverStanding,
  F1DataProvider,
  QualifyingRow,
  RaceEvent,
  RaceResultRow,
  ResultOutcome,
  Session,
  SessionResult,
  SessionType,
  Standings,
} from "../types";

// Adaptador para a API Jolpica-F1 (sucessora comunitária da Ergast).
// Licença dos dados e limites estão documentados em docs/DATA_SOURCES.md.
// Limite público: ~4 req/s e ~500 req/h — por isso todo acesso passa pelo cache do Next.

const BASE = "https://api.jolpi.ca/ergast/f1";

export const JOLPICA_INFO: DataSourceInfo = {
  id: "jolpica",
  name: "Jolpica-F1 API (sucessora da Ergast)",
  url: "https://github.com/jolpica/jolpica-f1",
  licenseNote:
    "Dados comunitários abertos. Uso comercial e redistribuição devem ser revalidados com os mantenedores antes do lançamento.",
};

// ── Esquemas mínimos da resposta (validação de entrada) ─────────────

const zDriver = z.object({
  driverId: z.string(),
  permanentNumber: z.string().optional(),
  code: z.string().optional(),
  givenName: z.string(),
  familyName: z.string(),
  nationality: z.string().default(""),
});
const zConstructor = z.object({ constructorId: z.string(), name: z.string(), nationality: z.string().default("") });
const zDateTime = z.object({ date: z.string(), time: z.string().optional() });
const zRace = z.object({
  season: z.string(),
  round: z.string(),
  url: z.string().optional(),
  raceName: z.string(),
  Circuit: z.object({
    circuitId: z.string(),
    circuitName: z.string(),
    Location: z.object({ locality: z.string(), country: z.string() }),
  }),
  date: z.string(),
  time: z.string().optional(),
  FirstPractice: zDateTime.optional(),
  SecondPractice: zDateTime.optional(),
  ThirdPractice: zDateTime.optional(),
  Qualifying: zDateTime.optional(),
  Sprint: zDateTime.optional(),
  SprintQualifying: zDateTime.optional(),
  SprintShootout: zDateTime.optional(),
});
const zResult = z.object({
  number: z.string().optional(),
  position: z.string().optional(),
  positionText: z.string(),
  points: z.string(),
  Driver: zDriver,
  Constructor: zConstructor,
  grid: z.string().optional(),
  laps: z.string().optional(),
  status: z.string().default(""),
  Time: z.object({ time: z.string() }).optional(),
  FastestLap: z.object({ rank: z.string().optional() }).optional(),
});
const zQuali = z.object({
  number: z.string().optional(),
  position: z.string().optional(),
  Driver: zDriver,
  Constructor: zConstructor,
  Q1: z.string().optional(),
  Q2: z.string().optional(),
  Q3: z.string().optional(),
});

type FetchOpts = { revalidate: number };

async function getJson(path: string, opts: FetchOpts): Promise<unknown> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "ApexGrid/0.1 (+https://github.com/)" },
    next: { revalidate: opts.revalidate },
    signal: AbortSignal.timeout(15_000),
  } as RequestInit);
  if (!res.ok) throw new Error(`Jolpica ${res.status} em ${path}`);
  return res.json();
}

function mrData(json: unknown): Record<string, unknown> {
  const parsed = z.object({ MRData: z.record(z.string(), z.unknown()) }).parse(json);
  return parsed.MRData;
}

function toInt(v: string | undefined): number | null {
  if (v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function driverRef(d: z.infer<typeof zDriver>): DriverRef {
  return {
    id: d.driverId,
    code: d.code ?? null,
    number: d.permanentNumber ?? null,
    givenName: d.givenName,
    familyName: d.familyName,
    nationality: d.nationality,
  };
}

function constructorRef(c: z.infer<typeof zConstructor>): ConstructorRef {
  return { id: c.constructorId, name: c.name, nationality: c.nationality };
}

function session(type: SessionType, dt: { date: string; time?: string } | undefined): Session | null {
  if (!dt) return null;
  // A Jolpica publica horários em UTC com sufixo "Z". Sem horário → não inventamos.
  const startsAt = dt.time && /Z$/.test(dt.time) ? new Date(`${dt.date}T${dt.time}`).toISOString() : null;
  return { type, date: dt.date, startsAt };
}

export function mapRace(raw: z.infer<typeof zRace>, raceResultPublished: boolean, now: Date): RaceEvent {
  const meta = circuitMeta(raw.Circuit.circuitId);
  const sessions = sortSessions(
    [
      session("fp1", raw.FirstPractice),
      session("fp2", raw.SecondPractice),
      session("fp3", raw.ThirdPractice),
      session("sprint_qualifying", raw.SprintQualifying ?? raw.SprintShootout),
      session("sprint", raw.Sprint),
      session("qualifying", raw.Qualifying),
      session("race", { date: raw.date, time: raw.time }),
    ].filter((s): s is Session => s !== null),
  );
  return {
    season: Number(raw.season),
    round: Number(raw.round),
    name: raw.raceName,
    circuitId: raw.Circuit.circuitId,
    circuitName: raw.Circuit.circuitName,
    locality: raw.Circuit.Location.locality,
    country: raw.Circuit.Location.country,
    countryPt: meta?.countryPt ?? raw.Circuit.Location.country,
    flag: meta?.flag ?? "🏁",
    timeZone: meta?.timeZone ?? null,
    format: raw.Sprint ? "sprint" : "standard",
    sessions,
    status: deriveEventStatus(sessions, raceResultPublished, now),
    referenceUrl: raw.url ?? null,
  };
}

/** Converte o status textual da fonte em um desfecho tipado, sem inventar posição. */
export function mapOutcome(positionText: string, status: string): ResultOutcome {
  const s = status.toLowerCase();
  if (s.includes("did not start")) return "did_not_start";
  if (s.includes("did not qualify") || s.includes("did not prequalify")) return "did_not_qualify";
  switch (positionText) {
    case "R":
      return "retired";
    case "D":
      return "disqualified";
    case "E":
      return "excluded";
    case "W":
      return "withdrawn";
    case "F":
      return "did_not_qualify";
    case "N":
      return "not_classified";
  }
  if (s === "finished") return "finished";
  if (/^\+\d+ laps?$/.test(s) || s === "lapped") return "lapped";
  if (s.includes("disqualified")) return "disqualified";
  // Classificado (completou ≥90%) mas abandonou.
  return "retired";
}

function mapResultRow(r: z.infer<typeof zResult>): RaceResultRow {
  const outcome = mapOutcome(r.positionText, r.status);
  const numericPos = /^\d+$/.test(r.positionText) ? Number(r.positionText) : null;
  const grid = toInt(r.grid);
  return {
    position: numericPos,
    positionText: r.positionText,
    number: r.number ?? null,
    driver: driverRef(r.Driver),
    constructor: constructorRef(r.Constructor),
    grid: grid && grid > 0 ? grid : null,
    pitLaneStart: grid === 0 && outcome !== "did_not_start",
    laps: toInt(r.laps),
    status: r.status,
    outcome,
    time: r.Time?.time ?? null,
    points: Number(r.points) || 0,
    fastestLapRank: toInt(r.FastestLap?.rank),
  };
}

function seasonPath(season: number | "current") {
  return season === "current" ? "current" : String(season);
}

export class JolpicaProvider implements F1DataProvider {
  info = JOLPICA_INFO;
  constructor(private readonly now: () => Date = () => new Date()) {}

  async lastResultRound(season: number | "current"): Promise<{ season: number; round: number } | null> {
    const data = mrData(await getJson(`/${seasonPath(season)}/last/results.json?limit=1`, { revalidate: 600 }));
    const table = z.object({ season: z.string().optional(), round: z.string().optional(), Races: z.array(z.unknown()) }).parse(data.RaceTable);
    if (table.Races.length === 0 || !table.round) return null;
    return { season: Number(table.season), round: Number(table.round) };
  }

  async getSchedule(season: number | "current"): Promise<RaceEvent[]> {
    const [schedJson, last] = await Promise.all([
      getJson(`/${seasonPath(season)}.json?limit=100`, { revalidate: 3600 }),
      this.lastResultRound(season).catch(() => null),
    ]);
    const races = z.array(zRace).parse(z.object({ Races: z.array(z.unknown()) }).parse(mrData(schedJson).RaceTable).Races);
    const now = this.now();
    return races.map((r) => mapRace(r, last !== null && Number(r.round) <= last.round, now));
  }

  async getDriverStandings(season: number | "current", round?: number): Promise<Standings<DriverStanding>> {
    const path = round ? `/${seasonPath(season)}/${round}/driverstandings.json` : `/${seasonPath(season)}/driverstandings.json`;
    const table = z
      .object({
        season: z.string(),
        StandingsLists: z.array(
          z.object({
            round: z.string(),
            DriverStandings: z.array(
              z.object({
                position: z.string().optional(),
                positionText: z.string(),
                points: z.string(),
                wins: z.string(),
                Driver: zDriver,
                Constructors: z.array(zConstructor),
              }),
            ),
          }),
        ),
      })
      .parse(mrData(await getJson(`${path}?limit=100`, { revalidate: 900 })).StandingsTable);
    const list = table.StandingsLists[0];
    return {
      season: Number(table.season),
      round: list ? Number(list.round) : 0,
      rows: (list?.DriverStandings ?? []).map((d) => ({
        position: toInt(d.position),
        positionText: d.positionText,
        points: Number(d.points),
        wins: Number(d.wins),
        driver: driverRef(d.Driver),
        constructors: d.Constructors.map(constructorRef),
      })),
    };
  }

  async getConstructorStandings(season: number | "current", round?: number): Promise<Standings<ConstructorStanding>> {
    const path = round
      ? `/${seasonPath(season)}/${round}/constructorstandings.json`
      : `/${seasonPath(season)}/constructorstandings.json`;
    const table = z
      .object({
        season: z.string(),
        StandingsLists: z.array(
          z.object({
            round: z.string(),
            ConstructorStandings: z.array(
              z.object({
                position: z.string().optional(),
                positionText: z.string(),
                points: z.string(),
                wins: z.string(),
                Constructor: zConstructor,
              }),
            ),
          }),
        ),
      })
      .parse(mrData(await getJson(`${path}?limit=100`, { revalidate: 900 })).StandingsTable);
    const list = table.StandingsLists[0];
    return {
      season: Number(table.season),
      round: list ? Number(list.round) : 0,
      rows: (list?.ConstructorStandings ?? []).map((c) => ({
        position: toInt(c.position),
        positionText: c.positionText,
        points: Number(c.points),
        wins: Number(c.wins),
        constructor: constructorRef(c.Constructor),
      })),
    };
  }

  private async resultsPage(path: string, key: "Results" | "SprintResults", revalidate: number) {
    const data = mrData(await getJson(path, { revalidate }));
    const total = Number(data.total ?? 0);
    const races = z
      .array(
        z.object({
          season: z.string(),
          round: z.string(),
          raceName: z.string(),
          Results: z.array(zResult).optional(),
          SprintResults: z.array(zResult).optional(),
        }),
      )
      .parse(z.object({ Races: z.array(z.unknown()) }).parse(data.RaceTable).Races);
    return { total, races: races.map((r) => ({ ...r, rows: r[key] ?? [] })) };
  }

  private async session(
    season: number,
    round: number,
    kind: "race" | "sprint",
  ): Promise<SessionResult<RaceResultRow> | null> {
    const endpoint = kind === "race" ? "results" : "sprint";
    const key = kind === "race" ? "Results" : "SprintResults";
    const { races } = await this.resultsPage(`/${season}/${round}/${endpoint}.json?limit=100`, key, 600);
    const race = races[0];
    if (!race || race.rows.length === 0) return null;
    return {
      season,
      round,
      raceName: race.raceName,
      kind,
      rows: race.rows.map(mapResultRow),
      source: this.info,
      fetchedAt: new Date().toISOString(),
    };
  }

  getRaceResult(season: number, round: number) {
    return this.session(season, round, "race");
  }

  getSprintResult(season: number, round: number) {
    return this.session(season, round, "sprint");
  }

  async getQualifying(season: number, round: number): Promise<SessionResult<QualifyingRow> | null> {
    const data = mrData(await getJson(`/${season}/${round}/qualifying.json?limit=100`, { revalidate: 600 }));
    const races = z
      .array(z.object({ raceName: z.string(), QualifyingResults: z.array(zQuali).optional() }))
      .parse(z.object({ Races: z.array(z.unknown()) }).parse(data.RaceTable).Races);
    const race = races[0];
    if (!race?.QualifyingResults?.length) return null;
    return {
      season,
      round,
      raceName: race.raceName,
      kind: "qualifying",
      rows: race.QualifyingResults.map((q) => ({
        position: toInt(q.position),
        number: q.number ?? null,
        driver: driverRef(q.Driver),
        constructor: constructorRef(q.Constructor),
        q1: q.Q1 || null,
        q2: q.Q2 || null,
        q3: q.Q3 || null,
      })),
      source: this.info,
      fetchedAt: new Date().toISOString(),
    };
  }

  async getSeasonResults(season: number, kind: "race" | "sprint"): Promise<SessionResult<RaceResultRow>[]> {
    const endpoint = kind === "race" ? "results" : "sprint";
    const key = kind === "race" ? "Results" : "SprintResults";
    const byRound = new Map<number, SessionResult<RaceResultRow>>();
    const pageSize = 100;
    let offset = 0;
    // Paginação: a API limita 100 linhas por página e pode dividir uma corrida entre páginas.
    for (let guard = 0; guard < 20; guard++) {
      const { total, races } = await this.resultsPage(
        `/${season}/${endpoint}.json?limit=${pageSize}&offset=${offset}`,
        key,
        1800,
      );
      for (const r of races) {
        const round = Number(r.round);
        const existing = byRound.get(round);
        const rows = r.rows.map(mapResultRow);
        if (existing) existing.rows.push(...rows);
        else
          byRound.set(round, {
            season,
            round,
            raceName: r.raceName,
            kind,
            rows,
            source: this.info,
            fetchedAt: new Date().toISOString(),
          });
      }
      offset += pageSize;
      if (offset >= total) break;
    }
    return [...byRound.values()].sort((a, b) => a.round - b.round);
  }
}
