// Tipos de domínio independentes de fornecedor. Adaptadores de fonte convertem
// para estes tipos; páginas e modelos nunca dependem do formato bruto da API.

export type SessionType = "fp1" | "fp2" | "fp3" | "sprint_qualifying" | "sprint" | "qualifying" | "race";

export const SESSION_LABEL: Record<SessionType, string> = {
  fp1: "Treino livre 1",
  fp2: "Treino livre 2",
  fp3: "Treino livre 3",
  sprint_qualifying: "Classificação Sprint",
  sprint: "Corrida Sprint",
  qualifying: "Classificação",
  race: "Corrida",
};

export const SESSION_SHORT: Record<SessionType, string> = {
  fp1: "TL1",
  fp2: "TL2",
  fp3: "TL3",
  sprint_qualifying: "Q Sprint",
  sprint: "Sprint",
  qualifying: "Classif.",
  race: "Corrida",
};

export type Session = {
  type: SessionType;
  /** Instante de início em UTC (ISO 8601). null quando a fonte só publicou a data. */
  startsAt: string | null;
  /** Data (YYYY-MM-DD) conforme a fonte; sempre presente. */
  date: string;
};

/**
 * Estado do evento. Não existe "live": não temos uma fonte confiável de estado ao vivo,
 * e o prompt de produto proíbe deduzir "ao vivo" a partir do horário previsto.
 */
export type EventStatus =
  | "upcoming" // nenhuma sessão começou (pelo horário oficial)
  | "weekend_underway" // a primeira sessão já passou do horário previsto; corrida ainda não
  | "awaiting_results" // horário da corrida já passou, resultado ainda não publicado pela fonte
  | "completed"; // resultado da corrida publicado pela fonte

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  upcoming: "Próximo",
  weekend_underway: "Fim de semana em andamento",
  awaiting_results: "Aguardando resultado oficial",
  completed: "Concluído",
};

export type RaceEvent = {
  season: number;
  round: number;
  name: string;
  circuitId: string;
  circuitName: string;
  locality: string;
  country: string;
  countryPt: string;
  flag: string;
  /** Fuso IANA do circuito; null se desconhecido (nunca inventamos). */
  timeZone: string | null;
  format: "standard" | "sprint";
  sessions: Session[];
  status: EventStatus;
  referenceUrl: string | null;
};

export type DriverRef = {
  id: string;
  code: string | null;
  number: string | null;
  givenName: string;
  familyName: string;
  nationality: string;
};

export type ConstructorRef = { id: string; name: string; nationality: string };

export type DriverStanding = {
  position: number | null;
  positionText: string;
  points: number;
  wins: number;
  driver: DriverRef;
  constructors: ConstructorRef[];
};

export type ConstructorStanding = {
  position: number | null;
  positionText: string;
  points: number;
  wins: number;
  constructor: ConstructorRef;
};

export type Standings<T> = { season: number; round: number; rows: T[] };

/**
 * Situação do piloto no resultado. Estados especiais NUNCA são convertidos
 * em tempos ou posições fictícias.
 */
export type ResultOutcome =
  | "finished"
  | "lapped"
  | "retired"
  | "disqualified"
  | "excluded"
  | "withdrawn"
  | "not_classified"
  | "did_not_start"
  | "did_not_qualify";

export const OUTCOME_LABEL: Record<ResultOutcome, string> = {
  finished: "Completou",
  lapped: "Volta(s) atrás",
  retired: "Abandono",
  disqualified: "Desclassificado",
  excluded: "Excluído",
  withdrawn: "Retirado",
  not_classified: "Não classificado",
  did_not_start: "Não largou",
  did_not_qualify: "Não se classificou",
};

export type RaceResultRow = {
  position: number | null; // posição classificada; null quando não classificado
  positionText: string;
  number: string | null;
  driver: DriverRef;
  constructor: ConstructorRef;
  grid: number | null; // 0 na fonte = largou do pit lane → null + flag
  pitLaneStart: boolean;
  laps: number | null;
  status: string; // texto bruto da fonte
  outcome: ResultOutcome;
  time: string | null;
  points: number;
  fastestLapRank: number | null;
};

export type QualifyingRow = {
  position: number | null;
  number: string | null;
  driver: DriverRef;
  constructor: ConstructorRef;
  q1: string | null;
  q2: string | null;
  q3: string | null;
};

export type SessionResult<T> = {
  season: number;
  round: number;
  raceName: string;
  kind: "race" | "sprint" | "qualifying";
  rows: T[];
  source: DataSourceInfo;
  fetchedAt: string;
};

export type DataSourceInfo = {
  id: string;
  name: string;
  url: string;
  licenseNote: string;
};

/** Contrato padronizado de provedores de dados esportivos. */
export interface F1DataProvider {
  info: DataSourceInfo;
  getSchedule(season: number | "current"): Promise<RaceEvent[]>;
  getDriverStandings(season: number | "current", round?: number): Promise<Standings<DriverStanding>>;
  getConstructorStandings(season: number | "current", round?: number): Promise<Standings<ConstructorStanding>>;
  getRaceResult(season: number, round: number): Promise<SessionResult<RaceResultRow> | null>;
  getSprintResult(season: number, round: number): Promise<SessionResult<RaceResultRow> | null>;
  getQualifying(season: number, round: number): Promise<SessionResult<QualifyingRow> | null>;
  /** Todos os resultados de corrida (ou sprint) de uma temporada. */
  getSeasonResults(season: number, kind: "race" | "sprint"): Promise<SessionResult<RaceResultRow>[]>;
}
