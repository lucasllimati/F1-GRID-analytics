import { logger } from "../log";
import { TRANSIENT_FAILURES, type AgentResult, type Draft, type EditorialAI, type FactCheck, type FailureKind, type PingResult, type Usage } from "./ai";
import type { PromptSource } from "./prompts";

// Cadeia de reserva de provedores de IA. Cada provedor usa a SUA própria chave e cota
// (ex.: Gemini 3.8 Flash → Gemini 3.6 Flash → Gemini 3.5 Flash-Lite → OpenRouter gratuito).
// Quando um falha, a mesma tarefa vai para o próximo — o texto continua passando pela
// mesma checagem de fatos e pelas mesmas regras editoriais, qualquer que seja o modelo.

export type ChainLink = { name: string; ai: EditorialAI };

/** Falhas que tiram o provedor da cadeia até o fim do ciclo (insistir não adianta). */
const DISABLE_FOR_CYCLE: FailureKind[] = ["quota", "auth"];

export class FallbackEditorialAI implements EditorialAI {
  private readonly disabled = new Map<string, string>(); // nome → motivo
  private readonly log = logger("news.ai-chain");

  constructor(private readonly links: ChainLink[]) {
    if (links.length === 0) throw new Error("Cadeia de IA vazia");
  }

  /** Nomes na ordem, para exibição ("gemini-3.8-flash → gemini-3.6-flash → …"). */
  get description(): string {
    return this.links.map((l) => l.name).join(" → ");
  }

  /** Provedores ainda disponíveis neste ciclo. */
  get available(): string[] {
    return this.links.filter((l) => !this.disabled.has(l.name)).map((l) => l.name);
  }

  private async run<T>(task: string, fn: (ai: EditorialAI) => Promise<AgentResult<T>>): Promise<AgentResult<T>> {
    const usage: Usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
    const failures: string[] = [];
    let lastKind: FailureKind = "unknown";
    let promptVersion = "";
    for (const link of this.links) {
      const off = this.disabled.get(link.name);
      if (off) {
        failures.push(`${link.name}: ${off}`);
        continue;
      }
      const r = await fn(link.ai);
      usage.inputTokens += r.usage.inputTokens;
      usage.outputTokens += r.usage.outputTokens;
      usage.costUsd += r.usage.costUsd;
      promptVersion = r.promptVersion;
      if (r.ok) {
        if (failures.length) this.log.info("reserva usada", { task, servedBy: link.name, skipped: failures });
        return { ...r, usage };
      }
      const kind = r.kind ?? "unknown";
      lastKind = kind;
      failures.push(`${link.name}: ${r.error}`);
      if (DISABLE_FOR_CYCLE.includes(kind)) this.disabled.set(link.name, kind === "quota" ? "cota esgotada" : "chave inválida");
      // Recusa e erro de formato também passam ao próximo: outro modelo pode responder corretamente.
      this.log.warn("provedor falhou, tentando o próximo", { task, provider: link.name, kind, error: r.error.slice(0, 200) });
    }
    // Todos falharam. Se ALGUM motivo foi transitório (ou provedor fora por cota), a IA está
    // indisponível no momento — o pipeline adia a pauta em vez de descartá-la.
    const anyTransient = failures.length > 0 && (TRANSIENT_FAILURES.includes(lastKind) || this.disabled.size > 0);
    return {
      ok: false,
      error: `Nenhum provedor disponível — ${failures.join(" · ")}`.slice(0, 900),
      refused: false,
      kind: anyTransient ? "quota" : lastKind,
      usage,
      model: this.description,
      promptVersion,
    };
  }

  write(sources: PromptSource[]): Promise<AgentResult<Draft>> {
    return this.run("write", (ai) => ai.write(sources));
  }

  factCheck(sources: PromptSource[], draft: Pick<Draft, "headline" | "dek" | "body">): Promise<AgentResult<FactCheck>> {
    return this.run("factCheck", (ai) => ai.factCheck(sources, draft));
  }

  /** Testa todos os provedores (npm run ai:check) e informa cada um. */
  async ping(): Promise<PingResult> {
    const lines: string[] = [];
    let anyOk = false;
    for (const l of this.links) {
      const r = await l.ai.ping();
      anyOk ||= r.ok;
      lines.push(`${r.ok ? "✅" : "❌"} ${l.name} — ${r.detail}`);
    }
    const detail = `\n   ${lines.join("\n   ")}`;
    return anyOk ? { ok: true, detail } : { ok: false, detail };
  }
}
