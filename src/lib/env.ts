import { z } from "zod";

// Leitura validada de variáveis de ambiente. Segredos nunca são enviados ao cliente
// (este módulo só é importado em código de servidor).

const schema = z.object({
  // Em produção na Vercel, sem SITE_URL configurado usamos o domínio de produção do projeto.
  SITE_URL: z
    .string()
    .url()
    .default(process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000"),
  SESSION_SECRET: z.string().default(""),
  CRON_SECRET: z.string().default(""),
  NEWS_AI_PROVIDER: z.enum(["anthropic", "gemini", "openai_compatible"]).default("anthropic"),
  NEWS_AI_MODEL: z.string().default(""),
  ANTHROPIC_API_KEY: z.string().default(""),
  GEMINI_API_KEY: z.string().default(""),
  NEWS_AI_BASE_URL: z.string().default(""),
  NEWS_AI_API_KEY: z.string().default(""),
  NEWS_PUBLISH_MODE: z.enum(["manual", "semi", "auto_restricted"]).default("semi"),
  NEWS_MAX_ARTICLES_PER_RUN: z.coerce.number().int().min(0).max(20).default(3),
  NEWS_MAX_ARTICLES_PER_DAY: z.coerce.number().int().min(0).max(200).default(24),
  // Opcional: o botão "Buscar e escrever notícias" dispara o GitHub Actions (sem limite de 5 min).
  GITHUB_REPOSITORY: z.string().default(""),
  GITHUB_DISPATCH_TOKEN: z.string().default(""),
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
