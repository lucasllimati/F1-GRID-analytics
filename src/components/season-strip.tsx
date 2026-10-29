import Link from "next/link";
import { freshConstructorStandings, freshDriverStandings } from "@/lib/f1/compare";
import { gpName } from "@/lib/f1/gp-names";
import { nationalityFlag } from "@/lib/f1/nationality";
import { lastCompletedEvent, nextEvent, raceSession } from "@/lib/f1/schedule";
import { driverName, f1, load } from "@/lib/f1/service";
import { Container } from "./ui";

// Faixa de contexto no topo das páginas de estatística: em que ponto está a temporada,
// quem lidera e qual é a próxima etapa. Se a fonte falhar, simplesmente não aparece.

const dayMonth = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

export async function SeasonStrip() {
  const [eventsR, dsR, csR] = await Promise.all([load(f1.getSchedule("current")), load(f1.getDriverStandings("current")), load(f1.getConstructorStandings("current"))]);
  if (!eventsR.ok) return null;
  const season = eventsR.data[0]?.season;
  const [racesR, sprintsR] = season ? await Promise.all([load(f1.getSeasonResults(season, "race")), load(f1.getSeasonResults(season, "sprint"))]) : [null, null];
  const events = eventsR.data;
  const last = lastCompletedEvent(events);
  const next = nextEvent(events);
  const results = { races: racesR?.ok ? racesR.data : [], sprints: sprintsR?.ok ? sprintsR.data : [], qualis: [] };
  const leader = dsR.ok ? freshDriverStandings(dsR.data, results).rows[0] : undefined;
  const team = csR.ok ? freshConstructorStandings(csR.data, results).rows[0] : undefined;
  const nextRace = next ? raceSession(next) : null;

  return (
    <div className="border-b border-line bg-elev/60">
      <Container className="flex flex-wrap items-center gap-x-6 gap-y-1 py-2 text-sm text-muted">
        <span>
          Etapa <strong className="text-fg tabular">{last?.round ?? 0}</strong> de <span className="tabular">{events.length}</span>
        </span>
        {last && (
          <span>
            Após o{" "}
            <Link href={`/calendar/${last.season}/${last.round}`} className="font-semibold text-fg hover:underline">
              <span aria-hidden="true">{last.flag} </span>
              {gpName(last.name)}
            </Link>
          </span>
        )}
        {leader && leader.points > 0 && (
          <span>
            Líder:{" "}
            <strong className="text-fg">
              <span aria-hidden="true">{nationalityFlag(leader.driver.nationality)} </span>
              {driverName(leader.driver)}
            </strong>{" "}
            · <span className="tabular">{leader.points}</span> pts
          </span>
        )}
        {team && team.points > 0 && (
          <span>
            Equipes: <strong className="text-fg">{team.constructor.name}</strong> · <span className="tabular">{team.points}</span> pts
          </span>
        )}
        {next && (
          <span>
            Próxima:{" "}
            <Link href={`/calendar/${next.season}/${next.round}`} className="font-semibold text-fg hover:underline">
              <span aria-hidden="true">{next.flag} </span>
              {gpName(next.name)}
            </Link>
            {nextRace && <span className="tabular"> · {dayMonth.format(new Date(nextRace.startsAt ?? `${nextRace.date}T12:00:00Z`))}</span>}
          </span>
        )}
      </Container>
    </div>
  );
}
