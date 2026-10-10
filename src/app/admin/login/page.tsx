import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { loginAction } from "../actions";

export const metadata: Metadata = { title: "Entrar", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (await getCurrentUser()) redirect("/admin");
  const { erro } = await searchParams;
  return (
    <Container className="flex justify-center py-20">
      <form action={loginAction} className="w-full max-w-sm space-y-4 rounded-md border border-line bg-elev p-6">
        <h1 className="font-display text-2xl font-bold uppercase">Redação · acesso restrito</h1>
        {erro && (
          <p role="alert" className="rounded border border-accent/60 bg-accent-soft p-2 text-sm">
            {erro.slice(0, 200)}
          </p>
        )}
        <label className="block text-sm">
          E-mail
          <input name="email" type="email" required autoComplete="username" className="mt-1 w-full rounded border border-line bg-bg px-3 py-2" />
        </label>
        <label className="block text-sm">
          Senha
          <input
            name="password"
            type="password"
            required
            minLength={12}
            autoComplete="current-password"
            className="mt-1 w-full rounded border border-line bg-bg px-3 py-2"
          />
        </label>
        <button className="w-full rounded bg-accent py-2 font-semibold text-white hover:bg-accent-strong">Entrar</button>
      </form>
    </Container>
  );
}
