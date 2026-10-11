"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { clientIp, requireUser } from "@/lib/auth";
import { verifyPassword } from "@/lib/auth/password";
import { rateLimit, resetRateLimit } from "@/lib/auth/rate-limit";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { F1_CACHE_TAG } from "@/lib/f1/providers/jolpica";
import { approveAndPublish, editArticle, EditorialError, reject, reopen, retract } from "@/lib/news/editorial";
import { LOCK_MINUTES } from "@/lib/news/pipeline";
import { runConfiguredCycle } from "@/lib/news/run";

// Server Actions do Next verificam Origin x Host (proteção CSRF) e só aceitam POST.
// Cada ação revalida a sessão e o papel do usuário no servidor.

const zId = z.string().regex(/^[a-z0-9]{20,40}$/i);

function back(path: string, key: "ok" | "erro", msg: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(msg)}`);
}

export async function loginAction(formData: FormData) {
  const ip = await clientIp();
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  const limit = rateLimit(`login:${ip}`, 5, 15 * 60_000);
  if (!limit.ok) back("/admin/login", "erro", `Muitas tentativas. Tente em ${Math.ceil(limit.retryAfterSec / 60)} min.`);

  const user = await db.adminUser.findUnique({ where: { email } });
  // Mesmo custo de verificação com ou sem usuário (evita enumeração por tempo de resposta).
  const ok = verifyPassword(password, user?.passwordHash ?? "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==");
  if (!user || !user.active || !ok) {
    await audit(`ip:${ip}`, "auth.login_failed", "admin_user", null, { email });
    back("/admin/login", "erro", "Credenciais inválidas.");
  }
  resetRateLimit(`login:${ip}`);
  const role = user.role === "admin" ? "admin" : "editor";
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionToken({ uid: user.id, role }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  await db.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit(`user:${user.id}`, "auth.login", "admin_user", user.id, { ip });
  redirect("/admin");
}

export async function logoutAction() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/admin/login");
}

export async function runCycleAction(formData: FormData) {
  const user = await requireUser("admin");
  const ingestOnly = formData.get("ingestOnly") === "1";
  const running = await db.ingestionRun.findFirst({
    where: { kind: "news_cycle", status: "running", startedAt: { gt: new Date(Date.now() - LOCK_MINUTES * 60_000) } },
    orderBy: { startedAt: "desc" },
  });
  if (running) {
    const since = running.startedAt.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
    back("/admin", "erro", `Já há um ciclo rodando desde ${since}. Aguarde terminar (acompanhe em "Execuções recentes"); você pode revisar e aprovar matérias enquanto isso.`);
  }
  await audit(`user:${user.id}`, "pipeline.run_manual", "ingestion_run", null, { ingestOnly });
  // Roda DEPOIS da resposta: o painel não fica preso esperando a IA (planos gratuitos podem levar minutos).
  after(async () => {
    try {
      const { stats } = await runConfiguredCycle("admin", { ingestOnly });
      if (stats.published > 0) {
        revalidatePath("/");
        revalidatePath("/news");
      }
    } catch (err) {
      console.error("[painel] ciclo falhou:", err instanceof Error ? err.message : err);
    }
  });
  back("/admin", "ok", "Ciclo iniciado em segundo plano. Recarregue a página em alguns minutos e veja o resultado em \"Execuções recentes\" e na fila de revisão.");
}

export async function refreshSportsDataAction() {
  const user = await requireUser();
  // Limite simples: evita estourar o limite público da Jolpica (~500 req/h) com cliques repetidos.
  const limit = rateLimit(`f1-refresh:${user.id}`, 6, 10 * 60_000);
  if (!limit.ok) back("/admin", "erro", `Aguarde ${Math.ceil(limit.retryAfterSec / 60)} min para atualizar de novo (limite da fonte de dados).`);
  revalidateTag(F1_CACHE_TAG);
  revalidatePath("/", "layout");
  await audit(`user:${user.id}`, "f1.cache_refreshed", "f1_data", null);
  back("/admin", "ok", "Dados esportivos atualizados: as próximas visitas buscam calendário, resultados, classificação e probabilidades direto da fonte.");
}

export async function toggleSourceAction(formData: FormData) {
  const user = await requireUser("admin");
  const id = z.string().regex(/^[a-z0-9-]{2,40}$/).parse(formData.get("id"));
  const src = await db.newsSource.findUnique({ where: { id } });
  if (!src) back("/admin", "erro", "Fonte não encontrada.");
  await db.newsSource.update({ where: { id }, data: { enabled: !src.enabled } });
  await audit(`user:${user.id}`, src.enabled ? "source.disabled" : "source.enabled", "news_source", id);
  back("/admin", "ok", `Fonte ${src.name} ${src.enabled ? "desativada" : "ativada"}.`);
}

async function articleAction(formData: FormData, fn: (actor: { id: string; role: "editor" | "admin" }, id: string) => Promise<void>, okMsg: string) {
  const user = await requireUser();
  const parsed = zId.safeParse(formData.get("id"));
  if (!parsed.success) back("/admin", "erro", "Identificador inválido.");
  const id = parsed.data;
  try {
    await fn(user, id);
  } catch (err) {
    back(`/admin/articles/${id}`, "erro", err instanceof EditorialError ? err.message : "Falha ao executar a ação.");
  }
  revalidatePath("/");
  revalidatePath("/news");
  const a = await db.article.findUnique({ where: { id }, select: { slug: true } });
  if (a) revalidatePath(`/news/${a.slug}`);
  back(`/admin/articles/${id}`, "ok", okMsg);
}

export async function approveAction(formData: FormData) {
  await articleAction(formData, (u, id) => approveAndPublish(db, u, id), "Artigo aprovado e publicado.");
}

export async function rejectAction(formData: FormData) {
  await articleAction(formData, (u, id) => reject(db, u, id, String(formData.get("reason") ?? "")), "Artigo rejeitado.");
}

export async function retractAction(formData: FormData) {
  await articleAction(formData, (u, id) => retract(db, u, id, String(formData.get("note") ?? "")), "Artigo despublicado.");
}

export async function reopenAction(formData: FormData) {
  await articleAction(formData, (u, id) => reopen(db, u, id), "Artigo devolvido para revisão.");
}

export async function editAction(formData: FormData) {
  await articleAction(
    formData,
    (u, id) =>
      editArticle(db, u, id, {
        headline: String(formData.get("headline") ?? ""),
        dek: String(formData.get("dek") ?? ""),
        body: String(formData.get("body") ?? ""),
        note: String(formData.get("note") ?? ""),
        correction: String(formData.get("correction") ?? ""),
      }),
    "Nova versão salva.",
  );
}
