"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

// Botão de envio do painel: enquanto a ação roda no servidor, fica travado e diz o que está
// fazendo. Evita o clique duplo (antes, aprovar várias vezes a mesma matéria) e mostra que
// o clique foi recebido mesmo quando o servidor está ocupado com um ciclo de notícias.
export function SubmitButton({ children, pending, className = "", disabled = false }: { children: ReactNode; pending: string; className?: string; disabled?: boolean }) {
  const status = useFormStatus();
  const busy = status.pending;
  return (
    <button type="submit" disabled={disabled || busy} aria-busy={busy} className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}>
      {busy ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" aria-hidden="true" />
          {pending}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
