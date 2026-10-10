// Fetch defensivo para conteúdo de terceiros.
// - Somente HTTPS e somente hosts de uma lista fechada (anti-SSRF).
// - Redirecionamentos seguidos manualmente, revalidando o host a cada salto.
// - Limite de tamanho e de tempo; tipos de conteúdo restritos.
// - Respeita robots.txt para páginas de artigo.

export const USER_AGENT = "ApexGridBot/0.1 (+https://apexgrid.example/sources; monitoramento editorial)";

export class FetchBlockedError extends Error {}

export class HttpStatusError extends Error {
  constructor(readonly status: number, host: string) {
    super(`HTTP ${status} em ${host}`);
  }
}

type SafeFetchOptions = {
  allowedHosts: Set<string>;
  maxBytes?: number;
  timeoutMs?: number;
  accept?: string;
  allowedContentTypes?: RegExp;
  maxRedirects?: number;
};

export function assertAllowedUrl(raw: string, allowedHosts: Set<string>): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchBlockedError(`URL inválida: ${raw}`);
  }
  if (url.protocol !== "https:") throw new FetchBlockedError(`Protocolo não permitido: ${url.protocol}`);
  if (url.username || url.password) throw new FetchBlockedError("Credenciais em URL não são permitidas");
  if (url.port && url.port !== "443") throw new FetchBlockedError(`Porta não permitida: ${url.port}`);
  if (!allowedHosts.has(url.hostname.toLowerCase())) {
    throw new FetchBlockedError(`Host fora da lista permitida: ${url.hostname}`);
  }
  return url;
}

export async function safeFetchText(rawUrl: string, opts: SafeFetchOptions): Promise<{ url: string; text: string; contentType: string }> {
  const maxBytes = opts.maxBytes ?? 3_000_000;
  const maxRedirects = opts.maxRedirects ?? 3;
  let current = assertAllowedUrl(rawUrl, opts.allowedHosts);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await fetch(current, {
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT, Accept: opts.accept ?? "*/*" },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
      cache: "no-store",
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error(`Redirecionamento sem destino em ${current}`);
      current = assertAllowedUrl(new URL(loc, current).toString(), opts.allowedHosts);
      continue;
    }
    if (!res.ok) throw new HttpStatusError(res.status, current.hostname);
    const contentType = res.headers.get("content-type") ?? "";
    if (opts.allowedContentTypes && !opts.allowedContentTypes.test(contentType)) {
      throw new FetchBlockedError(`Tipo de conteúdo não permitido: ${contentType}`);
    }
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > maxBytes) throw new FetchBlockedError(`Resposta excede ${maxBytes} bytes`);
    const reader = res.body?.getReader();
    if (!reader) return { url: current.toString(), text: "", contentType };
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new FetchBlockedError(`Resposta excede ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
    const buf = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      buf.set(c, off);
      off += c.byteLength;
    }
    return { url: current.toString(), text: new TextDecoder("utf-8").decode(buf), contentType };
  }
  throw new Error(`Redirecionamentos demais a partir de ${rawUrl}`);
}

// ── robots.txt ─────────────────────────────────────────────────────

type RobotsRules = { disallow: string[]; allow: string[]; fetchedAt: number };
const robotsCache = new Map<string, RobotsRules>();

/** Parser mínimo: aplica o grupo do nosso agente ou, na falta dele, o grupo "*". */
export function parseRobots(txt: string, agent = "apexgridbot"): { disallow: string[]; allow: string[] } {
  const groups: { agents: string[]; disallow: string[]; allow: string[] }[] = [];
  let cur: { agents: string[]; disallow: string[]; allow: string[] } | null = null;
  let lastWasAgent = false;
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], disallow: [], allow: [] };
        groups.push(cur);
      }
      cur.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!cur) continue;
    if (key === "disallow" && value) cur.disallow.push(value);
    if (key === "allow" && value) cur.allow.push(value);
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== "*" && agent.includes(a)));
  const chosen = mine.length ? mine : groups.filter((g) => g.agents.includes("*"));
  return {
    disallow: chosen.flatMap((g) => g.disallow),
    allow: chosen.flatMap((g) => g.allow),
  };
}

function ruleMatches(rule: string, path: string): boolean {
  const anchored = rule.endsWith("$");
  const body = anchored ? rule.slice(0, -1) : rule;
  const re = new RegExp(
    "^" + body.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + (anchored ? "$" : ""),
  );
  return re.test(path);
}

/** Regra mais específica (mais longa) vence; empate favorece Allow. */
export function isPathAllowed(rules: { disallow: string[]; allow: string[] }, path: string): boolean {
  let best: { len: number; allow: boolean } | null = null;
  for (const r of rules.disallow) if (ruleMatches(r, path) && (!best || r.length > best.len)) best = { len: r.length, allow: false };
  for (const r of rules.allow) if (ruleMatches(r, path) && (!best || r.length >= best.len)) best = { len: r.length, allow: true };
  return best ? best.allow : true;
}

export async function robotsAllows(rawUrl: string, allowedHosts: Set<string>): Promise<boolean> {
  const url = assertAllowedUrl(rawUrl, allowedHosts);
  const key = url.host;
  let rules = robotsCache.get(key);
  if (!rules || Date.now() - rules.fetchedAt > 6 * 3600_000) {
    try {
      const { text } = await safeFetchText(`https://${key}/robots.txt`, {
        allowedHosts,
        maxBytes: 500_000,
        timeoutMs: 10_000,
      });
      rules = { ...parseRobots(text), fetchedAt: Date.now() };
    } catch (err) {
      // 404/410 = sem restrições (RFC 9309). Qualquer outro erro → conservador: não baixa.
      const missing = err instanceof HttpStatusError && (err.status === 404 || err.status === 410);
      rules = { disallow: missing ? [] : ["/"], allow: [], fetchedAt: Date.now() };
    }
    robotsCache.set(key, rules);
  }
  return isPathAllowed(rules, url.pathname + url.search);
}
