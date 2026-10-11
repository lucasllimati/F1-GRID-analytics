import { analyzeEntity, championshipPositions, seasonRounds, type SeasonData } from "./compare";
import { pointsSystem, racePoints, sprintPoints } from "./points";
import type { ConstructorStanding, DriverStanding, RaceEvent, Standings } from "./types";

// Verificações automáticas de consistência dos dados esportivos.
// Nenhuma verificação "corrige" dados: apenas aponta divergências para revisão humana.

export type Severity = "critical" | "high" | "medium" | "low";
export type DataIssue = { severity: Severity; code: string; message: string; detail?: string };

export type ValidationInput = {
  season: number;
  events: RaceEvent[];
  data: SeasonData;
  driverStandings: Standings<DriverStanding>;
  constructorStandings: Standings<ConstructorStanding>;
};

export function validateSeason(i: ValidationInput): DataIssue[] {
  const issues: DataIssue[] = [];
  const add = (severity: Severity, code: string, message: string, detail?: string) => issues.push({ severity, code, message, detail });

  // ── Calendário ──
  const rounds = i.events.map((e) => e.round);
  const dupRounds = rounds.filter((r, idx) => rounds.indexOf(r) !== idx);
  if (dupRounds.length) add("high", "schedule.duplicate_round", "Etapas duplicadas no calendário", `etapas: ${[...new Set(dupRounds)].join(", ")}`);
  for (const e of i.events) {
    if (!e.sessions.some((s) => s.type === "race")) add("high", "schedule.no_race", `Etapa ${e.round} sem sessão de corrida`, e.name);
    for (const s of e.sessions) {
      if (s.startsAt && Number.isNaN(Date.parse(s.startsAt))) add("high", "schedule.invalid_date", `Data inválida na etapa ${e.round}`, `${s.type}: ${s.startsAt}`);
    }
    if (!e.timeZone) add("low", "schedule.unknown_timezone", `Fuso do circuito desconhecido na etapa ${e.round}`, `${e.circuitId} — adicionar em src/lib/f1/circuits.ts`);
  }

  // ── Resultados ──
  const known = new Set(rounds);
  for (const r of [...i.data.races, ...i.data.sprints, ...i.data.qualis]) {
    if (!known.has(r.round)) add("high", "results.orphan_round", `Resultado da etapa ${r.round} não existe no calendário`, r.raceName);
  }
  let sys: ReturnType<typeof pointsSystem> | null = null;
  try {
    sys = pointsSystem(i.season);
  } catch {
    add("low", "points.unsupported_season", `Regras de pontuação de ${i.season} não modeladas`, "verificação de pontos por posição ignorada");
  }
  for (const [kind, sessions] of [["race", i.data.races], ["sprint", i.data.sprints]] as const) {
    for (const s of sessions) {
      const ids = s.rows.map((r) => r.driver.id);
      const dup = ids.filter((d, idx) => ids.indexOf(d) !== idx);
      if (dup.length) add("high", "results.duplicate_driver", `Piloto repetido no resultado (${kind}, etapa ${s.round})`, dup.join(", "));
      const positions = s.rows.map((r) => r.position).filter((p): p is number => p !== null);
      const dupPos = positions.filter((p, idx) => positions.indexOf(p) !== idx);
      if (dupPos.length) add("high", "results.duplicate_position", `Posição repetida (${kind}, etapa ${s.round})`, dupPos.join(", "));
      if (!sys) continue;
      const off = s.rows
        .map((r) => ({ r, expected: kind === "race" ? racePoints(sys!, r.position, r.fastestLapRank === 1) : sprintPoints(sys!, r.position) }))
        .filter(({ r, expected }) => r.points !== expected);
      if (off.length) {
        // Pode ser legítimo (pontuação reduzida em corrida encurtada, punição pós-prova) — exige revisão, não correção automática.
        const halved = off.every(({ r, expected }) => expected > 0 && Math.abs(r.points - expected / 2) < 1e-9);
        add(
          "medium",
          "points.rule_mismatch",
          `Pontos fora da tabela da temporada (${kind === "race" ? "corrida" : "sprint"}, etapa ${s.round} — ${s.raceName})`,
          `${off.length} piloto(s); ex.: ${off
            .slice(0, 3)
            .map(({ r, expected }) => `${r.driver.familyName} P${r.position ?? r.positionText}: ${r.points} (tabela ${expected})`)
            .join("; ")}${halved ? ". Padrão compatível com pontuação reduzida (corrida encurtada)." : ""}`,
        );
      }
    }
  }

  // ── Classificação oficial × recalculada ──
  const lastRound = seasonRounds(i.data).at(-1)?.round;
  if (i.driverStandings.round > i.events.length) add("high", "standings.round_out_of_range", "Classificação referente a etapa inexistente", `etapa ${i.driverStandings.round}`);
  if (lastRound !== undefined && lastRound === i.driverStandings.round) {
    for (const [kind, rows] of [
      ["driver", i.driverStandings.rows.map((r) => ({ id: r.driver.id, name: r.driver.familyName, points: r.points, pos: r.position }))],
      ["team", i.constructorStandings.rows.map((r) => ({ id: r.constructor.id, name: r.constructor.name, points: r.points, pos: r.position }))],
    ] as const) {
      const champ = championshipPositions(i.data, kind);
      for (const r of rows) {
        const a = analyzeEntity(i.data, kind, r.id, champ);
        const calc = a?.summary.points ?? 0;
        if (calc !== r.points) {
          add("high", "standings.points_mismatch", `Pontos oficiais diferem da soma dos resultados (${kind === "driver" ? "piloto" : "equipe"})`, `${r.name}: oficial ${r.points}, soma ${calc}`);
        } else if (r.pos !== null && champ.get(lastRound)?.get(r.id) !== r.pos) {
          add("medium", "standings.order_mismatch", "Ordem recalculada difere da oficial", `${r.name}: oficial P${r.pos}, recalculada P${champ.get(lastRound)?.get(r.id)}`);
        }
      }
    }
  } else if (lastRound !== undefined) {
    add("low", "standings.lagging", "Classificação oficial ainda não reflete a última etapa com resultados", `classificação: etapa ${i.driverStandings.round}; resultados: etapa ${lastRound}`);
  }

  const order: Severity[] = ["critical", "high", "medium", "low"];
  return issues.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
}
