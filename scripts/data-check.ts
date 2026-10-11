// Valida a consistência dos dados esportivos de uma temporada contra a fonte.
// Uso: npm run data:check            (temporada atual)
//      npm run data:check -- 2025
import { JolpicaProvider } from "../src/lib/f1/providers/jolpica";
import { validateSeason } from "../src/lib/f1/validate";

async function main() {
  const arg = process.argv.find((a) => /^\d{4}$/.test(a));
  const p = new JolpicaProvider();
  const events = await p.getSchedule(arg ? Number(arg) : "current");
  const season = events[0]?.season ?? Number(arg);
  const [races, sprints, qualis, ds, cs] = await Promise.all([
    p.getSeasonResults(season, "race"),
    p.getSeasonResults(season, "sprint"),
    p.getSeasonQualifying(season),
    p.getDriverStandings(season),
    p.getConstructorStandings(season),
  ]);
  const issues = validateSeason({ season, events, data: { races, sprints, qualis }, driverStandings: ds, constructorStandings: cs });
  console.log(`Temporada ${season}: ${events.length} etapas · ${races.length} corridas · ${sprints.length} sprints · ${qualis.length} classificações · classificação após etapa ${ds.round}`);
  if (issues.length === 0) console.log("✅ Nenhuma inconsistência encontrada.");
  for (const i of issues) console.log(`[${i.severity}] ${i.code}: ${i.message}${i.detail ? ` — ${i.detail}` : ""}`);
  process.exitCode = issues.some((i) => i.severity === "critical" || i.severity === "high") ? 1 : 0;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

export {};
