import { describe, expect, it, vi } from "vitest";
import { createEditorialAI, GEMINI_BASE_URL, GEMINI_DEFAULT_MODEL } from "@/lib/news/ai-factory";
import { extractJson, OpenAICompatibleEditorialAI } from "@/lib/news/ai-openai";
import type { PromptSource } from "@/lib/news/prompts";

const SOURCES: PromptSource[] = [
  { id: "S1", publisher: "BBC Sport", url: "https://www.bbc.com/x", publishedAt: "2026-10-10T10:00:00Z", language: "en", title: "T", summary: "S", excerpt: null },
];

const DRAFT = {
  skip: false,
  skipReason: "",
  headline: "Título",
  dek: "Linha fina",
  category: "corrida",
  body: "Corpo",
  claims: [{ text: "Fato", sourceIds: ["S1"] }],
  usedSourceIds: ["S1"],
  sensitiveTopics: [],
};

function ok(content: string) {
  return new Response(
    JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }], usage: { prompt_tokens: 100, completion_tokens: 50 } }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function make(fetchImpl: typeof fetch) {
  return new OpenAICompatibleEditorialAI({
    baseUrl: GEMINI_BASE_URL,
    apiKey: "test-key",
    model: "gemini-test",
    label: "gemini",
    fetchImpl,
    sleep: async () => {},
  });
}

describe("extração de JSON", () => {
  it("aceita JSON puro, com cerca ```json e com texto ao redor", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Aqui está: {"a":1} pronto')).toEqual({ a: 1 });
    expect(() => extractJson("sem json")).toThrow();
  });
});

describe("adaptador compatível com OpenAI (Gemini)", () => {
  it("envia para o endpoint correto com chave e esquema, e valida a saída", async () => {
    const f = vi.fn(async () => ok(JSON.stringify(DRAFT)));
    const r = await make(f as unknown as typeof fetch).write(SOURCES);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.headline).toBe("Título");
    expect(r.usage).toMatchObject({ inputTokens: 100, outputTokens: 50, costUsd: 0 });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("gemini-test");
    expect(body.response_format.type).toBe("json_schema");
    expect(body.messages[0].content).toContain("JSON Schema");
  });

  it("cai para json_object quando o provedor rejeita json_schema", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response("unsupported", { status: 400 }))
      .mockResolvedValueOnce(ok("```json\n" + JSON.stringify(DRAFT) + "\n```"));
    const r = await make(f as unknown as typeof fetch).write(SOURCES);
    expect(r.ok).toBe(true);
    expect(JSON.parse(String((f.mock.calls[1] as [string, RequestInit])[1].body)).response_format).toEqual({ type: "json_object" });
  });

  it("espera e tenta de novo quando atinge o limite do plano gratuito (429)", async () => {
    const sleep = vi.fn(async () => {});
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response("rate", { status: 429, headers: { "retry-after": "7" } }))
      .mockResolvedValueOnce(ok(JSON.stringify(DRAFT)));
    const ai = new OpenAICompatibleEditorialAI({ baseUrl: GEMINI_BASE_URL, apiKey: "k", model: "m", label: "gemini", fetchImpl: f as unknown as typeof fetch, sleep });
    expect((await ai.write(SOURCES)).ok).toBe(true);
    expect(sleep).toHaveBeenCalledWith(7000);
  });

  it("chave inválida vira erro claro, sem novas tentativas", async () => {
    const f = vi.fn(async () => new Response("bad key", { status: 403 }));
    const r = await make(f as unknown as typeof fetch).write(SOURCES);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Chave da API inválida/);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("rejeita saída fora do esquema após as tentativas", async () => {
    const f = vi.fn(async () => ok(JSON.stringify({ ...DRAFT, category: "inventada" })));
    const r = await make(f as unknown as typeof fetch).write(SOURCES);
    expect(r.ok).toBe(false);
    expect(f).toHaveBeenCalledTimes(4);
  });

  it("resposta truncada não é aceita", async () => {
    const f = vi.fn(
      async () => new Response(JSON.stringify({ choices: [{ message: { content: "{" }, finish_reason: "length" }] }), { status: 200 }),
    );
    const r = await make(f as unknown as typeof fetch).factCheck(SOURCES, { headline: "h", dek: "d", body: "b" });
    expect(r.ok).toBe(false);
  });

  it("exige HTTPS fora de localhost", () => {
    expect(() => new OpenAICompatibleEditorialAI({ baseUrl: "http://exemplo.com/v1", apiKey: "", model: "m", label: "x" })).toThrow();
    expect(() => new OpenAICompatibleEditorialAI({ baseUrl: "http://localhost:11434/v1", apiKey: "", model: "m", label: "x" })).not.toThrow();
  });
});

describe("escolha do provedor", () => {
  const base = { NEWS_AI_MODEL: "", ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "", NEWS_AI_BASE_URL: "", NEWS_AI_API_KEY: "" };
  it("Gemini sem chave fica desativado com motivo", () => {
    const s = createEditorialAI({ ...base, NEWS_AI_PROVIDER: "gemini" });
    expect(s.ai).toBeNull();
    expect(s.reason).toMatch(/GEMINI_API_KEY/);
  });
  it("Gemini com chave usa o modelo padrão gratuito", () => {
    const s = createEditorialAI({ ...base, NEWS_AI_PROVIDER: "gemini", GEMINI_API_KEY: "k" });
    expect(s.ai).not.toBeNull();
    expect(s.model).toBe(GEMINI_DEFAULT_MODEL);
  });
  it("Anthropic continua disponível", () => {
    const s = createEditorialAI({ ...base, NEWS_AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" });
    expect(s.provider).toBe("anthropic");
    expect(s.model).toBe("claude-opus-5-5");
  });
});

describe("proteção contra chave no campo errado", () => {
  const base = { ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "", NEWS_AI_BASE_URL: "", NEWS_AI_API_KEY: "" };
  it("recusa NEWS_AI_MODEL com cara de chave e não expõe o valor", () => {
    const s = createEditorialAI({ ...base, NEWS_AI_PROVIDER: "gemini", NEWS_AI_MODEL: "AQ.FAKE_valor_de_teste_123" });
    expect(s.ai).toBeNull();
    expect(s.model).toBe("(inválido)");
    expect(JSON.stringify(s)).not.toContain("FAKE_valor");
  });
  it("aceita nomes de modelo comuns", () => {
    for (const m of ["gemini-3.8-flash", "qwen2.5:14b", "meta-llama/llama-4-scout:free"]) {
      expect(createEditorialAI({ ...base, NEWS_AI_PROVIDER: "openai_compatible", NEWS_AI_BASE_URL: "http://localhost:11434/v1", NEWS_AI_MODEL: m }).ai).not.toBeNull();
    }
  });
});

describe("falhas de rede", () => {
  it("tenta de novo após erro de conexão e informa a causa se persistir", async () => {
    const netErr = Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } });
    const flaky = vi.fn().mockRejectedValueOnce(netErr).mockResolvedValueOnce(ok(JSON.stringify(DRAFT)));
    expect((await make(flaky as unknown as typeof fetch).write(SOURCES)).ok).toBe(true);

    const dead = vi.fn(async () => {
      throw netErr;
    });
    const r = await make(dead as unknown as typeof fetch).write(SOURCES);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/ECONNRESET/);
    expect(dead).toHaveBeenCalledTimes(4);
  });
});
