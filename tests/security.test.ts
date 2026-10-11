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
    const { isActive } = await import("@/components/nav-links");
    const cal = { href: "/calendar", label: "Calendário" };
    expect(isActive("/calendar", cal)).toBe(true);
    expect(isActive("/calendar/2026/17", cal)).toBe(true);
    expect(isActive("/calendario-falso", cal)).toBe(false);
    expect(isActive("/news", cal)).toBe(false);
  });
});
