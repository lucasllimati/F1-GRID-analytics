import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "../db";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export type CurrentUser = { id: string; email: string; name: string; role: "editor" | "admin" };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const payload = verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  const user = await db.adminUser.findUnique({ where: { id: payload.uid } });
  if (!user || !user.active) return null;
  const role = user.role === "admin" ? "admin" : "editor";
  return { id: user.id, email: user.email, name: user.name, role };
}

/** Exige sessão (e opcionalmente papel admin). Redireciona para o login quando ausente. */
export async function requireUser(role?: "admin"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (role === "admin" && user.role !== "admin") redirect("/admin?erro=permissao");
  return user;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}
