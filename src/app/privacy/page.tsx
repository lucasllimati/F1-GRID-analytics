import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Privacidade", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <>
      <PageHeader kicker="LGPD" title="Privacidade" />
      <Container className="mt-10 max-w-3xl space-y-4 text-muted">
        <p>
          Esta versão do site não usa cookies de rastreamento, não exibe anúncios e não coleta dados pessoais de visitantes.
        </p>
        <p>
          Suas preferências de fuso horário e tema ficam salvas apenas no armazenamento local do seu navegador (localStorage) e nunca são
          enviadas ao servidor. Você pode apagá-las a qualquer momento pelo botão “Restaurar padrão” do seletor de fuso ou limpando os dados
          do site no navegador.
        </p>
        <p>
          O único cookie usado é o de sessão da área administrativa, restrito à equipe editorial. Registros técnicos do servidor (como
          endereço IP) podem ser mantidos por tempo limitado para segurança e prevenção de abuso.
        </p>
        <p>
          Quando a newsletter for lançada, o envio dependerá de consentimento explícito, com descadastro em um clique; esta política será
          atualizada antes disso.
        </p>
      </Container>
    </>
  );
}
