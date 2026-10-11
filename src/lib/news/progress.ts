import type { PrismaClient } from "@prisma/client";

// Progresso de um ciclo de notícias, por etapa, gravado em IngestionRun.progress (JSON)
// para que o painel acompanhe execuções iniciadas pelo painel, pelo cron ou pela CLI.

export type PhaseKey = "sources" | "cluster" | "writing";
export type PhaseStatus = "pending" | "running" | "done" | "skipped" | "error";

export type Phase = {
  key: PhaseKey;
  label: string;
  status: PhaseStatus;
  done: number;
  total: number;
  detail: string;
};

export type RunProgress = { phases: Phase[]; updatedAt: string; label?: string };

export const PHASE_LABEL: Record<PhaseKey, string> = {
  sources: "Coleta das fontes",
  cluster: "Agrupamento em pautas",
  writing: "Redação e checagem das matérias",
};

/** Passos de cada matéria — permite progresso fino dentro da etapa de redação. */
export const WRITING_STEPS = ["apuração", "redação", "checagem de fatos", "decisão"] as const;

export function emptyProgress(): RunProgress {
  return {
    phases: (Object.keys(PHASE_LABEL) as PhaseKey[]).map((key) => ({ key, label: PHASE_LABEL[key], status: "pending", done: 0, total: 0, detail: "" })),
    updatedAt: new Date().toISOString(),
  };
}

export function parseProgress(raw: string | null | undefined): RunProgress | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<RunProgress>;
    return Array.isArray(p.phases) && p.phases.length ? (p as RunProgress) : null;
  } catch {
    return null;
  }
}

/** "42 s", "3 min 05 s", "1 h 12 min". */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h} h ${m % 60} min`;
  if (m > 0) return `${m} min ${String(s % 60).padStart(2, "0")} s`;
  return `${s} s`;
}

/** Fração concluída de uma etapa (0–1). Etapas puladas contam como concluídas. */
export function phaseFraction(p: Phase): number {
  if (p.status === "done" || p.status === "skipped") return 1;
  if (p.status === "pending") return 0;
  return p.total > 0 ? Math.min(1, p.done / p.total) : 0;
}

/** Progresso geral ponderado: coleta 30%, agrupamento 10%, redação 60%. */
export function overallFraction(progress: RunProgress): number {
  const weight: Record<PhaseKey, number> = { sources: 0.3, cluster: 0.1, writing: 0.6 };
  let total = 0;
  let w = 0;
  for (const p of progress.phases) {
    const pw = weight[p.key] ?? 0;
    w += pw;
    total += pw * phaseFraction(p);
  }
  return w ? total / w : 0;
}

/**
 * Atualiza o progresso em memória e grava no banco com limite de frequência
 * (no máximo a cada `minIntervalMs`, salvo mudanças de estado de etapa, que gravam na hora).
 */
export class ProgressReporter {
  private state = emptyProgress();
  private lastWrite = 0;
  private pending: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly db: PrismaClient | null,
    private readonly runId: string | null,
    private readonly minIntervalMs = 700,
  ) {}

  get snapshot(): RunProgress {
    return this.state;
  }

  /** Nome legível da execução (ex.: "Buscar e escrever notícias"). */
  setLabel(label: string) {
    this.state.label = label;
    this.flush(true);
  }

  update(key: PhaseKey, patch: Partial<Omit<Phase, "key" | "label">>) {
    const phase = this.state.phases.find((p) => p.key === key)!;
    const statusChanged = patch.status !== undefined && patch.status !== phase.status;
    Object.assign(phase, patch);
    this.state.updatedAt = new Date().toISOString();
    this.flush(statusChanged);
  }

  increment(key: PhaseKey, detail?: string) {
    const phase = this.state.phases.find((p) => p.key === key)!;
    this.update(key, { done: phase.done + 1, ...(detail !== undefined ? { detail } : {}) });
  }

  private flush(force: boolean) {
    if (!this.db || !this.runId) return;
    const now = Date.now();
    if (!force && now - this.lastWrite < this.minIntervalMs) return;
    this.lastWrite = now;
    const json = JSON.stringify(this.state);
    const db = this.db;
    const id = this.runId;
    // Serializa as gravações; falha ao gravar progresso nunca derruba o ciclo.
    this.pending = this.pending.then(() => db.ingestionRun.update({ where: { id }, data: { progress: json } }).catch(() => undefined));
  }

  /** Grava o estado final (sempre) e espera as gravações pendentes. */
  async finish() {
    this.flush(true);
    await this.pending;
  }
}
