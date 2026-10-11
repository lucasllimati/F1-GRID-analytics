// Teste de fumaça pós-deploy: rotas públicas, 404s, proteção do painel/cron e health check.
// Uso: npm run smoke                       (http://localhost:3000)
//      SMOKE_BASE_URL=https://seu-dominio npm run smoke
// Não altera dados: só faz GETs.

const BASE = (process.env.SMOKE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

type Check = { path: string; status: number; contains?: string; redirectTo?: string };

const year = new Date().getUTCFullYear();
const CHECKS: Check[] = [
  { path: "/", status: 200, contains: "Championship snapshot" },
  { path: "/calendar", status: 200, contains: "Calendário" },
  { path: `/calendar/${year}/1`, status: 200, contains: "Horários das sessões" },
  { path: `/calendar/${year}/1?tab=grid`, status: 200 },
  { path: "/standings", status: 200, contains: "Pilotos" },
  { path: `/standings?season=${year - 1}`, status: 200 },
  { path: "/championship-probabilities", status: 200, contains: "Probabilidades" },
  { path: "/head-to-head", status: 200, contains: "Pontos acumulados" },
  { path: "/head-to-head?kind=team", status: 200 },
  { path: "/news", status: 200, contains: "Notícias" },
  { path: "/sources", status: 200 },
  { path: "/methodology", status: 200 },
  { path: "/feed.xml", status: 200, contains: "<rss" },
  { path: "/sitemap.xml", status: 200, contains: "<urlset" },
  { path: "/robots.txt", status: 200, contains: "Disallow: /admin" },
  { path: "/api/health", status: 200, contains: '"status"' },
  { path: "/api/admin/session", status: 200, contains: '"loggedIn":false' },
  { path: "/race-center", status: 307 },
  { path: "/news/nao-existe-xyz", status: 404 },
  { path: `/calendar/${year}/99`, status: 404 },
  { path: "/admin", status: 307, redirectTo: "/admin/login" },
  { path: "/api/cron/news", status: 401 },
];

async function main() {
  let failures = 0;
  console.log(`Smoke test em ${BASE}\n`);
  for (const c of CHECKS) {
    const t = Date.now();
    try {
      const res = await fetch(BASE + c.path, { redirect: "manual", signal: AbortSignal.timeout(60_000) });
      const body = c.contains ? await res.text() : "";
      const problems: string[] = [];
      if (res.status !== c.status) problems.push(`status ${res.status} (esperado ${c.status})`);
      if (c.contains && !body.includes(c.contains)) problems.push(`sem "${c.contains}"`);
      if (c.redirectTo && !(res.headers.get("location") ?? "").includes(c.redirectTo)) problems.push(`não redirecionou para ${c.redirectTo}`);
      // Headers de segurança presentes em todas as respostas HTML/JSON.
      if (!res.headers.get("x-content-type-options")) problems.push("sem X-Content-Type-Options");
      const ms = Date.now() - t;
      if (problems.length) {
        failures++;
        console.log(`✗ ${c.path} — ${problems.join("; ")} (${ms} ms)`);
      } else {
        console.log(`✓ ${c.path} (${res.status}, ${ms} ms)`);
      }
    } catch (err) {
      failures++;
      console.log(`✗ ${c.path} — ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`\n${CHECKS.length - failures}/${CHECKS.length} verificações OK`);
  process.exitCode = failures ? 1 : 0;
}

main();

export {};
