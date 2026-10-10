import { createHmac, timingSafeEqual } from "node:crypto";

// Token de sessão: base64url(payload JSON) + "." + HMAC-SHA256. Sem estado no servidor;
// a cada requisição o usuário também é reconsultado no banco (desativação imediata).

export type SessionPayload = { uid: string; role: "editor" | "admin"; exp: number };

export const SESSION_COOKIE = "ag_session";
export const SESSION_TTL_SECONDS = 8 * 3600;

function secret(): string {
  const s = process.env.SESSION_SECRET ?? "";
  if (s.length < 32) throw new Error("SESSION_SECRET ausente ou curto demais (mínimo 32 caracteres).");
  return s;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function createSessionToken(p: Omit<SessionPayload, "exp">, nowMs = Date.now()): string {
  const payload: SessionPayload = { ...p, exp: Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function verifySessionToken(token: string | undefined, nowMs = Date.now()): SessionPayload | null {
  if (!token) return null;
  const [data, mac] = token.split(".");
  if (!data || !mac) return null;
  const expected = Buffer.from(sign(data));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as SessionPayload;
    if (typeof p.uid !== "string" || (p.role !== "editor" && p.role !== "admin")) return null;
    if (typeof p.exp !== "number" || p.exp * 1000 < nowMs) return null;
    return p;
  } catch {
    return null;
  }
}
