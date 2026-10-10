// Regras de pontuação da F1 por temporada (somente o período suportado pelo modelo).
// F2 e F3 têm sistemas próprios e NÃO devem reutilizar estas tabelas.
// Referência: Regulamento Esportivo da FIA de cada temporada (ver docs/PROBABILITY.md).

export type PointsSystem = {
  season: number;
  race: number[]; // pontos por posição (índice 0 = 1º)
  sprint: number[];
  /** Ponto extra para volta mais rápida, se terminar no top 10 (2019–2024). */
  fastestLapPoint: number;
};

const RACE_TOP10 = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_2022 = [8, 7, 6, 5, 4, 3, 2, 1];
const SPRINT_2021 = [3, 2, 1];

export function pointsSystem(season: number): PointsSystem {
  if (season < 2010) {
    throw new Error(`Sistema de pontuação de ${season} não suportado pelo modelo (apenas 2010+).`);
  }
  const fastestLapPoint = season >= 2019 && season <= 2024 ? 1 : 0;
  const sprint = season >= 2022 ? SPRINT_2022 : season === 2021 ? SPRINT_2021 : [];
  return { season, race: RACE_TOP10, sprint, fastestLapPoint };
}

export function racePoints(sys: PointsSystem, position: number | null, fastestLap = false): number {
  if (position === null || position < 1) return 0;
  const base = sys.race[position - 1] ?? 0;
  const bonus = fastestLap && sys.fastestLapPoint && position <= 10 ? sys.fastestLapPoint : 0;
  return base + bonus;
}

export function sprintPoints(sys: PointsSystem, position: number | null): number {
  if (position === null || position < 1) return 0;
  return sys.sprint[position - 1] ?? 0;
}

/** Máximo de pontos que UM piloto ainda pode somar nas etapas restantes. */
export function maxRemainingDriverPoints(sys: PointsSystem, remainingRaces: number, remainingSprints: number): number {
  return remainingRaces * ((sys.race[0] ?? 0) + sys.fastestLapPoint) + remainingSprints * (sys.sprint[0] ?? 0);
}

/** Máximo para uma equipe (dois carros: 1º + 2º). */
export function maxRemainingTeamPoints(sys: PointsSystem, remainingRaces: number, remainingSprints: number): number {
  const race12 = (sys.race[0] ?? 0) + (sys.race[1] ?? 0) + sys.fastestLapPoint;
  const sprint12 = (sys.sprint[0] ?? 0) + (sys.sprint[1] ?? 0);
  return remainingRaces * race12 + remainingSprints * sprint12;
}

/**
 * Critério de desempate (countback): mais vitórias; persistindo, mais 2º lugares, etc.
 * Usa somente resultados de Grande Prêmio (não sprint).
 * Retorna negativo se `a` fica à frente de `b`.
 */
export function compareCountback(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = (b[i] ?? 0) - (a[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
