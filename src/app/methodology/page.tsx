import type { Metadata } from "next";
import { Container, PageHeader, SectionHeading } from "@/components/ui";
import { DEFAULT_ASSUMPTIONS, MODEL_VERSION } from "@/lib/f1/probability";

export const metadata: Metadata = {
  title: "Metodologia",
  description: "Como a Apex Grid trata fusos horários, estados de eventos, resultados e calcula probabilidades de título.",
  alternates: { canonical: "/methodology" },
};

export default function MethodologyPage() {
  const a = DEFAULT_ASSUMPTIONS;
  return (
    <>
      <PageHeader kicker="Transparência" title="Metodologia" />
      <Container className="mt-10 max-w-3xl space-y-12 text-muted [&_strong]:text-fg">
        <section className="space-y-3">
          <SectionHeading title="Fusos horários" />
          <p>
            Os horários oficiais das sessões são armazenados em UTC, como publicados pela fonte. A conversão para qualquer fuso usa os
            identificadores IANA (por exemplo, <code>America/Sao_Paulo</code>, <code>Europe/Monaco</code>) e a base de fusos do seu
            navegador — nunca somamos ou subtraímos um número fixo de horas. Assim, mudanças de horário de verão no país do circuito ou no
            seu são respeitadas na data exata de cada sessão.
          </p>
          <p>
            Quando a fonte divulga só a data, mostramos “horário não divulgado” em vez de inventar um horário. A preferência de fuso fica
            salva apenas no seu navegador; não pedimos sua localização.
          </p>
        </section>

        <section className="space-y-3">
          <SectionHeading title="Estado dos eventos" />
          <p>
            <strong>Próximo</strong>: nenhuma sessão chegou ao horário previsto. <strong>Fim de semana em andamento</strong>: a primeira
            sessão já passou do horário previsto. <strong>Aguardando resultado oficial</strong>: o horário da corrida já passou, mas a fonte
            ainda não publicou o resultado. <strong>Concluído</strong>: resultado publicado.
          </p>
          <p>
            Não exibimos “ao vivo”: não temos uma fonte confiável de estado em tempo real, e um horário previsto não garante que a sessão
            começou (atrasos e bandeiras vermelhas acontecem).
          </p>
        </section>

        <section className="space-y-3">
          <SectionHeading title="Resultados e grid" />
          <p>
            Abandonos, desclassificações e pilotos que não largaram aparecem com o status oficial, nunca convertidos em tempos ou posições
            fictícias. O grid de largada exibido é o publicado junto ao resultado oficial; antes disso, mostramos a ordem da classificação
            com aviso de que penalidades podem alterá-la.
          </p>
        </section>

        <section className="space-y-3">
          <SectionHeading title={`Probabilidades de título (${MODEL_VERSION})`} />
          <p>
            <strong>Chance matemática</strong>: um piloto ainda pode ser campeão se os pontos atuais somados ao máximo ainda disponível
            (vitória em todas as corridas restantes e nas sprints) alcançam o líder. É um cálculo exato.
          </p>
          <p>
            <strong>Probabilidade estimada</strong>: simulamos o restante da temporada {a.simulations.toLocaleString("pt-BR")} vezes
            (Monte Carlo). Em cada simulação, cada corrida e sprint restante é sorteada assim:
          </p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              Força de cada piloto: modelo de Plackett-Luce ajustado (algoritmo MM) às ordens de chegada da temporada, com peso maior para
              corridas recentes (meia-vida de {a.recencyHalfLife} corridas) e {Math.round(a.teamShrinkage * 100)}% de encolhimento para a
              média da equipe.
            </li>
            <li>
              Em cada corrida, a equipe recebe um choque de desempenho comum aos dois carros (σ = {a.teamShockSd}) e cada piloto um choque
              individual (σ = {a.driverShockSd}). Isso cria correlação entre companheiros de equipe.
            </li>
            <li>
              Cada piloto pode abandonar com sua taxa histórica da temporada, suavizada por um prior Beta({a.dnfPrior.a}, {a.dnfPrior.b}).
            </li>
            <li>Os demais são ordenados (Plackett-Luce via truque de Gumbel) e recebem os pontos da tabela da temporada.</li>
            <li>No fim, o campeão é definido por pontos e, em caso de empate, pelo critério de mais vitórias, mais 2º lugares etc.</li>
          </ol>
          <p>
            Probabilidade estimada = simulações em que o piloto é campeão ÷ total de simulações. Os construtores somam os pontos simulados
            dos seus pilotos, com a mesma correlação de carro.
          </p>
          <p>
            <strong>Limitações</strong>: o modelo não considera circuitos, atualizações técnicas, clima ou penalidades futuras e ainda não
            foi validado por backtest. Com menos de três corridas na temporada, não exibimos números. Muitas simulações só reduzem ruído
            numérico; não tornam hipóteses erradas em certas.
          </p>
        </section>

        <section className="space-y-3">
          <SectionHeading title="Comparativos e tendências" />
          <p>
            Todas as métricas do comparativo são calculadas a partir de resultados oficiais publicados de corridas, sprints e classificações. A{" "}
            <strong>posição no campeonato</strong> etapa a etapa é recalculada somando os pontos publicados e aplicando o desempate oficial (mais
            vitórias, depois mais 2º lugares, e assim por diante); conferimos que ela coincide com a classificação oficial.
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Equipes</strong>: posição de chegada e de classificação = melhor carro; pontos = soma dos dois carros.
            </li>
            <li>
              <strong>Chegada média</strong> considera só provas terminadas classificado; abandonos aparecem como interrupção na linha, nunca como
              posição inventada.
            </li>
            <li>
              <strong>Confronto direto em corrida</strong>: conta quando ao menos um terminou classificado; classificado vence não classificado.
            </li>
            <li>
              <strong>Tendência</strong>: média de pontos por etapa nas últimas 5 comparada com a média anterior; variação menor que 15% (mínimo 1
              ponto) é considerada estável. Com menos de 3 etapas antes das últimas 5, a tendência não é calculada.
            </li>
            <li>
              Num fim de semana Sprint em andamento, a sprint e a classificação já entram nos gráficos antes do resultado da corrida.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <SectionHeading title="Notícias geradas com IA" />
          <p>
            Veja a página <a href="/sources" className="underline">Fontes e política editorial</a> para o processo completo, os critérios de
            publicação automática e a política de correções.
          </p>
        </section>
      </Container>
    </>
  );
}
