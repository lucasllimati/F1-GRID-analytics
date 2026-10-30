#!/usr/bin/env node
// Gera src/data/f1-history.json: o histórico da F1 desde 1950 (temporadas já encerradas),
// usado em /records, "neste dia" e no gráfico de temporadas. A temporada em andamento NÃO
// entra aqui: o site soma os resultados dela ao vivo.
//
// Uso:  node scripts/build-history.mjs [--until 2025] [--delay 8000]
//
// A Jolpica limita ~500 consultas por hora; com o intervalo padrão (8 s) o script fica abaixo
// disso. Cada resposta é guardada em .cache/jolpica/ — se o script parar, rodar de novo
// continua de onde parou, sem repetir consultas. Só a temporada mais recente costuma mudar:
// para atualizá-la, apague .cache/jolpica/<ano>-* e rode de novo.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const BASE = "https://api.jolpi.ca/ergast/f1";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const CACHE = path.join(ROOT, ".cache", "jolpica");
const OUT = path.join(ROOT, "src", "data", "f1-history.json");

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : def;
};
const UNTIL = arg("until", new Date().getUTCFullYear() - 1);
const DELAY = arg("delay", 8000);
const FIRST = 1950;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fetched = 0;

/** GET com cache em disco, intervalo entre consultas e espera longa em 429. */
async function get(key, url) {
  const file = path.join(CACHE, `${key}.json`);
  if (existsSync(file)) return JSON.parse(await readFile(file, "utf8"));
  for (let attempt = 0; attempt < 6; attempt++) {
    if (fetched > 0) await sleep(DELAY);
    fetched++;
    let res;
    try {
      res = await fetch(url, { headers: { "user-agent": "apex-grid-history/1.0" }, signal: AbortSignal.timeout(30_000) });
    } catch (err) {
      console.warn(`  rede: ${err.message} — nova tentativa`);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      const wait = res.status === 429 ? 120_000 : 20_000;
      console.warn(`  HTTP ${res.status} em ${key}; aguardando ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
    const json = await res.json();
    await writeFile(file, JSON.stringify(json));
    return json;
  }
  throw new Error(`Falhou após várias tentativas: ${url}`);
}

/** Todas as páginas de um endpoint paginado (limite 100 por página). */
async function getAll(key, url, pick) {
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const j = await get(`${key}-${offset}`, `${url}${url.includes("?") ? "&" : "?"}limit=100&offset=${offset}`);
    out.push(...pick(j.MRData));
    if (offset + 100 >= Number(j.MRData.total)) break;
  }
  return out;
}

/** Junta páginas: uma corrida pode vir dividida entre duas páginas. */
function mergeRaces(races, field) {
  const by = new Map();
  for (const r of races) {
    const cur = by.get(r.round);
    if (cur) cur[field].push(...r[field]);
    else by.set(r.round, { ...r, [field]: [...r[field]] });
  }
  return [...by.values()].sort((a, b) => Number(a.round) - Number(b.round));
}

const name = (d) => `${d.givenName} ${d.familyName}`;

async function main() {
  await mkdir(CACHE, { recursive: true });
  await mkdir(path.dirname(OUT), { recursive: true });

  const drivers = new Map(); // id → agregados
  const teams = new Map();
  const seasons = [];
  const races = [];

  const driver = (d) => {
    if (!drivers.has(d.driverId))
      drivers.set(d.driverId, {
        id: d.driverId, name: name(d), nationality: d.nationality ?? "", starts: 0, wins: 0, podiums: 0, poles: 0,
        fastestLaps: 0, titles: 0, points: 0, firstSeason: null, lastSeason: null, seasons: {},
      });
    return drivers.get(d.driverId);
  };
  const team = (c) => {
    if (!teams.has(c.constructorId))
      teams.set(c.constructorId, {
        id: c.constructorId, name: c.name, nationality: c.nationality ?? "", starts: 0, wins: 0, podiums: 0, poles: 0,
        titles: 0, firstSeason: null, lastSeason: null, seasons: {},
      });
    return teams.get(c.constructorId);
  };

  for (let season = FIRST; season <= UNTIL; season++) {
    console.log(`Temporada ${season}…`);
    const results = mergeRaces(await getAll(`${season}-results`, `${BASE}/${season}/results.json`, (m) => m.RaceTable.Races), "Results");
    // Classificação (qualifying) só existe na fonte a partir de 1994; antes, pole = largou em 1º.
    const qualis =
      season >= 1994
        ? new Map(
            mergeRaces(await getAll(`${season}-quali1`, `${BASE}/${season}/qualifying/1.json`, (m) => m.RaceTable.Races), "QualifyingResults").map(
              (r) => [r.round, r.QualifyingResults[0]],
            ),
          )
        : new Map();
    const ds = (await get(`${season}-driverstandings`, `${BASE}/${season}/driverstandings.json?limit=100`)).MRData.StandingsTable.StandingsLists[0];
    const cs =
      season >= 1958
        ? (await get(`${season}-constructorstandings`, `${BASE}/${season}/constructorstandings.json?limit=100`)).MRData.StandingsTable.StandingsLists[0]
        : null;

    for (const race of results) {
      // Carro dividido (anos 50): o mesmo piloto aparece mais de uma vez — conta uma largada/pódio por corrida.
      const counted = new Set();
      const countedDrivers = new Set();
      const podiumDrivers = new Set();
      const won = race.Results.find((r) => r.position === "1");
      // Pole oficial = quem larga em 1º: quando o mais rápido da classificação é punido ou excluído,
      // a FIA credita a pole ao herdeiro (ex.: Spa 2022, Mônaco 2012). Sem ninguém em 1º no grid
      // (pole largando do pit lane), vale o 1º da classificação.
      const poleRow = race.Results.find((r) => r.grid === "1") ?? qualis.get(race.round);
      for (const r of race.Results) {
        const d = driver(r.Driver);
        const t = team(r.Constructor);
        d.firstSeason ??= season;
        d.lastSeason = season;
        t.firstSeason ??= season;
        t.lastSeason = season;
        // Largada: não conta quem não se classificou/não largou (status "Did not qualify", "Did not start"…).
        const started = !/^(Did not|Not classified$|Withdrew|Excluded from qualifying)/i.test(r.status) || r.laps !== "0";
        if (started) {
          if (!countedDrivers.has(d.id)) {
            d.starts++;
            countedDrivers.add(d.id);
          }
          if (!counted.has(t.id)) {
            t.starts++;
            counted.add(t.id);
          }
        }
        const pos = Number(r.position);
        if (r.positionText === String(pos) && pos <= 3) {
          // Equipe: um pódio por carro (dois carros no pódio = dois pódios), como nas estatísticas oficiais.
          if (!podiumDrivers.has(d.id)) {
            d.podiums++;
            t.podiums++;
          }
          podiumDrivers.add(d.id);
        }
        if (r.FastestLap?.rank === "1") d.fastestLaps++;
      }
      if (won) {
        driver(won.Driver).wins++;
        team(won.Constructor).wins++;
      }
      if (poleRow) {
        driver(poleRow.Driver).poles++;
        team(poleRow.Constructor).poles++;
      }
      races.push({
        season,
        round: Number(race.round),
        name: race.raceName,
        date: race.date,
        circuit: race.Circuit.circuitName,
        country: race.Circuit.Location.country,
        winner: won ? { id: won.Driver.driverId, name: name(won.Driver), team: won.Constructor.name } : null,
        pole: poleRow ? { id: poleRow.Driver.driverId, name: name(poleRow.Driver) } : null,
      });
    }

    const champ = ds?.DriverStandings?.[0];
    const teamChamp = cs?.ConstructorStandings?.[0];
    for (const row of ds?.DriverStandings ?? []) {
      const d = driver(row.Driver);
      d.points += Number(row.points);
      d.seasons[season] = { pos: Number(row.position) || null, pts: Number(row.points), wins: Number(row.wins), team: row.Constructors?.at(-1)?.name ?? "" };
    }
    for (const row of cs?.ConstructorStandings ?? []) {
      team(row.Constructor).seasons[season] = { pos: Number(row.position) || null, pts: Number(row.points), wins: Number(row.wins) };
    }
    if (champ) driver(champ.Driver).titles++;
    if (teamChamp) team(teamChamp.Constructor).titles++;
    seasons.push({
      season,
      races: results.length,
      champion: champ ? { id: champ.Driver.driverId, name: name(champ.Driver), team: champ.Constructors?.at(-1)?.name ?? "", points: Number(champ.points), wins: Number(champ.wins) } : null,
      runnerUp: ds?.DriverStandings?.[1]
        ? { id: ds.DriverStandings[1].Driver.driverId, name: name(ds.DriverStandings[1].Driver), points: Number(ds.DriverStandings[1].points) }
        : null,
      teamChampion: teamChamp ? { id: teamChamp.Constructor.constructorId, name: teamChamp.Constructor.name, points: Number(teamChamp.points) } : null,
    });
  }

  const out = {
    generatedAt: new Date().toISOString(),
    source: "Jolpica-F1 API (CC BY-NC-SA 4.0)",
    firstSeason: FIRST,
    lastSeason: UNTIL,
    notes: {
      poles: "Pole = quem largou em 1º (como a FIA credita quando o mais rápido é punido); sem ninguém em 1º no grid, o mais rápido da classificação (dado disponível desde 1994).",
      fastestLaps: "A fonte só registra voltas mais rápidas a partir de 2004.",
    },
    seasons,
    races,
    drivers: [...drivers.values()],
    teams: [...teams.values()],
  };
  await writeFile(OUT, JSON.stringify(out));
  console.log(`OK: ${seasons.length} temporadas, ${races.length} corridas, ${drivers.size} pilotos → ${path.relative(ROOT, OUT)} (${fetched} consultas)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
