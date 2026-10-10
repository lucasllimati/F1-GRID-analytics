import { AnthropicEditorialAI, type EditorialAI } from "./ai";
import { OpenAICompatibleEditorialAI } from "./ai-openai";

// Escolhe o provedor de IA a partir da configuração. Nunca lança: devolve o motivo
// quando a IA não está disponível, e o pipeline segue apenas monitorando.

export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
export const GEMINI_DEFAULT_MODEL = "gemini-3.8-flash";

export type AiConfig = {
  NEWS_AI_PROVIDER: "anthropic" | "gemini" | "openai_compatible";
  NEWS_AI_MODEL: string;
  ANTHROPIC_API_KEY: string;
  GEMINI_API_KEY: string;
  NEWS_AI_BASE_URL: string;
  NEWS_AI_API_KEY: string;
};

export type AiSelection =
  | { ai: EditorialAI; provider: string; model: string; reason?: undefined }
  | { ai: null; provider: string; model: string; reason: string };

/** Nomes de modelo são curtos e simples (ex.: gemini-3.8-flash, qwen2.5:14b, meta-llama/x). */
export function looksLikeModelName(s: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:\/-]{0,79}$/.test(s) && !/^(AIza|AQ\.|sk-|gsk_)/.test(s);
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
  switch (c.NEWS_AI_PROVIDER) {
    case "gemini": {
      const model = c.NEWS_AI_MODEL && !c.NEWS_AI_MODEL.startsWith("claude") ? c.NEWS_AI_MODEL : GEMINI_DEFAULT_MODEL;
      if (!c.GEMINI_API_KEY) return { ai: null, provider: "gemini", model, reason: "GEMINI_API_KEY ausente" };
      return {
        ai: new OpenAICompatibleEditorialAI({ baseUrl: GEMINI_BASE_URL, apiKey: c.GEMINI_API_KEY, model, label: "gemini" }),
        provider: "gemini",
        model,
      };
    }
    case "openai_compatible": {
      if (!c.NEWS_AI_BASE_URL) return { ai: null, provider: "openai_compatible", model: c.NEWS_AI_MODEL, reason: "NEWS_AI_BASE_URL ausente" };
      try {
        return {
          ai: new OpenAICompatibleEditorialAI({ baseUrl: c.NEWS_AI_BASE_URL, apiKey: c.NEWS_AI_API_KEY, model: c.NEWS_AI_MODEL, label: "openai_compatible" }),
          provider: "openai_compatible",
          model: c.NEWS_AI_MODEL,
        };
      } catch (err) {
        return { ai: null, provider: "openai_compatible", model: c.NEWS_AI_MODEL, reason: err instanceof Error ? err.message : "configuração inválida" };
      }
    }
    default: {
      const model = c.NEWS_AI_MODEL || "claude-opus-5-5";
      if (!c.ANTHROPIC_API_KEY) return { ai: null, provider: "anthropic", model, reason: "ANTHROPIC_API_KEY ausente" };
      return { ai: new AnthropicEditorialAI(c.ANTHROPIC_API_KEY, model), provider: "anthropic", model };
    }
  }
}
