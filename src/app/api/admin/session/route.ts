import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS, verifySessionToken } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Estado da sessão administrativa para o indicador do cabeçalho.
// Valida assinatura, expiração e se o usuário continua ativo no banco.
// Renovação deslizante: com menos da metade do tempo restante, emite um novo cookie.
export async function GET() {
  const noStore = { "Cache-Control": "no-store, private" };
  const jar = await cookies();
  const payload = verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!payload) return NextResponse.json({ loggedIn: false }, { headers: noStore });

  const user = await db.adminUser.findUnique({ where: { id: payload.uid }, select: { id: true, name: true, role: true, active: true } });
  if (!user || !user.active) {
    jar.delete(SESSION_COOKIE);
    return NextResponse.json({ loggedIn: false }, { headers: noStore });
  }

  const role = user.role === "admin" ? "admin" : "editor";
  let expiresAt = payload.exp * 1000;
  if (expiresAt - Date.now() < (SESSION_TTL_SECONDS * 1000) / 2) {
    jar.set(SESSION_COOKIE, createSessionToken({ uid: user.id, role }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  }
  const pending = await db.article.count({ where: { status: "in_review" } });
  return NextResponse.json({ loggedIn: true, name: user.name, role, expiresAt, pending }, { headers: noStore });
}
