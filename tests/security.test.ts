import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { ArticleBody } from "@/components/article-body";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { rateLimit } from "@/lib/auth/rate-limit";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";
import { assertAllowedUrl, FetchBlockedError, isPathAllowed, parseRobots } from "@/lib/net/safe-fetch";

beforeAll(() => {
  process.env.SESSION_SECRET = "x".repeat(64);
});

describe("anti-SSRF", () => {
  const hosts = new Set(["www.autosport.com"]);
  it.each([
    "http://www.autosport.com/x",
    "https://169.254.169.254/latest/meta-data",
    "https://localhost/admin",
    "https://www.autosport.com.evil.com/",
    "https://user:pass@www.autosport.com/",
    "https://www.autosport.com:8443/",
    "file:///etc/passwd",
  ])("bloqueia %s", (u) => {
    expect(() => assertAllowedUrl(u, hosts)).toThrow(FetchBlockedError);
  });
  it("permite host da lista", () => {
    expect(assertAllowedUrl("https://www.autosport.com/f1/news/", hosts).hostname).toBe("www.autosport.com");
  });
});

describe("robots.txt", () => {
  const txt = `User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow: /private/\nAllow: /private/ok\nDisallow: /*.pdf$\n`;
  it("aplica o grupo * quando não há grupo para o nosso agente", () => {
    const r = parseRobots(txt);
    expect(isPathAllowed(r, "/f1/news/123")).toBe(true);
    expect(isPathAllowed(r, "/private/x")).toBe(false);
    expect(isPathAllowed(r, "/private/ok")).toBe(true);
    expect(isPathAllowed(r, "/doc.pdf")).toBe(false);
  });
  it("respeita bloqueio específico ao nosso agente", () => {
    const r = parseRobots(`User-agent: ApexGridBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n`);
    expect(isPathAllowed(r, "/qualquer")).toBe(false);
  });
});

describe("sessão administrativa", () => {
  it("token válido é aceito; adulterado ou expirado, não", () => {
    const t = createSessionToken({ uid: "u1", role: "editor" });
    expect(verifySessionToken(t)?.uid).toBe("u1");
    const [data, mac] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "u1", role: "admin", exp: 9999999999 })).toString("base64url");
    expect(verifySessionToken(`${forged}.${mac}`)).toBeNull();
    expect(verifySessionToken(`${data}.x${mac!.slice(1)}`)).toBeNull();
    expect(verifySessionToken(t, Date.now() + 9 * 3600_000)).toBeNull();
    expect(verifySessionToken(undefined)).toBeNull();
  });
  it("senha: hash scrypt verifica e rejeita", () => {
    const h = hashPassword("uma senha bem longa");
    expect(verifyPassword("uma senha bem longa", h)).toBe(true);
    expect(verifyPassword("outra senha qualquer", h)).toBe(false);
    expect(() => hashPassword("curta")).toThrow();
  });
  it("rate limit bloqueia após o limite", () => {
    const k = `t-${Math.random()}`;
    for (let i = 0; i < 5; i++) expect(rateLimit(k, 5, 60_000).ok).toBe(true);
    expect(rateLimit(k, 5, 60_000).ok).toBe(false);
  });
});

describe("renderização de artigo (XSS)", () => {
  it("HTML no corpo é exibido como texto, nunca executado", () => {
    const html = renderToStaticMarkup(createElement(ArticleBody, { markdown: `Olá <img src=x onerror=alert(1)>\n\n## Título\n\n- **item**` }));
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).toContain("<h2>Título</h2>");
    expect(html).toContain("<strong>item</strong>");
  });
});

describe("navegação", () => {
  it("marca a seção atual inclusive em subrotas", async () => {
    const { isActive, NAV } = await import("@/components/nav-links");
    const item = (label: string) => NAV.find((n) => n.label === label)!;
    const activeOn = (path: string) => NAV.filter((n) => isActive(path, n)).map((n) => n.label);
    // Exatamente um item ativo por página conhecida
    expect(activeOn("/calendar")).toEqual(["Calendário"]);
    expect(activeOn("/calendar/2026/17")).toEqual(["Race Center"]);
    expect(activeOn("/results")).toEqual(["Resultados"]);
    expect(activeOn("/news/alguma-materia")).toEqual(["Notícias"]);
    expect(activeOn("/")).toEqual([]);
    expect(isActive("/calendario-falso", item("Calendário"))).toBe(false);
  });
});

describe("etiquetas de cronometragem nas matérias", () => {
  const render = (md: string) => renderToStaticMarkup(createElement(ArticleBody, { markdown: md }));
  const chips = (html: string, kind: "lap" | "gap") => [...html.matchAll(new RegExp(String.raw`timing-${kind}[^>]*>(?:<svg[\s\S]*?</svg>)?([^<]+)<`, "g"))].map((m) => m[1]);

  it("destaca tempos de volta e diferenças nos formatos usados", () => {
    const html = render("Marca de 1min31s373 no Q3, apenas 0s054 à frente; Hamilton fez 1:31.496 (+0.123s) e Norris ficou a +0s400.");
    expect(chips(html, "lap")).toEqual(["1min31s373", "1:31.496"]);
    expect(chips(html, "gap")).toEqual(["0s054", "+0.123s", "+0s400"]);
  });

  it("não confunde anos, horários, contagens e palavras com tempos", () => {
    const html = render("Em 2026, às 21:00, ele somou 25 pontos em 10s de bandeira; código ABC1min31s373x e versão 1.234.");
    expect(html).not.toContain("timing");
  });

  it("funciona dentro de negrito e não executa HTML", () => {
    const html = render("**Pole com 1min31s373** <b>x</b>");
    expect(chips(html, "lap")).toEqual(["1min31s373"]);
    expect(html).toContain("&lt;b&gt;");
  });
});
