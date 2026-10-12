import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Draft, EditorialAI, FactCheck } from "@/lib/news/ai";
import { runNewsCycle } from "@/lib/news/pipeline";
import { NEWS_SOURCES } from "@/lib/news/sources";
import type { PromptSource } from "@/lib/news/prompts";

// Teste de integração do pipeline: banco SQLite real (arquivo temporário), feeds HTTP simulados
// e um agente de IA falso e determinístico. Dados de notícia SINTÉTICOS.

const DB_FILE = path.resolve("prisma", "pipeline-test.db");
const url = `file:${DB_FILE}`;
let db: PrismaClient;

const T = new Date("2026-10-10T10:00:00Z");
const rssDate = (min: number) => new Date(T.getTime() + min * 60_000).toUTCString();

function rss(items: { title: string; link: string; desc: string; min: number }[]) {
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>${items
    .map((i) => `<item><title>${i.title}</title><link>${i.link}</link><guid>${i.link}</guid><description>${i.desc}</description><pubDate>${rssDate(i.min)}</pubDate></item>`)
    .join("")}</channel></rss>`;
}

const FEEDS: Record<string, string> = {
  "https://feeds.bbci.co.uk/sport/formula1/rss.xml": rss([
    { title: "Verstappen takes Singapore GP pole ahead of Leclerc", link: "https://www.bbc.com/sport/formula1/articles/pole1", desc: "Max Verstappen will start from pole.", min: 0 },
    { title: "F1 driver hospitalised after heavy crash at Singapore", link: "https://www.bbc.com/sport/formula1/articles/crash1", desc: "A driver was taken to hospital.", min: 5 },
  ]),
  "https://www.autosport.com/rss/f1/news/": rss([
    { title: "Verstappen beats Leclerc to Singapore Grand Prix pole position", link: "https://www.autosport.com/f1/news/pole/1/", desc: "Red Bull driver on pole.", min: 10 },
  ]),
  "https://www.the-race.com/rss/": rss([
    { title: "F1 driver hospitalised after heavy Singapore crash", link: "https://www.the-race.com/formula-1/crash/", desc: "Hospital checks after crash.", min: 12 },
    { title: "MotoGP title decider preview", link: "https://www.the-race.com/motogp/x/", desc: "Bikes.", min: 13 },
  ]),
  "https://www.formula1.com/en/latest/all.xml": rss([
    { title: "Our Singapore Grand Prix Bet Builder picks made", link: "https://www.formula1.com/en/latest/article/bet.1", desc: "Betting.", min: 1 },
  ]),
  "https://www.motorsport.com/rss/f1/news/": rss([
    { title: "Ferrari reportedly in talks over 2027 seat", link: "https://www.motorsport.com/f1/news/talks/1/", desc: "Rumour.", min: 3 },
  ]),
  "https://motorsport.uol.com.br/rss/f1/news/": rss([]),
  "https://www.fia.com/rss/press-release": rss([]),
};

function mockFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const u = new URL(String(input instanceof Request ? input.url : input));
    const key = u.toString();
    if (FEEDS[key] !== undefined) return new Response(FEEDS[key], { status: 200, headers: { "content-type": "application/rss+xml" } });
    // Demais fontes cadastradas: feed válido, sem itens.
    if (NEWS_SOURCES.some((src) => src.feedUrl === key)) return new Response(rss([]), { status: 200, headers: { "content-type": "application/rss+xml" } });
    if (u.pathname === "/robots.txt") return new Response("not found", { status: 404 });
    const html = `<html><body><nav><p>menu</p></nav><article>${[1, 2, 3, 4].map((n) => `<p>Evidence paragraph ${n} with enough words about the session and the result for checking.</p>`).join("")}</article></body></html>`;
    return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
  });
}

const PT_SENTENCES = [
  "A sessão em Marina Bay terminou com o neerlandês à frente, segundo o relato publicado pelos veículos britânicos.",
  "De acordo com a apuração das fontes, a diferença para o monegasco foi pequena na última tentativa.",
  "As equipes ainda analisam os dados antes da prova de domingo, conforme os textos consultados.",
  "O resultado coloca a disputa do campeonato em evidência nas etapas finais da temporada.",
];

class FakeAI implements EditorialAI {
  calls = 0;
  async ping() {
    return { ok: true as const, detail: "fake" };
  }
  async write(sources: PromptSource[]) {
    this.calls++;
    const body = Array.from({ length: 12 }, (_, i) => PT_SENTENCES[i % PT_SENTENCES.length]!.replace("A sessão", `Parte ${i + 1}: a sessão`)).join("\n\n");
    const draft: Draft = {
      skip: false,
      skipReason: "",
      headline: `Notícia sobre ${sources[0]!.title}`.slice(0, 100),
      dek: "Linha fina de teste com contexto suficiente para o leitor entender o fato.",
      category: "classificacao",
      body,
      claims: [{ text: "Fato 1", sourceIds: [sources[0]!.id] }],
      usedSourceIds: sources.map((s) => s.id),
      sensitiveTopics: [],
    };
    return { ok: true as const, data: draft, usage: { inputTokens: 1000, outputTokens: 500, costUsd: 0.014 }, model: "fake", promptVersion: "test" };
  }
  async factCheck() {
    const fc: FactCheck = {
      claims: Array.from({ length: 5 }, (_, i) => ({ text: `Afirmação ${i}`, verdict: "supported" as const, evidence: "quote", sourceIds: ["S1"] })),
      numbersConsistent: true,
      attributionOk: true,
      overallConfidence: 0.95,
      notes: "",
    };
    return { ok: true as const, data: fc, usage: { inputTokens: 800, outputTokens: 300, costUsd: 0.009 }, model: "fake", promptVersion: "test" };
  }
}

beforeAll(() => {
  // Banco descartável exclusivo do teste: removido e recriado a cada execução.
  for (const f of [DB_FILE, `${DB_FILE}-journal`]) rmSync(f, { force: true });
  execSync("npx prisma db push --skip-generate", { env: { ...process.env, DATABASE_URL: url }, stdio: "ignore" });
  db = new PrismaClient({ datasources: { db: { url } } });
}, 120_000);

afterAll(async () => {
  await db?.$disconnect();
  for (const f of [DB_FILE, `${DB_FILE}-journal`]) rmSync(f, { force: true });
  vi.unstubAllGlobals();
});

describe("pipeline da redação (integração)", () => {
  const ai = new FakeAI();
  const now = () => new Date(T.getTime() + 2 * 3600_000);
  const base = { trigger: "cli" as const, mode: "auto_restricted" as const, maxPerRun: 5, maxPerDay: 24, fetchFullText: true, ai, now };

  it("monitora, deduplica, redige, checa e decide", async () => {
    vi.stubGlobal("fetch", mockFetch());
    const { stats } = await runNewsCycle({ db, ...base });

    expect(Object.values(stats.sources).every((s) => s.ok)).toBe(true);

    const excluded = await db.feedItem.findMany({ where: { excluded: true } });
    expect(excluded.map((e) => e.title).sort()).toEqual(["MotoGP title decider preview", "Our Singapore Grand Prix Bet Builder picks made"]);

    const articles = await db.article.findMany({ include: { sources: true, claims: true, versions: true } });
    expect(articles).toHaveLength(2); // pole (2 grupos) e acidente (2 grupos); rumor de fonte única não é redigido
    expect(ai.calls).toBe(2);

    const pole = articles.find((a) => a.headline.includes("pole"))!;
    expect(pole.status).toBe("published");
    expect(pole.publishedAt).not.toBeNull();
    expect(new Set(pole.sources.map((s) => s.sourceId))).toEqual(new Set(["bbc-sport", "autosport"]));
    expect(pole.claims).toHaveLength(5);
    expect(pole.versions).toHaveLength(1);

    const crash = articles.find((a) => a.headline.includes("hospitalised"))!;
    expect(crash.status).toBe("in_review");
    expect(crash.sensitive).toBe(true);
    expect(JSON.parse(crash.reviewReasons).join(" ")).toMatch(/sensível/);

    const evidence = await db.feedItem.count({ where: { evidenceText: { not: null } } });
    expect(evidence).toBeGreaterThan(0);
    expect(await db.agentRun.count()).toBe(4);

    // Progresso final gravado por etapa
    const run = await db.ingestionRun.findFirst({ orderBy: { startedAt: "desc" } });
    const progress = JSON.parse(run!.progress);
    expect(progress.label).toBe("Buscar e escrever notícias");
    const byKey = Object.fromEntries(progress.phases.map((p: { key: string }) => [p.key, p]));
    expect(byKey.sources).toMatchObject({ status: "done", done: NEWS_SOURCES.length, total: NEWS_SOURCES.length });
    expect(byKey.cluster).toMatchObject({ status: "done" });
    expect(byKey.writing.status).toBe("done");
    expect(byKey.writing.done).toBe(byKey.writing.total);
    expect(byKey.writing.total).toBe(2 * 4); // 2 pautas × 4 passos
    expect(stats.aiCostUsd).toBeCloseTo(0.046, 5);
  });

  it("é idempotente: um novo ciclo não duplica itens nem artigos", async () => {
    vi.stubGlobal("fetch", mockFetch());
    const before = await db.feedItem.count();
    const { stats } = await runNewsCycle({ db, ...base });
    expect(stats.newItems).toBe(0);
    expect(await db.feedItem.count()).toBe(before);
    expect(await db.article.count()).toBe(2);
  });

  it("modo semi nunca publica sozinho", async () => {
    vi.stubGlobal("fetch", mockFetch());
    await db.article.deleteMany();
    await db.story.updateMany({ data: { status: "open" } });
    await runNewsCycle({ db, ...base, mode: "semi" });
    expect(await db.article.count({ where: { status: "published" } })).toBe(0);
    expect(await db.article.count({ where: { status: "in_review" } })).toBe(2);
  });

  it("ciclo travado por processo encerrado é liberado após a janela da trava", async () => {
    vi.stubGlobal("fetch", mockFetch());
    const stale = await db.ingestionRun.create({
      data: { kind: "news_cycle", trigger: "admin", status: "running", startedAt: new Date(now().getTime() - 30 * 60_000) },
    });
    await runNewsCycle({ db, ...base, ingestOnly: true });
    expect((await db.ingestionRun.findUnique({ where: { id: stale.id } }))?.status).toBe("error");
  });

  it("ciclo recente em execução bloqueia um segundo ciclo", async () => {
    const live = await db.ingestionRun.create({ data: { kind: "news_cycle", trigger: "admin", status: "running", startedAt: now() } });
    await expect(runNewsCycle({ db, ...base, ingestOnly: true })).rejects.toThrow(/em execução/);
    await db.ingestionRun.update({ where: { id: live.id }, data: { status: "ok" } });
  });

  it("falha de fonte não derruba o ciclo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("erro", { status: 503 })),
    );
    const { stats } = await runNewsCycle({ db, ...base, ingestOnly: true });
    expect(Object.values(stats.sources).every((s) => !s.ok)).toBe(true);
    const failedRun = await db.ingestionRun.findFirst({ orderBy: { startedAt: "desc" } });
    const phases = JSON.parse(failedRun!.progress).phases;
    expect(phases.find((p: { key: string }) => p.key === "sources").status).toBe("error");
    expect(phases.find((p: { key: string }) => p.key === "writing").status).toBe("skipped");
    const run = await db.ingestionRun.findFirst({ orderBy: { startedAt: "desc" } });
    expect(run?.status).toBe("partial");
  });
});
