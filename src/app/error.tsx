"use client";

import { Container } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <Container className="py-24 text-center">
      <h1 className="font-display text-3xl font-bold uppercase">Algo deu errado</h1>
      <p className="mt-2 text-muted">Não foi possível carregar esta página agora.</p>
      <button type="button" onClick={reset} className="mt-6 rounded bg-accent px-4 py-2 text-sm font-semibold text-white">
        Tentar novamente
      </button>
    </Container>
  );
}
