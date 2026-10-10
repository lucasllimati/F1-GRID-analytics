import { z } from "zod";

// Estados explícitos do ciclo de vida de um artigo e transições permitidas.

export const ARTICLE_STATUSES = [
  "drafting",
  "fact_checking",
  "in_review",
  "approved",
  "published",
  "rejected",
  "failed",
  "retracted",
] as const;

export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];
export const zArticleStatus = z.enum(ARTICLE_STATUSES);

export const ARTICLE_STATUS_LABEL: Record<ArticleStatus, string> = {
  drafting: "Em redação",
  fact_checking: "Em checagem",
  in_review: "Aguardando revisão humana",
  approved: "Aprovado",
  published: "Publicado",
  rejected: "Rejeitado",
  failed: "Falhou",
  retracted: "Despublicado (correção)",
};

const TRANSITIONS: Record<ArticleStatus, ArticleStatus[]> = {
  drafting: ["fact_checking", "failed", "in_review"],
  fact_checking: ["in_review", "published", "failed"],
  in_review: ["approved", "published", "rejected", "in_review"],
  approved: ["published", "in_review", "rejected"],
  published: ["retracted", "published"],
  rejected: ["in_review"],
  failed: ["in_review"],
  retracted: ["in_review"],
};

export function canTransition(from: ArticleStatus, to: ArticleStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export const CATEGORIES = [
  "corrida",
  "classificacao",
  "pilotos",
  "equipes",
  "mercado",
  "tecnica",
  "regulamento",
  "calendario",
  "negocios",
  "outros",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  corrida: "Corrida",
  classificacao: "Classificação",
  pilotos: "Pilotos",
  equipes: "Equipes",
  mercado: "Mercado",
  tecnica: "Técnica",
  regulamento: "Regulamento",
  calendario: "Calendário",
  negocios: "Negócios",
  outros: "Geral",
};

export function categoryLabel(c: string): string {
  return (CATEGORY_LABEL as Record<string, string>)[c] ?? "Geral";
}

export type PublishMode = "manual" | "semi" | "auto_restricted";
