import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { canTransition, type ArticleStatus } from "./states";
import { readingMinutes } from "./text";

// Ações editoriais humanas com controle de acesso (RBAC):
//  - editor: aprova/publica textos NÃO sensíveis, rejeita, edita, despublica.
//  - admin: tudo do editor + publica textos sensíveis + opera fontes e o pipeline.

export type Actor = { id: string; role: "editor" | "admin" };

export class EditorialError extends Error {}

async function load(db: PrismaClient, id: string) {
  const a = await db.article.findUnique({ where: { id }, include: { versions: { orderBy: { version: "desc" }, take: 1 } } });
  if (!a) throw new EditorialError("Artigo não encontrado.");
  return a;
}

function assertTransition(from: string, to: ArticleStatus) {
  if (!canTransition(from as ArticleStatus, to)) throw new EditorialError(`Transição inválida: ${from} → ${to}.`);
}

async function log(db: PrismaClient, actor: Actor, action: string, id: string, details: unknown = {}) {
  await db.auditLog.create({
    data: { actor: `user:${actor.id}`, action, entity: "article", entityId: id, details: JSON.stringify(details).slice(0, 8000) },
  });
}

export async function approveAndPublish(db: PrismaClient, actor: Actor, id: string) {
  const a = await load(db, id);
  if (a.sensitive && actor.role !== "admin") {
    throw new EditorialError("Tema sensível: somente um administrador pode publicar este texto.");
  }
  // "publicado → publicado" existe para edições; aprovar de novo não faz sentido (clique duplo).
  if (a.status === "published") throw new EditorialError("Esta matéria já está publicada.");
  assertTransition(a.status, "published");
  await db.article.update({
    where: { id },
    data: { status: "published", approvedById: actor.id, publishedAt: a.publishedAt ?? new Date() },
  });
  await log(db, actor, "article.approved_published", id, { previous: a.status });
}

export async function reject(db: PrismaClient, actor: Actor, id: string, reason: string) {
  const r = z.string().trim().min(3).max(500).safeParse(reason);
  if (!r.success) throw new EditorialError("Informe o motivo da rejeição (3–500 caracteres).");
  const a = await load(db, id);
  assertTransition(a.status, "rejected");
  await db.article.update({ where: { id }, data: { status: "rejected" } });
  await log(db, actor, "article.rejected", id, { reason: r.data });
}

export const zEdit = z.object({
  headline: z.string().trim().min(10).max(140),
  dek: z.string().trim().min(20).max(320),
  body: z.string().trim().min(200).max(20_000),
  note: z.string().trim().max(300).optional().default(""),
  correction: z.string().trim().max(500).optional().default(""),
});

export async function editArticle(db: PrismaClient, actor: Actor, id: string, input: z.input<typeof zEdit>) {
  const parsed = zEdit.safeParse(input);
  if (!parsed.success) throw new EditorialError("Campos inválidos: título 10–140, linha fina 20–320, corpo ≥ 200 caracteres.");
  const v = parsed.data;
  const a = await load(db, id);
  if (a.status === "published" && !v.correction && a.sensitive && actor.role !== "admin") {
    throw new EditorialError("Edição de texto sensível publicado exige administrador.");
  }
  const next = (a.versions[0]?.version ?? 0) + 1;
  await db.$transaction([
    db.articleVersion.create({
      data: { articleId: id, version: next, headline: v.headline, dek: v.dek, body: v.body, author: `user:${actor.id}`, note: v.note || null },
    }),
    db.article.update({
      where: { id },
      data: {
        headline: v.headline,
        dek: v.dek,
        body: v.body,
        readingMinutes: readingMinutes(v.body),
        ...(v.correction ? { correctionNote: v.correction } : {}),
      },
    }),
  ]);
  await log(db, actor, "article.edited", id, { version: next, note: v.note, correction: v.correction });
}

export async function retract(db: PrismaClient, actor: Actor, id: string, note: string) {
  const r = z.string().trim().min(10).max(500).safeParse(note);
  if (!r.success) throw new EditorialError("Explique publicamente o motivo da despublicação (10–500 caracteres).");
  const a = await load(db, id);
  assertTransition(a.status, "retracted");
  await db.article.update({ where: { id }, data: { status: "retracted", correctionNote: r.data } });
  await log(db, actor, "article.retracted", id, { note: r.data });
}

export async function reopen(db: PrismaClient, actor: Actor, id: string) {
  const a = await load(db, id);
  assertTransition(a.status, "in_review");
  await db.article.update({ where: { id }, data: { status: "in_review" } });
  await log(db, actor, "article.reopened", id, { previous: a.status });
}
