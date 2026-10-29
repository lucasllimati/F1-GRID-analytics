import { gpName } from "./gp-names";
import { driverName } from "./names";
import { OUTCOME_LABEL, type QualifyingRow, type RaceResultRow, type ResultOutcome, type SessionResult } from "./types";

// Resumo automático de uma corrida, montado SÓ com os resultados oficiais (corrida,
// classificação e pontos). Não descreve o que não está nos dados — sem "safety car",
// estratégia ou ultrapassagens, que exigiriam fontes que não temos.

/** Motivo de abandono como a fonte publica ("Engine") → português. Genérico ("Retired") não é mostrado. */
const STATUS_PT: Record<string, string> = {
  Accident: "acidente",
  Collision: "colisão",
  "Collision damage": "danos de colisão",
  Engine: "motor",
  "Power Unit": "unidade de potência",
  Gearbox: "câmbio",
  Transmission: "transmissão",
  Hydraulics: "hidráulica",
  Brakes: "freios",
  Suspension: "suspensão",
  Electrical: "parte elétrica",
  Electronics: "eletrônica",
  Overheating: "superaquecimento",
  "Water pressure": "pressão da água",
  "Oil leak": "vazamento de óleo",
  "Fuel pressure": "pressão de combustível",
  Puncture: "furo de pneu",
  Wheel: "roda",
  Spun: "rodada",
  "Spun off": "rodada",
  Damage: "danos",
  Power: "perda de potência",
  Disqualified: "desclassificado",
  "Did not start": "não largou",
  Withdrew: "retirado",
};

function reason(r: RaceResultRow): string | null {
  if (r.outcome !== "retired") return OUTCOME_LABEL[r.outcome].toLowerCase();
  if (!r.status || /^retired$/i.test(r.status)) return null;
  return STATUS_PT[r.status] ?? null;
}

export type RecapPodium = { pos: number; name: string; team: string; teamId: string; nationality: string; points: number };
export type Recap = {
  round: number;
  raceName: string;
  headline: string;
  podium: RecapPodium[];
  chips: string[];
  paragraphs: string[];
};

const FINISHED: ResultOutcome[] = ["finished", "lapped"];
const ord = (n: number) => `${n}º`;
const ordF = (n: number) => `${n}ª`;

/** "+13.105" → "13,1 s"; "+1 Lap" e afins não viram vantagem em segundos. */
export function marginText(p2Time: string | null): string | null {
  const m = /^\+(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(p2Time?.trim() ?? "");
  if (!m) return null;
  const secs = Number(m[1] ?? 0) * 60 + Number(m[2]);
  return `${secs.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} s`;
}

type Standing = { id: string; name: string; points: number };

function standingsAfter(races: SessionResult<RaceResultRow>[], sprints: SessionResult<RaceResultRow>[], round: number): Standing[] {
  const pts = new Map<string, Standing>();
  for (const s of [...races, ...sprints]) {
    if (s.round > round) continue;
    for (const r of s.rows) {
      const cur = pts.get(r.driver.id) ?? { id: r.driver.id, name: driverName(r.driver), points: 0 };
      cur.points += r.points;
      pts.set(r.driver.id, cur);
    }
  }
  return [...pts.values()].sort((a, b) => b.points - a.points);
}

export function buildRecap(opts: {
  race: SessionResult<RaceResultRow>;
  races: SessionResult<RaceResultRow>[];
  sprints: SessionResult<RaceResultRow>[];
  quali?: SessionResult<QualifyingRow> | null;
}): Recap | null {
  const { race, races, sprints, quali } = opts;
  const rows = [...race.rows].sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  const winner = rows.find((r) => r.position === 1);
  if (!winner) return null;
  const gp = gpName(race.raceName);
  const p2 = rows.find((r) => r.position === 2);
  const last = (r: RaceResultRow) => r.driver.familyName;

  const before = standingsAfter(races, sprints, race.round - 1);
  const after = standingsAfter(races, sprints, race.round);
  const leaderBefore = before[0];
  const leaderAfter = after[0]!;
  const lead = leaderAfter.points - (after[1]?.points ?? 0);
  const leadBefore = leaderBefore ? leaderBefore.points - (before[1]?.points ?? 0) : 0;
  const seasonWins = races.filter((r) => r.round <= race.round && r.rows.some((x) => x.position === 1 && x.driver.id === winner.driver.id)).length;

  let headline = `${last(winner)} vence o ${gp}`;
  if (leaderAfter.id === winner.driver.id && leaderBefore && leaderBefore.id !== winner.driver.id) headline += " e assume a liderança";
  else if (leaderAfter.id === winner.driver.id && leaderBefore?.id === winner.driver.id && lead > leadBefore) headline += " e amplia a liderança";
  else if (seasonWins === 1 && race.round > 1) headline += " e conquista a primeira vitória no ano";

  const podium: RecapPodium[] = rows
    .filter((r) => r.position !== null && r.position <= 3)
    .map((r) => ({ pos: r.position!, name: driverName(r.driver), team: r.constructor.name, teamId: r.constructor.id, nationality: r.driver.nationality, points: r.points }));

  const chips: string[] = [];
  const paragraphs: string[] = [];
  const margin = marginText(p2?.time ?? null);
  if (margin) chips.push(`Vantagem: ${margin}`);

  // Largada do vencedor e pole.
  const pole = quali?.rows.find((q) => q.position === 1);
  const winnerGrid = winner.grid;
  let first = `${driverName(winner.driver)} (${winner.constructor.name}) venceu`;
  if (winnerGrid === 1) first += " largando da pole";
  else if (winnerGrid) first += ` largando em ${ord(winnerGrid)}`;
  else if (winner.pitLaneStart) first += " largando do pit lane";
  first += margin && p2 ? `, ${margin} à frente de ${driverName(p2.driver)}.` : p2 ? `, com ${driverName(p2.driver)} em 2º.` : ".";
  first += ` É a ${ordF(seasonWins)} vitória dele na temporada.`;
  paragraphs.push(first);
  if (pole && pole.driver.id !== winner.driver.id) chips.push(`Pole: ${pole.driver.familyName}`);

  // Maior recuperação (só quem terminou classificado e largou do grid).
  const climbs = rows
    .filter((r) => FINISHED.includes(r.outcome) && r.position !== null && r.grid !== null)
    .map((r) => ({ r, gain: r.grid! - r.position! }))
    .sort((a, b) => b.gain - a.gain);
  const top = climbs[0];
  if (top && top.gain >= 3) {
    chips.push(`Escalada: ${last(top.r)}, ${ord(top.r.grid!)} → ${ord(top.r.position!)}`);
    paragraphs.push(`A maior recuperação foi de ${driverName(top.r.driver)}: largou em ${ord(top.r.grid!)} e terminou em ${ord(top.r.position!)}.`);
  }

  const dnfs = rows.filter((r) => !FINISHED.includes(r.outcome) && r.outcome !== "did_not_qualify");
  if (dnfs.length) {
    chips.push(dnfs.length === 1 ? "1 abandono" : `${dnfs.length} abandonos`);
    const list = dnfs.slice(0, 5).map((r) => {
      const why = reason(r);
      return why ? `${last(r)} (${why})` : last(r);
    });
    paragraphs.push(`Não terminaram: ${list.join(", ")}${dnfs.length > 5 ? ` e mais ${dnfs.length - 5}` : ""}.`);
  }
  const fl = rows.find((r) => r.fastestLapRank === 1);
  if (fl) chips.push(`Volta mais rápida: ${last(fl)}`);

  const brazilians = rows.filter((r) => r.driver.nationality === "Brazilian");
  for (const b of brazilians) {
    const where = b.position !== null ? `${ord(b.position)}${b.points ? ` (+${b.points} pts)` : ""}` : OUTCOME_LABEL[b.outcome].toLowerCase();
    paragraphs.push(`🇧🇷 ${driverName(b.driver)}: ${where}${b.grid ? `, depois de largar em ${ord(b.grid)}` : ""}.`);
  }

  if (after[1]) {
    chips.push(`Líder: ${leaderAfter.name.split(" ").slice(-1)[0]}, +${lead} pts`);
    paragraphs.push(`No campeonato, ${leaderAfter.name} lidera com ${leaderAfter.points} pts, ${lead} à frente de ${after[1].name}.`);
  }

  return { round: race.round, raceName: gp, headline, podium, chips, paragraphs };
}
