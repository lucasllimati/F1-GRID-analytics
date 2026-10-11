"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Session = { loggedIn: false } | { loggedIn: true; name: string; role: "admin" | "editor"; expiresAt: number; pending: number };

/**
 * Indicador de sessão administrativa no cabeçalho. Consulta o servidor (o cookie é httpOnly,
 * o navegador não o lê) ao carregar, ao trocar de página e a cada 5 minutos — o que também
 * mantém a sessão renovada enquanto o editor usa o site. Não aparece para visitantes.
 */
export function AdminStatus() {
  const pathname = usePathname();
  const [s, setS] = useState<Session>({ loggedIn: false });

  useEffect(() => {
    let alive = true;
    const check = () =>
      fetch("/api/admin/session", { cache: "no-store", credentials: "same-origin" })
        .then((r) => (r.ok ? (r.json() as Promise<Session>) : { loggedIn: false as const }))
        .then((d) => alive && setS(d))
        .catch(() => alive && setS({ loggedIn: false }));
    check();
    const id = setInterval(check, 5 * 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pathname]);

  if (!s.loggedIn) return null;
  const until = new Date(s.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <Link
      href="/admin"
      className="flex items-center gap-1.5 rounded border border-ok/50 px-2.5 py-1.5 text-xs font-medium text-fg hover:border-ok"
      title={`Sessão ativa como ${s.role === "admin" ? "administrador" : "editor"} até ${until}`}
    >
      <span className="h-2 w-2 rounded-full bg-ok" aria-hidden="true" />
      <span className="hidden sm:inline">Painel</span>
      <span className="sr-only">
        Painel da redação. Sessão ativa como {s.name}, até {until}.
      </span>
      {s.pending > 0 && (
        <span className="rounded-sm bg-accent px-1.5 text-[0.65rem] font-bold text-white" aria-label={`${s.pending} matérias aguardando revisão`}>
          {s.pending}
        </span>
      )}
    </Link>
  );
}
