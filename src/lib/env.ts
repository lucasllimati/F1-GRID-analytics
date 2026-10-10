import { z } from "zod";

// Leitura validada de variáveis de ambiente. Segredos nunca são enviados ao cliente
// (este módulo só é importado em código de servidor).

const schema = z.object({
  SITE_URL: z.string().url().default("http://localhost:3000"),
  SESSION_SECRET: z.string().default(""),
  CRON_SECRET: z.string().default(""),
  ANTHROPIC_API_KEY: z.string().default(""),
  NEWS_AI_MODEL: z.string().default("claude-opus-5-5"),
  NEWS_PUBLISH_MODE: z.enum(["manual", "semi", "auto_restricted"]).default("semi"),
  NEWS_MAX_ARTICLES_PER_RUN: z.coerce.number().int().min(0).max(20).default(3),
  NEWS_MAX_ARTICLES_PER_DAY: z.coerce.number().int().min(0).max(200).default(24),
  NEWS_FETCH_FULLTEXT: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Configuração inválida: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  }
  cached = parsed.data;
  return cached;
}

export function siteUrl(path = ""): string {
  return `${env().SITE_URL.replace(/\/$/, "")}${path}`;
}
