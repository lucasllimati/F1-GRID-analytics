// Chamadas resilientes a APIs externas: tentativas limitadas com backoff exponencial + jitter
// e disjuntor (circuit breaker) para não martelar uma fonte que está fora do ar.

export class CircuitOpenError extends Error {
  constructor(readonly name_: string, readonly retryInMs: number) {
    super(`Fonte ${name_} temporariamente suspensa após falhas seguidas (nova tentativa em ${Math.ceil(retryInMs / 1000)}s).`);
  }
}

export class RetryableHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Espera pedida pela fonte (cabeçalho Retry-After), em ms. */
    readonly retryAfterMs: number | null = null,
  ) {
    super(message);
  }
}

type BreakerState = { failures: number; openedAt: number | null };

export class CircuitBreaker {
  private state: BreakerState = { failures: 0, openedAt: null };
  constructor(
    readonly name: string,
    private readonly threshold = 5,
    private readonly cooldownMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  /** Lança CircuitOpenError enquanto o disjuntor estiver aberto (exceto a tentativa de teste após o cooldown). */
  guard() {
    if (this.state.openedAt === null) return;
    const elapsed = this.now() - this.state.openedAt;
    if (elapsed < this.cooldownMs) throw new CircuitOpenError(this.name, this.cooldownMs - elapsed);
    // meio-aberto: deixa passar uma tentativa; sucesso fecha, falha reabre.
  }
  success() {
    this.state = { failures: 0, openedAt: null };
  }
  failure() {
    const failures = this.state.failures + 1;
    this.state = { failures, openedAt: failures >= this.threshold ? this.now() : this.state.openedAt };
  }
  snapshot() {
    return { name: this.name, ...this.state, open: this.state.openedAt !== null && this.now() - this.state.openedAt < this.cooldownMs };
  }
}

export type RetryOptions = {
  retries: number; // tentativas EXTRAS (total = retries + 1)
  baseDelayMs: number;
  maxDelayMs: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  onRetry?: (attempt: number, err: unknown, delayMs: number) => void;
};

/** Erros que valem nova tentativa: rede/timeout, 429 e 5xx. 4xx (exceto 429) não. */
export function isRetryable(err: unknown): boolean {
  if (err instanceof RetryableHttpError) return err.status === 429 || err.status >= 500;
  if (err instanceof CircuitOpenError) return false;
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError" || err.message === "fetch failed")) return true;
  return err instanceof TypeError;
}

export async function withRetry<T>(fn: () => Promise<T>, o: RetryOptions): Promise<T> {
  const sleep = o.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const random = o.random ?? Math.random;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= o.retries || !isRetryable(err)) throw err;
      // "Full jitter": espera aleatória entre 0 e o teto exponencial.
      const cap = Math.min(o.maxDelayMs, o.baseDelayMs * 2 ** attempt);
      const jittered = Math.round(cap / 2 + random() * (cap / 2));
      // Se a fonte disse quanto esperar (429 + Retry-After), respeita — com teto para não travar a página.
      const asked = err instanceof RetryableHttpError && err.retryAfterMs !== null ? Math.min(err.retryAfterMs, 10_000) : 0;
      const delay = Math.max(jittered, asked);
      o.onRetry?.(attempt + 1, err, delay);
      await sleep(delay);
      attempt++;
    }
  }
}

/**
 * Limitador de taxa simples: no máximo `concurrency` chamadas simultâneas e um intervalo
 * mínimo entre inícios. Respeita limites públicos de APIs (ex.: Jolpica ~4 req/s).
 */
export class RateLimiter {
  private active = 0;
  private lastStart = 0;
  private queue: (() => void)[] = [];
  constructor(
    private readonly concurrency: number,
    private readonly minIntervalMs: number,
  ) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await new Promise<void>((resolve) => {
      this.queue.push(resolve);
      this.pump();
    });
    try {
      return await fn();
    } finally {
      this.active--;
      this.pump();
    }
  }

  private pump() {
    if (this.active >= this.concurrency || this.queue.length === 0) return;
    const wait = Math.max(0, this.lastStart + this.minIntervalMs - Date.now());
    if (wait > 0) {
      setTimeout(() => this.pump(), wait);
      return;
    }
    const next = this.queue.shift()!;
    this.active++;
    this.lastStart = Date.now();
    next();
    this.pump();
  }
}
