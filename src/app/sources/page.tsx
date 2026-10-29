import type { Metadata } from "next";
import { Card, Container, PageHeader, SectionHeading } from "@/components/ui";
import { JOLPICA_INFO } from "@/lib/f1/providers/jolpica";
import { THRESHOLDS } from "@/lib/news/policy";
import { LANGUAGE_LABEL, NEWS_SOURCES, REGION_LABEL } from "@/lib/news/sources";

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
          <SectionHeading title={`Veículos monitorados (${NEWS_SOURCES.length})`} />
          <div className="space-y-6">
            {(Object.keys(REGION_LABEL) as (keyof typeof REGION_LABEL)[]).map((region) => {
              const list = NEWS_SOURCES.filter((s) => s.region === region);
              if (list.length === 0) return null;
              return (
                <Card key={region} className="overflow-x-auto">
                  <h3 className="border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted">
                    {REGION_LABEL[region]} · {list.length}
                  </h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Fonte</th>
                        <th scope="col">Idioma</th>
                        <th scope="col">Grupo editorial</th>
                        <th scope="col">Cobertura</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <a href={s.homepage} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-accent">
                              {s.name}
                            </a>
                          </td>
                          <td>{LANGUAGE_LABEL[s.language]}</td>
                          <td className="text-muted">{s.group}</td>
                          <td className="text-muted">{s.requireF1Keyword ? "várias categorias (filtramos só F1)" : "Fórmula 1"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-muted">
            Veículos do mesmo grupo editorial (por exemplo, Autosport, Motorsport.com e Formel1.de, todos da Motorsport Network) não contam
            como confirmações independentes entre si. Fontes oficiais (F1, FIA e Pirelli, fornecedora oficial de pneus) bastam sozinhas.
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
          <p>
            O histórico desde 1950 (recordes, campeões, &quot;neste dia&quot;) também vem da Jolpica-F1, sob licença CC BY-NC-SA 4.0. Antes de
            1994 a fonte não tem a sessão de classificação: a pole é o piloto que largou em 1º. Voltas mais rápidas só existem a partir de 2004.
          </p>
          <p>Não usamos imagens, logotipos ou dados de telemetria protegidos.</p>
          <p>
            Bandeiras: fonte &quot;Twemoji Country Flags&quot; (código MIT, TalkJS), com arte do{" "}
            <a href="https://github.com/twitter/twemoji" className="underline" target="_blank" rel="noopener noreferrer">
              Twemoji
            </a>{" "}
            sob licença CC BY 4.0.
          </p>
        </section>
      </Container>
    </>
  );
}
