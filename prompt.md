# APEX GRID — PROMPT MESTRE DE DESENVOLVIMENTO

## Plataforma profissional de Fórmula 1, calendário global, estatísticas, probabilidades de campeonato e redação automatizada com IA

### 1. PAPEL E MISSÃO

Atue como um time sênior multidisciplinar composto por:

- Software Architect.
- Senior Full-Stack Developer.
- Data Engineer.
- Sports Data Analyst.
- Statistician / Probability Modeler.
- AI Agent Engineer.
- Sports Journalist.
- UX/UI Designer.
- SEO Specialist.
- DevOps Engineer.
- Security Engineer.
- QA Engineer.

Sua missão é criar do zero uma plataforma digital independente dedicada principalmente à Fórmula 1, com cobertura complementar de Fórmula 2 e Fórmula 3.

O produto deverá combinar:

1. Calendário completo de corridas.
2. Horários internacionais e conversão de fusos.
3. Grid de largada.
4. Resultados de sessões e corridas.
5. Classificação de pilotos e construtores.
6. Probabilidade estimada de título.
7. Estatísticas históricas.
8. Comparações entre pilotos e equipes.
9. Notícias e análises.
10. Agentes de IA para pesquisa e produção editorial.
11. Newsletter automatizada.
12. Guias educativos.
13. Monetização contextual com afiliados.
14. Painel administrativo e observabilidade.

Não construa somente uma landing page. Desenvolva uma aplicação funcional, com arquitetura modular, persistência, integração de dados, testes e documentação.

Nome provisório: Apex Grid.

Tagline: Formula 1, decoded.

Idioma inicial: português brasileiro.

Fuso de referência inicial: America/Sao_Paulo, com opção de personalização.

O produto deve estar preparado para internacionalização futura.

---

### 2. PRINCÍPIOS FUNDAMENTAIS

- Dados reais devem ser separados de exemplos fictícios.
- Nenhum resultado ou horário pode ser inventado.
- Estatísticas devem informar temporada, unidade e origem.
- Probabilidades devem ser calculadas com metodologia documentada.
- Horários devem ser convertidos corretamente por fuso.
- Conteúdo editorial deve apresentar fontes rastreáveis.
- A IA não pode publicar automaticamente qualquer conteúdo sem critérios de validação.
- Não utilizar imagens, logotipos ou dados protegidos sem verificar permissões.
- Não depender desnecessariamente de uma única fonte de dados.
- Não presumir que uma API pública tenha licença irrestrita para uso comercial.
- Não desenvolver todas as funcionalidades em uma única alteração gigantesca.

---

### 3. IDENTIDADE VISUAL E UX

Criar uma interface premium inspirada na linguagem visual de telemetria, automobilismo e jornalismo de dados, sem copiar diretamente a identidade da F1 ou de outras marcas.

Características:

- Fundo escuro como tema principal.
- Tema claro alternativo.
- Tipografia moderna e altamente legível.
- Vermelho como cor de destaque.
- Preto, branco, grafite e cinza como cores estruturais.
- Gráficos de alta qualidade.
- Tabelas compactas e legíveis.
- Layout responsivo.
- Microinterações discretas.
- Estados de carregamento.
- Estados vazios.
- Tratamento de erros.
- Navegação acessível por teclado.
- Contraste adequado.
- Unidades e legendas claras.

Criar uma identidade visual própria, com logotipo tipográfico, favicon e sistema de ícones consistente.

Evitar aparência de template genérico ou dashboard administrativo em todas as páginas.

---

### 4. NAVEGAÇÃO

Criar as seguintes seções:

- Home.
- Race Center.
- Calendário.
- Resultados.
- Classificação.
- Pilotos.
- Equipes.
- Circuitos.
- Estatísticas.
- Probabilidades.
- Notícias.
- Análises.
- F2.
- F3.
- Academia.
- Guias de produtos.
- Newsletter.
- Sobre.

Rotas sugeridas:

/
 /calendar
 /race-center
 /results
 /standings
 /championship-probabilities
 /drivers
 /drivers/[slug]
 /teams
 /teams/[slug]
 /circuits
 /circuits/[slug]
 /statistics
 /head-to-head
 /history
 /news
 /news/[slug]
 /analysis
 /f2
 /f2/calendar
 /f2/standings
 /f3
 /f3/calendar
 /f3/standings
 /academy
 /guides
 /newsletter
 /about
 /methodology
 /sources
 /privacy
 /affiliate-disclosure

Corrigir a sintaxe das rotas para a convenção do framework escolhido durante a implementação.

---

### 5. HOMEPAGE

A homepage deve ser orientada ao próximo evento e à situação atual do campeonato.

#### Header

Incluir logotipo, navegação, busca, seleção de fuso horário, tema e acesso à newsletter.

#### Hero principal

Exibir o próximo evento relevante.

Mostrar:

- Nome do Grande Prêmio.
- Circuito.
- País.
- Data.
- Contagem regressiva.
- Horário local do evento.
- Horário do usuário.
- Horário de Brasília.
- Próxima sessão.
- Estado do evento.

A contagem regressiva deve usar dados reais e ser calculada corretamente no navegador, sem depender de um relógio inventado pelo servidor.

#### Próximas sessões

Cards para:

- Treino livre 1.
- Treino livre 2, quando aplicável.
- Treino livre 3, quando aplicável.
- Classificação.
- Sprint Shootout ou Sprint Qualifying, quando aplicável.
- Corrida Sprint.
- Corrida principal.

A agenda deve respeitar o formato oficial de cada fim de semana. Não assumir que todos os GPs possuem as mesmas sessões.

#### Championship Snapshot

Mostrar:

- Líder do campeonato.
- Diferença para o segundo colocado.
- Líderes de construtores.
- Vitórias.
- Pódios.
- Poles.
- Últimos resultados.
- Tendência de pontos.

#### Newsroom

Mostrar as principais notícias recentes, com data, fonte, categoria e tempo de leitura.

#### Data Highlights

Exibir fatos estatísticos interessantes, sempre sustentados por dados verificáveis.

#### Formula 2 e Formula 3

Adicionar cards compactos com a próxima etapa, classificação e últimas notícias.

---

### 6. CALENDÁRIO INTELIGENTE

Criar uma página completa para a temporada.

Exibir cada Grande Prêmio com:

- Nome.
- País.
- Circuito.
- Data.
- Horário.
- Sessões.
- Status.
- Resultados, quando disponíveis.
- Link para a página do evento.

Disponibilizar filtros por:

- Temporada.
- País.
- Mês.
- Status.
- Modalidade.
- Tipo de sessão.

Permitir visualizações em lista e calendário.

#### Estados dos eventos

- Upcoming.
- Live, somente quando houver uma fonte confiável de estado ao vivo.
- Completed.
- Postponed.
- Cancelled.
- Rescheduled.

Não deduzir que uma sessão está ao vivo apenas porque o horário previsto está próximo.

#### Contagem regressiva

Mostrar dias, horas, minutos e segundos até a próxima sessão selecionada.

Quando o evento começar, alterar o estado de forma coerente e baseada nos dados reais.

Não manter uma contagem negativa após o início.

---

### 7. FUSOS HORÁRIOS

Esta é uma funcionalidade prioritária.

O usuário deverá poder selecionar:

1. Horário do circuito.
2. Horário de Brasília.
3. Horário local detectado pelo navegador.
4. Um fuso horário personalizado.
5. Comparação entre dois ou mais fusos.

Utilizar identificadores IANA, como:

- America/Sao_Paulo.
- Europe/London.
- Europe/Monaco.
- Asia/Tokyo.
- Australia/Melbourne.
- America/New_York.

Não implementar conversões adicionando ou subtraindo manualmente um número fixo de horas.

Utilizar uma biblioteca ou API de datas compatível com IANA, com suporte correto ao horário de verão histórico e futuro.

Todos os horários de eventos devem ser armazenados em UTC ou em uma representação inequívoca, preservando também o fuso original e a fonte do horário oficial.

Se uma fonte fornecer apenas data e horário local do circuito, converter utilizando o fuso IANA correto daquele local e da data específica.

Se o horário oficial estiver ausente, não inventar um horário UTC.

Exibir o nome do fuso, a data completa e o deslocamento UTC quando isso ajudar a evitar ambiguidades.

#### Interface

Exemplo ilustrativo:

| Sessão | Circuito | Brasília | Meu fuso |
|---|---|---|---|
| Treino livre | 14:00 | 10:00 | 09:00 |
| Classificação | 16:00 | 12:00 | 11:00 |
| Corrida | 15:00 | 11:00 | 10:00 |

Os valores acima são fictícios e servem somente como exemplo de interface.

Persistir a preferência do usuário de forma apropriada.

Permitir retornar ao fuso automático.

Não solicitar geolocalização precisa para uma funcionalidade que pode funcionar com o fuso escolhido pelo usuário.

---

### 8. GRID DE LARGADA

Criar uma página dedicada ao grid de cada corrida.

Exibir:

- Posição de largada.
- Número do carro.
- Piloto.
- Equipe.
- Tempo de classificação.
- Q1, Q2 e Q3, quando disponíveis.
- Penalidades.
- Posição após penalidades.
- Status da confirmação.
- Fonte.
- Data de atualização.

Criar uma representação visual de grid em duas colunas, respeitando a ordem oficial e o número de carros efetivamente participantes.

Não assumir que a grade possui sempre o mesmo número de posições.

A visualização deverá ser adaptável a diferentes tamanhos de tela.

#### Estados do grid

- Provisional.
- Confirmed.
- Updated.
- Superseded.

Se existirem penalidades aplicadas após a classificação, preservar a ordem original da classificação e mostrar separadamente o grid final oficial.

Se a fonte não fornecer o grid, mostrar uma mensagem clara de indisponibilidade.

Não substituir o grid oficial por uma estimativa.

---

### 9. RESULTADOS

Criar páginas de resultados para:

- Treinos livres.
- Qualificação.
- Sprint.
- Corrida principal.

Cada tabela deverá suportar:

- Ordenação.
- Filtros.
- Busca.
- Paginação quando necessária.
- Visualização móvel.
- Exportação de dados permitidos.

Exibir os campos disponíveis e aplicáveis:

- Posição.
- Piloto.
- Equipe.
- Tempo.
- Diferença.
- Voltas.
- Pontos.
- Status.
- Penalidades.

Diferenciar claramente:

- Resultado provisório.
- Resultado oficial.
- Resultado revisado.
- Abandono.
- Desclassificação.
- Não largou.

Não converter estados especiais em tempos ou posições fictícias.

---

### 10. CLASSIFICAÇÃO DO CAMPEONATO

Criar classificação separada para pilotos e construtores.

Campos:

- Posição.
- Piloto ou equipe.
- Pontos.
- Vitórias.
- Pódios, quando disponíveis.
- Poles, quando disponíveis.
- Diferença para o líder.
- Variação de posição em relação à etapa anterior.

Implementar visualizações:

- Tabela tradicional.
- Gráfico de evolução dos pontos.
- Evolução da posição.
- Comparação entre pilotos.
- Comparação entre construtores.
- Pontos acumulados por etapa.

Permitir selecionar temporadas anteriores.

Utilizar as regras de pontuação correspondentes à temporada e à categoria.

Não assumir que os sistemas de pontuação da F1, F2 e F3 são idênticos.

---

### 11. PROBABILIDADE DE TÍTULO

Criar uma seção de probabilidades para o campeonato de pilotos e construtores.

Esta será uma das principais funcionalidades diferenciadoras do produto.

O sistema deverá calcular a chance estimada de cada piloto ou equipe conquistar o título com base nos pontos atuais, nas corridas restantes e em um modelo probabilístico.

Não apresentar previsões como certezas.

#### 11.1 Modelo de referência

Começar com uma simulação de Monte Carlo.

A cada simulação:

1. Carregar a classificação atual.
2. Carregar as etapas restantes.
3. Identificar os formatos de fim de semana.
4. Obter as regras de pontuação aplicáveis.
5. Estimar o desempenho dos pilotos.
6. Simular as sessões que distribuem pontos.
7. Calcular a pontuação final de cada piloto.
8. Aplicar critérios oficiais de desempate.
9. Identificar o campeão.
10. Repetir o processo muitas vezes.
11. Calcular a frequência de títulos por piloto.

A probabilidade empírica será:

Probabilidade estimada de título = número de simulações em que o piloto é campeão / número total de simulações válidas.

Executar inicialmente um número configurável de simulações, aumentando conforme a precisão necessária e o orçamento computacional.

#### 11.2 Variáveis de desempenho

Considerar progressivamente:

- Pontuação atual.
- Desempenho recente.
- Resultados de classificação.
- Resultados de corrida.
- Ritmo relativo.
- Desempenho em circuitos semelhantes.
- Diferença entre companheiros de equipe.
- Abandonos.
- Confiabilidade mecânica.
- Penalidades.
- Desempenho da equipe.
- Vantagem de circuito, se sustentada por dados suficientes.
- Formato Sprint.
- Mudanças de regulamento, quando modeláveis.

Evitar incluir variáveis sem dados confiáveis.

#### 11.3 Evitar falsa precisão

O modelo deve considerar incerteza e correlação entre resultados.

Pilotos da mesma equipe compartilham parte do desempenho do carro. Resultados de pilotos no mesmo GP não são necessariamente independentes.

Construir um modelo progressivo:

- Versão 1: cenários matemáticos e distribuição baseada em desempenho histórico recente.
- Versão 2: modelo probabilístico calibrado por piloto, equipe e circuito.
- Versão 3: modelo hierárquico com efeitos de equipe, circuito, forma recente e confiabilidade, conforme a qualidade dos dados.

Não criar probabilidades arbitrárias apenas para preencher a tela.

Se o histórico for insuficiente, exibir cenários ilustrativos identificados como tais ou não exibir probabilidades numéricas.

#### 11.4 Classificação de construtores

Simular os pontos finais das equipes a partir dos resultados de seus pilotos, respeitando as regras aplicáveis.

Não tratar os dois pilotos de uma equipe como observações independentes sem considerar o efeito comum do carro.

#### 11.5 Visualizações

Criar:

- Probabilidade de título por piloto.
- Evolução da probabilidade por etapa.
- Probabilidade por equipe.
- Distribuição dos pontos finais simulados.
- Cenários necessários para ser campeão.
- Sensibilidade a abandonos e resultados futuros.

Cada visualização deve apresentar:

- Data de atualização.
- Dados utilizados.
- Número de simulações.
- Versão do modelo.
- Hipóteses.
- Limitações.
- Incerteza estimada.

Diferenciar chance matemática de título e probabilidade estatística de título.

A chance matemática indica se o título ainda é possível conforme os pontos máximos restantes e os critérios de desempate.

A probabilidade estatística depende do modelo e dos cenários simulados.

Não afirmar que uma probabilidade é confiável apenas porque foram executadas muitas simulações. A qualidade depende sobretudo das hipóteses e dos dados.

#### 11.6 Validação do modelo

Backtestar o modelo em temporadas anteriores, usando apenas dados que estariam disponíveis na data simulada.

Avaliar calibração, Brier score, log loss quando aplicável e qualidade dos intervalos de incerteza.

Evitar vazamento de dados futuros.

Comparar o modelo com baselines simples, como desempenho recente e desempenho relativo entre companheiros de equipe.

---

### 12. ESTATÍSTICAS E COMPARATIVOS

Criar uma central de estatísticas.

#### Pilotos

- Vitórias.
- Pódios.
- Poles.
- Voltas mais rápidas.
- Pontos.
- Abandonos.
- Participações.
- Vitórias por temporada.
- Resultados em classificação.
- Comparativo com companheiro de equipe.

#### Equipes

- Títulos.
- Vitórias.
- Pódios.
- Pontos.
- Poles.
- Resultados por temporada.
- Evolução histórica.

#### Temporadas

- Classificação final.
- Margem do campeão.
- Disputas pelo título.
- Número de vencedores.
- Estatísticas das corridas.

#### Comparação head-to-head

Permitir selecionar dois pilotos ou equipes.

Mostrar:

- Pontos.
- Vitórias.
- Pódios.
- Poles.
- Resultados em classificação.
- Resultados de corrida.
- Desempenho por circuito.
- Evolução por etapa.

Distinguir comparação de temporada, carreira e confrontos sob condições equivalentes.

---

### 13. TELEMETRIA E ANÁLISES AVANÇADAS

Criar uma seção para análises técnicas quando os dados necessários estiverem legalmente disponíveis.

Possibilidades:

- Comparação de voltas.
- Evolução de tempos.
- Ritmo de corrida.
- Estratégia de pneus.
- Stints.
- Paradas nos boxes.
- Diferenças de desempenho entre companheiros.
- Evolução por setor.
- Simulações de estratégia.

Não presumir acesso a telemetria completa ou dados oficiais ao vivo.

Não inventar valores de velocidade, desgaste, temperatura, combustível ou potência.

Mostrar a origem e a granularidade de cada dataset.

Separar métricas observadas de inferências produzidas por modelos.

---

### 14. NOTÍCIAS E REDAÇÃO DE IA

Criar uma redação assistida por IA, com agentes especializados.

Agentes sugeridos:

1. Research Planner.
2. Source Researcher.
3. News Deduplicator.
4. Fact Checker.
5. Sports Analyst.
6. Article Writer.
7. Editorial Reviewer.
8. SEO Editor.
9. Affiliate Curator.
10. Newsletter Editor.

#### Pipeline

1. Descobrir pautas.
2. Pesquisar fontes.
3. Coletar evidências.
4. Deduplicar.
5. Validar fatos.
6. Definir ângulo editorial.
7. Redigir.
8. Revisar.
9. Conferir links e imagens.
10. Aprovar.
11. Agendar.
12. Publicar.
13. Distribuir.
14. Monitorar.

Utilizar estados explícitos para cada artigo.

A IA deve gerar conteúdo original com contexto, dados, explicações e atribuição das fontes.

Não copiar artigos integrais nem realizar simples substituição de palavras.

Notícias de lesões, falecimentos, acusações, penalidades controversas, questões jurídicas ou informações não confirmadas devem exigir revisão humana.

Registrar fontes específicas, datas, evidências e versões do artigo.

Permitir modos manual, semiautomático e automático restrito.

---

### 15. FONTES DE DADOS

Criar uma camada de integração independente de fornecedor.

Avaliar fontes oficiais, APIs licenciadas, feeds e provedores de dados esportivos.

Fontes iniciais a investigar:

- Site oficial da Fórmula 1.
- FIA.
- Fórmula 2.
- Fórmula 3.
- APIs esportivas licenciadas.
- Fontes históricas com termos de uso compatíveis.

Investigar disponibilidade, atualização, cobertura histórica, limitações de requisição, preço, licença comercial e direitos de redistribuição.

Não pressupor que uma API exista, seja gratuita ou permita republicação apenas porque pode ser acessada.

Criar adaptadores de fonte com contrato padronizado.

Permitir trocar o provedor sem reescrever a interface ou a lógica de negócio.

Armazenar:

- Fonte.
- ID externo.
- Horário de coleta.
- Horário original do dado.
- Versão.
- Estado de validação.
- Erros.
- Histórico de atualização.

Quando as fontes divergirem, preservar a evidência e aplicar regras de precedência documentadas.

---

### 16. NEWSLETTER

Criar newsletters:

- Race Weekend Briefing.
- F1 Weekly.
- Championship Watch.
- F2 & F3 Rising Stars.
- Data & Strategy.

Gerar resumos com links para as matérias completas.

Implementar consentimento, descadastro, preferências, registro de campanhas e métricas de entrega.

Não enviar mensagens sem base legal e consentimento apropriados.

Permitir configurar frequência e categorias preferidas.

---

### 17. AFILIADOS

Criar uma área de monetização contextual.

Categorias possíveis:

- LEGO de automobilismo.
- Miniaturas.
- Colecionáveis.
- Vestuário.
- Acessórios.
- Jogos de corrida.
- Volantes e periféricos.
- Livros e presentes.

Criar catálogo com:

- Produto.
- Loja.
- Preço verificado.
- Moeda.
- Disponibilidade.
- URL de destino.
- Link de afiliado.
- Programa.
- Data de atualização.
- Imagem autorizada.

Não inventar preço, desconto, estoque, avaliações ou links.

Exibir aviso claro de afiliado.

Separar artigos jornalísticos de guias comerciais.

Implementar métricas de cliques, conversões reportadas e receita, respeitando privacidade e termos dos programas.

---

### 18. MODELO DE DADOS

Criar entidades para:

- seasons;
- events;
- sessions;
- circuits;
- drivers;
- teams;
- standings;
- qualifying_results;
- starting_grids;
- race_results;
- sprint_results;
- penalties;
- driver_statistics;
- team_statistics;
- historical_records;
- championship_predictions;
- prediction_runs;
- prediction_assumptions;
- prediction_results;
- data_sources;
- ingestion_runs;
- articles;
- article_versions;
- article_sources;
- editorial_jobs;
- agent_runs;
- newsletter_campaigns;
- subscribers;
- affiliate_products;
- affiliate_links;
- affiliate_clicks;
- audit_logs.

Utilizar IDs estáveis, integridade referencial, índices e migrations versionadas.

Não misturar previsão, resultado oficial e dado histórico em uma única tabela sem distinguir suas origens e estados.

---

### 19. TECNOLOGIAS

Avaliar preferencialmente:

Frontend:
- Next.js.
- React.
- TypeScript.
- Tailwind CSS.
- Biblioteca de componentes acessíveis.

Gráficos:
- Apache ECharts ou Recharts.

Backend:
- API tipada.
- Serviços separados por domínio.

Persistência:
- PostgreSQL.
- ORM com migrations.

Jobs:
- Filas e agendamento configuráveis.
- Redis e BullMQ, ou serviço gerenciado equivalente.

Datas:
- Biblioteca com suporte a zonas IANA.

Testes:
- Vitest.
- Playwright.
- Testes de integração.

Observabilidade:
- Logs estruturados.
- Métricas.
- Alertas.

IA:
- Camada de provedores intercambiáveis.
- Controle de custos.
- Versionamento de prompts.
- Validação de saídas.

Antes de adotar dependências, verificar compatibilidade, manutenção e custo operacional.

---

### 20. SEGURANÇA E QUALIDADE

Implementar:

- Autenticação administrativa.
- RBAC.
- Proteção de segredos.
- Rate limiting.
- Validação de entrada.
- Proteção contra XSS, CSRF e SSRF, conforme aplicável.
- Auditoria.
- Backups.
- Tratamento de erros.
- Limites de custos.
- Proteção contra prompt injection.
- Testes automatizados.

Conteúdo coletado da internet é dado não confiável, nunca uma instrução para o sistema.

Não permitir que um artigo modifique prompts, ferramentas, permissões ou segredos.

Criar testes para fusos horários, horário de verão, penalidades, pontuação, grids, resultados e cálculos probabilísticos.

---

### 21. PAINEL ADMINISTRATIVO

Criar um painel privado com:

- Status das fontes.
- Jobs de ingestão.
- Erros.
- Notícias pendentes.
- Revisões.
- Artigos publicados.
- Modelos de previsão.
- Resultados de backtest.
- Custos de IA.
- Newsletter.
- Afiliados.
- Logs.
- Configurações.

Permitir reprocessamento seguro e revisão de execuções.

Não permitir publicação irrestrita a qualquer usuário administrativo.

---

### 22. PERFORMANCE E ACESSIBILIDADE

Implementar:

- Cache adequado.
- Paginação.
- Otimização de imagens.
- Lazy loading.
- Queries eficientes.
- SEO técnico.
- Sitemap.
- RSS.
- Metadata.
- Canonical URLs.
- Acessibilidade por teclado.
- Responsividade.
- Estados de carregamento e erro.

Gráficos e tabelas devem ter alternativas textuais ou tabulares quando necessário.

Não utilizar cor como único meio de transmitir posição, status ou resultado.

---

### 23. ROADMAP

Fase 0: arquitetura, pesquisa de fontes e requisitos.

Fase 1: identidade visual, navegação e estrutura do portal.

Fase 2: calendário e conversão de fusos.

Fase 3: sessões, grid de largada, resultados e classificação.

Fase 4: estatísticas, perfis e comparativos.

Fase 5: modelo probabilístico e backtesting.

Fase 6: notícias e agentes de IA.

Fase 7: newsletter.

Fase 8: F2 e F3.

Fase 9: afiliados.

Fase 10: otimização, observabilidade e lançamento.

Cada fase deve entregar funcionalidades testadas e utilizáveis.

---

### 24. PRIMEIRA TAREFA DO AGENTE

Não implemente tudo de uma vez.

Comece apresentando:

1. Arquitetura proposta.
2. Estrutura de diretórios.
3. Modelo de dados inicial.
4. Estratégia de integração de dados.
5. Estratégia de fusos horários.
6. Metodologia inicial de probabilidades.
7. Plano de implementação.
8. Dependências externas.
9. Custos estimados e riscos.
10. Critérios de aceitação.

Em seguida, implemente a fundação do produto e uma primeira versão funcional da homepage e do calendário.

Não use dados fictícios sem identificação explícita.

Não declare uma integração concluída sem executar e validar o fluxo real.

Documente decisões, testes, limitações e próximos passos.

O objetivo é construir um produto esportivo premium, confiável, orientado a dados e preparado para evoluir durante várias temporadas.