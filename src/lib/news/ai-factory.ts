import { AnthropicEditorialAI, type EditorialAI } from "./ai";
import { FallbackEditorialAI, type ChainLink } from "./ai-chain";
import { OpenAICompatibleEditorialAI } from "./ai-openai";

// Monta a IA da redação a partir da configuração: um provedor principal e, opcionalmente,
// uma cadeia de reserva (NEWS_AI_FALLBACKS). Nunca lança: devolve o motivo quando nenhuma
// IA está disponível, e o pipeline segue apenas monitorando.

export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
export const GEMINI_DEFAULT_MODEL = "gemini-3.8-flash";
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/";
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1/";

/**
 * Reserva padrão quando o principal é o Gemini e NEWS_AI_FALLBACKS não foi definido:
 * no plano gratuito do Google a cota é POR MODELO, então outros modelos Gemini continuam
 * disponíveis com a mesma chave quando o principal esgota.
 */
export const DEFAULT_GEMINI_FALLBACKS = ["gemini:gemini-3.6-flash", "gemini:gemini-3.5-flash-lite"];
/** Modelo gratuito do OpenRouter com saída estruturada (verificado em 2026-10-13). */
export const DEFAULT_OPENROUTER_FREE_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";

export type ProviderName = "anthropic" | "gemini" | "openai_compatible" | "openrouter" | "groq";

export type AiConfig = {
  NEWS_AI_PROVIDER: "anthropic" | "gemini" | "openai_compatible";
  NEWS_AI_MODEL: string;
  ANTHROPIC_API_KEY: string;
  GEMINI_API_KEY: string;
  NEWS_AI_BASE_URL: string;
  NEWS_AI_API_KEY: string;
  /** Lista "provedor:modelo" separada por vírgula, em ordem. "none" desliga a reserva. */
  NEWS_AI_FALLBACKS?: string;
  OPENROUTER_API_KEY?: string;
  GROQ_API_KEY?: string;
};

export type AiSelection =
  | { ai: EditorialAI; provider: string; model: string; reason?: undefined; skipped?: string[] }
  | { ai: null; provider: string; model: string; reason: string; skipped?: string[] };

/** Nomes de modelo são curtos e simples (ex.: gemini-3.8-flash, qwen2.5:14b, meta-llama/x:free). */
export function looksLikeModelName(s: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:\/-]{0,79}$/.test(s) && !/^(AIza|AQ\.|sk-|gsk_)/.test(s);
}

type Spec = { provider: ProviderName; model: string };

/** "openrouter:nvidia/x:free" → { provider: "openrouter", model: "nvidia/x:free" } (o modelo pode conter ":"). */
export function parseSpecs(list: string): { specs: Spec[]; invalid: string[] } {
  const specs: Spec[] = [];
  const invalid: string[] = [];
  const KNOWN: ProviderName[] = ["anthropic", "gemini", "openai_compatible", "openrouter", "groq"];
  for (const [pos, raw] of list.split(",").map((s) => s.trim()).filter(Boolean).entries()) {
    const i = raw.indexOf(":");
    const provider = (i > 0 ? raw.slice(0, i) : raw) as ProviderName;
    const model = i > 0 ? raw.slice(i + 1) : "";
    if (!KNOWN.includes(provider) || (model && !looksLikeModelName(model))) {
      // Nunca ecoa o texto digitado: pode ser uma chave colada no campo errado.
      invalid.push(KNOWN.includes(provider) ? `${provider}, item ${pos + 1}` : `item ${pos + 1}`);
      continue;
    }
    specs.push({ provider, model });
  }
  return { specs, invalid };
}

/** Cria o elo da cadeia, ou devolve o motivo de não poder (ex.: chave ausente). */
function buildLink(s: Spec, c: AiConfig, chained: boolean): { link: ChainLink } | { skip: string } {
  // Em cadeia, trocar de provedor é melhor do que esperar: tentativas e esperas curtas.
  const quick = chained ? { maxRetries: 1, maxBackoffMs: 10_000 } : {};
  switch (s.provider) {
    case "gemini": {
      const model = s.model || GEMINI_DEFAULT_MODEL;
      if (!c.GEMINI_API_KEY) return { skip: `${model}: GEMINI_API_KEY ausente` };
      return { link: { name: model, ai: new OpenAICompatibleEditorialAI({ baseUrl: GEMINI_BASE_URL, apiKey: c.GEMINI_API_KEY, model, label: "gemini", ...quick }) } };
    }
    case "openrouter": {
      const model = s.model || DEFAULT_OPENROUTER_FREE_MODEL;
      if (!c.OPENROUTER_API_KEY) return { skip: `openrouter ${model}: OPENROUTER_API_KEY ausente` };
      return {
        link: { name: `openrouter ${model}`, ai: new OpenAICompatibleEditorialAI({ baseUrl: OPENROUTER_BASE_URL, apiKey: c.OPENROUTER_API_KEY, model, label: "openrouter", ...quick }) },
      };
    }
    case "groq": {
      if (!s.model) return { skip: "groq: informe o modelo (ex.: groq:NOME_DO_MODELO)" };
      if (!c.GROQ_API_KEY) return { skip: `groq ${s.model}: GROQ_API_KEY ausente` };
      return { link: { name: `groq ${s.model}`, ai: new OpenAICompatibleEditorialAI({ baseUrl: GROQ_BASE_URL, apiKey: c.GROQ_API_KEY, model: s.model, label: "groq", ...quick }) } };
    }
    case "openai_compatible": {
      if (!c.NEWS_AI_BASE_URL) return { skip: "openai_compatible: NEWS_AI_BASE_URL ausente" };
      const model = s.model || c.NEWS_AI_MODEL;
      try {
        return { link: { name: model, ai: new OpenAICompatibleEditorialAI({ baseUrl: c.NEWS_AI_BASE_URL, apiKey: c.NEWS_AI_API_KEY, model, label: "openai_compatible", ...quick }) } };
      } catch (err) {
        return { skip: `openai_compatible: ${err instanceof Error ? err.message : "configuração inválida"}` };
      }
    }
    case "anthropic": {
      const model = s.model || "claude-opus-5-5";
      if (!c.ANTHROPIC_API_KEY) return { skip: `${model}: ANTHROPIC_API_KEY ausente` };
      return { link: { name: model, ai: new AnthropicEditorialAI(c.ANTHROPIC_API_KEY, model) } };
    }
  }
}

export function createEditorialAI(c: AiConfig): AiSelection {
  if (c.NEWS_AI_MODEL && !looksLikeModelName(c.NEWS_AI_MODEL)) {
    // Nunca devolvemos o valor: pode ser uma chave colada no campo errado.
    return {
      ai: null,
      provider: c.NEWS_AI_PROVIDER,
      model: "(inválido)",
      reason: "NEWS_AI_MODEL não parece um nome de modelo (colou a chave no campo errado? ela vai em GEMINI_API_KEY)",
    };
  }

  const primaryModel =
    c.NEWS_AI_PROVIDER === "gemini"
      ? c.NEWS_AI_MODEL && !c.NEWS_AI_MODEL.startsWith("claude")
        ? c.NEWS_AI_MODEL
        : GEMINI_DEFAULT_MODEL
      : c.NEWS_AI_PROVIDER === "anthropic"
        ? c.NEWS_AI_MODEL || "claude-opus-5-5"
        : c.NEWS_AI_MODEL;
  const specs: Spec[] = [{ provider: c.NEWS_AI_PROVIDER, model: primaryModel }];

  const fb = (c.NEWS_AI_FALLBACKS ?? "").trim();
  const skipped: string[] = [];
  if (fb.toLowerCase() !== "none") {
    const list = fb || (c.NEWS_AI_PROVIDER === "gemini" ? DEFAULT_GEMINI_FALLBACKS.join(",") : "");
    const parsed = parseSpecs(list);
    specs.push(...parsed.specs);
    for (const p of parsed.invalid) skipped.push(`entrada inválida em NEWS_AI_FALLBACKS (${p})`);
    // Com chave do OpenRouter e reserva padrão, inclui um modelo gratuito de outra empresa no fim.
    if (!fb && c.OPENROUTER_API_KEY) specs.push({ provider: "openrouter", model: DEFAULT_OPENROUTER_FREE_MODEL });
  }

  const chained = specs.length > 1;
  const links: ChainLink[] = [];
  for (const s of specs) {
    const r = buildLink(s, c, chained);
    if ("skip" in r) skipped.push(r.skip);
    else if (!links.some((l) => l.name === r.link.name)) links.push(r.link);
  }

  if (links.length === 0) {
    const reason =
      c.NEWS_AI_PROVIDER === "gemini"
        ? "GEMINI_API_KEY ausente"
        : c.NEWS_AI_PROVIDER === "anthropic"
          ? "ANTHROPIC_API_KEY ausente"
          : (skipped[0] ?? "nenhuma IA configurada");
    return { ai: null, provider: c.NEWS_AI_PROVIDER, model: primaryModel || "(nenhum)", reason, skipped };
  }
  if (links.length === 1) return { ai: links[0]!.ai, provider: c.NEWS_AI_PROVIDER, model: links[0]!.name, skipped };
  const chain = new FallbackEditorialAI(links);
  return { ai: chain, provider: c.NEWS_AI_PROVIDER, model: chain.description, skipped };
}
