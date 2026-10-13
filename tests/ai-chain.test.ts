import { describe, expect, it } from "vitest";
import type { AgentResult, Draft, EditorialAI, FactCheck, FailureKind } from "@/lib/news/ai";
import { FallbackEditorialAI } from "@/lib/news/ai-chain";
import { createEditorialAI, parseSpecs } from "@/lib/news/ai-factory";
import { classifyHttp } from "@/lib/news/ai-openai";

const usage = { inputTokens: 1, outputTokens: 1, costUsd: 0 };
const DRAFT = { skip: false, skipReason: "", headline: "h", dek: "d", category: "outros", body: "b", claims: [], usedSourceIds: [], sensitiveTopics: [] } as unknown as Draft;

/** Provedor falso: devolve a sequência de resultados configurada e conta chamadas. */
class FakeProvider implements EditorialAI {
  calls = 0;
  constructor(private readonly outcomes: (FailureKind | "ok")[]) {}
  private next(): AgentResult<Draft> {
    const o = this.outcomes[Math.min(this.calls++, this.outcomes.length - 1)]!;
    return o === "ok"
      ? { ok: true, data: DRAFT, usage, model: "fake", promptVersion: "t" }
      : { ok: false, error: `falhou: ${o}`, refused: o === "refused", kind: o, usage, model: "fake", promptVersion: "t" };
  }
  async write() {
    return this.next();
  }
  async factCheck() {
    return this.next() as unknown as AgentResult<FactCheck>;
  }
  async ping() {
    return { ok: true as const, detail: "fake" };
  }
}

describe("cadeia de reserva de IA", () => {
  it("passa ao próximo provedor quando o primeiro esgota a cota, e o pula no resto do ciclo", async () => {
    const a = new FakeProvider(["quota"]);
    const b = new FakeProvider(["ok"]);
    const chain = new FallbackEditorialAI([{ name: "a", ai: a }, { name: "b", ai: b }]);
    expect((await chain.write([])).ok).toBe(true);
    expect((await chain.write([])).ok).toBe(true);
    expect(a.calls).toBe(1); // não insiste num provedor sem cota
    expect(b.calls).toBe(2);
    expect(chain.available).toEqual(["b"]);
  });

  it("sobrecarga e rede passam ao próximo sem desativar o provedor", async () => {
    const a = new FakeProvider(["overloaded", "ok"]);
    const b = new FakeProvider(["ok"]);
    const chain = new FallbackEditorialAI([{ name: "a", ai: a }, { name: "b", ai: b }]);
    await chain.write([]);
    const second = await chain.write([]);
    expect(second.ok).toBe(true);
    expect(a.calls).toBe(2); // voltou a tentar o primeiro
  });

  it("todos indisponíveis → falha transitória (o pipeline adia a pauta), com o motivo de cada um", async () => {
    const chain = new FallbackEditorialAI([
      { name: "a", ai: new FakeProvider(["quota"]) },
      { name: "b", ai: new FakeProvider(["rate_limit"]) },
    ]);
    const r = await chain.write([]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe("quota");
      expect(r.error).toContain("a: falhou: quota");
      expect(r.error).toContain("b: falhou: rate_limit");
    }
  });

  it("formato inválido em todos → falha definitiva (não fica adiando para sempre)", async () => {
    const chain = new FallbackEditorialAI([
      { name: "a", ai: new FakeProvider(["invalid_output"]) },
      { name: "b", ai: new FakeProvider(["invalid_output"]) },
    ]);
    const r = await chain.write([]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("invalid_output");
  });

  it("chave inválida desativa o provedor", async () => {
    const a = new FakeProvider(["auth"]);
    const chain = new FallbackEditorialAI([{ name: "a", ai: a }, { name: "b", ai: new FakeProvider(["ok"]) }]);
    await chain.write([]);
    await chain.factCheck([], { headline: "", dek: "", body: "" });
    expect(a.calls).toBe(1);
  });
});

describe("classificação de erros dos provedores", () => {
  it("diferencia cota diária de limite por minuto", () => {
    expect(classifyHttp(429, "Quota exceeded for metric: generate_content_free_tier_requests, limit: 20 ... PerDay")).toBe("quota");
    expect(classifyHttp(429, "Rate limit exceeded: free-models-per-day")).toBe("quota");
    expect(classifyHttp(429, "Resource has been exhausted (e.g. check quota). per minute")).toBe("rate_limit");
    expect(classifyHttp(402, "Insufficient credits")).toBe("quota");
    expect(classifyHttp(503, "high demand")).toBe("overloaded");
    expect(classifyHttp(401, "")).toBe("auth");
  });
});

describe("configuração da cadeia", () => {
  const base = { NEWS_AI_MODEL: "", ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "g", NEWS_AI_BASE_URL: "", NEWS_AI_API_KEY: "" };

  it("aceita modelos do OpenRouter com ':' no nome", () => {
    const { specs, invalid } = parseSpecs("gemini:gemini-3.6-flash, openrouter:nvidia/nemotron-3-super-120b-a12b:free");
    expect(invalid).toEqual([]);
    expect(specs[1]).toEqual({ provider: "openrouter", model: "nvidia/nemotron-3-super-120b-a12b:free" });
  });

  it("com chave do OpenRouter, a reserva padrão termina num modelo gratuito de outra empresa", () => {
    const s = createEditorialAI({ ...base, NEWS_AI_PROVIDER: "gemini", OPENROUTER_API_KEY: "or" });
    expect(s.model).toBe("gemini-3.8-flash → gemini-3.6-flash → gemini-3.5-flash-lite → openrouter nvidia/nemotron-3-super-120b-a12b:free");
  });

  it("provedores sem chave são pulados e listados, sem quebrar a cadeia", () => {
    const s = createEditorialAI({ ...base, NEWS_AI_PROVIDER: "gemini", NEWS_AI_FALLBACKS: "groq:modelo-x, openrouter:m:free" });
    expect(s.model).toBe("gemini-3.8-flash");
    expect(s.skipped?.join(" ")).toMatch(/GROQ_API_KEY ausente.*OPENROUTER_API_KEY ausente/);
  });

  it("entrada inválida não ecoa o valor (pode ser uma chave colada errado)", () => {
    const s = createEditorialAI({ ...base, NEWS_AI_PROVIDER: "gemini", NEWS_AI_FALLBACKS: "AQ.FAKE_chave_colada_errado" });
    expect(JSON.stringify(s.skipped)).not.toContain("FAKE_chave");
  });
});
