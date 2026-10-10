import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Sobre", alternates: { canonical: "/about" } };

export default function AboutPage() {
  return (
    <>
      <PageHeader kicker="Apex Grid" title="Sobre">
        Formula 1, decoded.
      </PageHeader>
      <Container className="mt-10 max-w-3xl space-y-4 text-muted">
        <p>
          A Apex Grid é uma plataforma independente sobre Fórmula 1 em português: calendário no seu fuso, resultados, classificação,
          probabilidades de título com metodologia aberta e notícias com fontes rastreáveis.
        </p>
        <p>
          Não temos vínculo com a Formula One Group, a FIA, equipes ou pilotos. Nomes e marcas citados pertencem aos seus titulares e são
          usados apenas para fins informativos.
        </p>
        <p>
          Princípios: nada de resultados ou horários inventados, separação clara entre dado oficial e estimativa de modelo, e toda notícia
          com as fontes que a sustentam.
        </p>
      </Container>
    </>
  );
}
