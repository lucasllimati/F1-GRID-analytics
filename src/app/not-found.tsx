import Link from "next/link";
import { Container } from "@/components/ui";

export default function NotFound() {
  return (
    <Container className="py-24 text-center">
      <p className="font-display text-8xl font-extrabold italic text-accent">404</p>
      <h1 className="mt-2 font-display text-3xl font-bold uppercase">Fora da pista</h1>
      <p className="mt-2 text-muted">A página que você procura não existe ou foi removida.</p>
      <Link href="/" className="mt-6 inline-block rounded bg-accent px-4 py-2 text-sm font-semibold text-white">
        Voltar ao início
      </Link>
    </Container>
  );
}
