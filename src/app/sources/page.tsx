import type { Metadata } from "next";
import { Card, Container, PageHeader, SectionHeading } from "@/components/ui";
import { JOLPICA_INFO } from "@/lib/f1/providers/jolpica";
import { THRESHOLDS } from "@/lib/news/policy";
import { NEWS_SOURCES } from "@/lib/news/sources";

export const metadata: Metadata = {
  title: "Fontes e política editorial",
  description: "Quais fontes a Apex Grid monitora, como as notícias são produzidas e verificadas e como corrigimos erros.",
  alternates: { canonical: "/sources" },
};

export default function SourcesPage() {
  return (
    <>
      <PageHeader kicker="Transparência" title="Fontes e política editorial">
        Como monitoramos o noticiário, como escrevemos nossas versões das notícias e o que nunca fazemos.
      </PageHeader>
      <Container className="mt-10 max-w-4xl space-y-14">
        <section>
          <SectionHeading title="Veículos monitorados" />
          <Card className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Fonte</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Idioma</th>
                  <th scope="col">Grupo editorial</th>
                </tr>
              </thead>
              <tbody>
                {NEWS_SOURCES.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <a href={s.homepage} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-accent">
                        {s.name}
                      </a>
                    </td>
                    <td>{s.kind === "official" ? "Oficial" : "Imprensa"}</td>
                    <td>{s.language}</td>
                    <td className="text-muted">{s.group}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="mt-3 text-sm text-muted">
            Veículos do mesmo grupo editorial (por exemplo, Autosport e Motorsport.com) não contam como confirmações independentes entre si.
          </p>
        </section>

        <section className="space-y-4 text-muted">
          <SectionHeading title="Como uma notícia é produzida" />
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong className="text-fg">Monitoramento:</strong> lemos periodicamente os feeds RSS públicos das fontes acima. Itens
              promocionais (apostas, sorteios, vídeos, transmissões ao vivo) e fora do escopo da F1 são descartados.
            </li>
            <li>
              <strong className="text-fg">Deduplicação:</strong> manchetes de veículos diferentes sobre o mesmo fato são agrupadas em uma
              pauta.
            </li>
            <li>
              <strong className="text-fg">Critério de pauta:</strong> só escrevemos automaticamente quando o fato vem de fonte oficial (F1 ou
              FIA) ou foi noticiado por pelo menos dois grupos editoriais independentes.
            </li>
            <li>
              <strong className="text-fg">Apuração:</strong> quando o arquivo robots.txt do veículo permite, consultamos o texto original
              apenas como evidência interna para checagem. Esse texto nunca é exibido nem republicado.
            </li>
            <li>
              <strong className="text-fg">Redação:</strong> um agente de IA escreve um texto novo, em português, usando somente fatos das
              fontes, com atribuição explícita (“segundo a BBC…”), sem copiar frases e sem transformar rumor em fato.
            </li>
            <li>
              <strong className="text-fg">Checagem independente:</strong> um segundo agente extrai cada afirmação do texto e a confronta com
              as fontes. Também medimos automaticamente a semelhança com os originais para evitar cópia.
            </li>
            <li>
              <strong className="text-fg">Decisão:</strong> a publicação automática só acontece se todas as afirmações forem sustentadas
              pelas fontes, a confiança do verificador for de pelo menos {Math.round(THRESHOLDS.minCheckerConfidence * 100)}%, não houver
              trechos copiados e o tema não for sensível. Caso contrário, o texto vai para um editor humano.
            </li>
          </ol>
          <p>
            <strong className="text-fg">Sempre exigem revisão humana:</strong> mortes, lesões e saúde, questões jurídicas, acusações,
            penalidades ou recursos controversos e qualquer informação não confirmada (rumores, negociações, “fontes dizem”).
          </p>
          <p>
            Cada matéria lista, no fim, as reportagens que serviram de base, com link para o original. Guardamos o histórico de versões de
            cada texto.
          </p>
        </section>

        <section id="correcoes" className="space-y-3 text-muted">
          <SectionHeading title="Correções" />
          <p>
            Quando identificamos um erro, corrigimos o texto e registramos uma nota de correção visível. Se uma matéria não se sustenta,
            ela é despublicada e mantida com um aviso — não apagamos silenciosamente.
          </p>
        </section>

        <section className="space-y-3 text-muted">
          <SectionHeading title="Dados esportivos" />
          <p>
            Calendário, resultados e classificação vêm da{" "}
            <a href={JOLPICA_INFO.url} className="underline" target="_blank" rel="noopener noreferrer">
              {JOLPICA_INFO.name}
            </a>
            . {JOLPICA_INFO.licenseNote}
          </p>
          <p>Não usamos imagens, logotipos ou dados de telemetria protegidos.</p>
        </section>
      </Container>
    </>
  );
}
