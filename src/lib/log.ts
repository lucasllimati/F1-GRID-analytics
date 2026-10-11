// Logger estruturado (JSON por linha), sem dependências.
// Regras: nunca registrar tokens, senhas, cookies ou cabeçalhos de autenticação —
// chaves sensíveis são mascaradas automaticamente.

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const SENSITIVE = /pass(word)?|secret|token|authorization|cookie|api[-_]?key|session/i;

function minLevel(): Level {
  const v = (process.env.LOG_LEVEL ?? "").toLowerCase();
  return v === "debug" || v === "info" || v === "warn" || v === "error" ? v : process.env.NODE_ENV === "production" ? "info" : "debug";
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (value instanceof Error) {
    return { name: value.name, message: value.message, ...(process.env.NODE_ENV !== "production" ? { stack: value.stack } : {}) };
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = SENSITIVE.test(k) ? "[redacted]" : redact(v, depth + 1);
  return out;
}

function emit(level: Level, scope: string, msg: string, fields?: Record<string, unknown>) {
  if (ORDER[level] < ORDER[minLevel()]) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    service: "apex-grid",
    env: process.env.NODE_ENV ?? "development",
    scope,
    msg,
    ...(fields ? (redact(fields) as Record<string, unknown>) : {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export type Logger = {
  debug: (msg: string, f?: Record<string, unknown>) => void;
  info: (msg: string, f?: Record<string, unknown>) => void;
  warn: (msg: string, f?: Record<string, unknown>) => void;
  error: (msg: string, f?: Record<string, unknown>) => void;
  child: (fields: Record<string, unknown>) => Logger;
};

export function logger(scope: string, base: Record<string, unknown> = {}): Logger {
  const mk = (level: Level) => (msg: string, f?: Record<string, unknown>) => emit(level, scope, msg, { ...base, ...f });
  return {
    debug: mk("debug"),
    info: mk("info"),
    warn: mk("warn"),
    error: mk("error"),
    child: (fields) => logger(scope, { ...base, ...fields }),
  };
}

/** Identificador curto para correlacionar logs de uma mesma execução/requisição. */
export function newRequestId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
