import { Container } from "@/components/ui";

export default function Loading() {
  return (
    <Container className="py-16" >
      <div role="status" aria-live="polite" className="space-y-4">
        <span className="sr-only">Carregando…</span>
        <div className="h-10 w-2/3 animate-pulse rounded bg-elev-2" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-elev-2" />
        <div className="grid gap-4 pt-6 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded bg-elev" />
          ))}
        </div>
      </div>
    </Container>
  );
}
