# Apex Grid — Arquitetura (Fase 0/1)

Documento de decisões da primeira entrega, cobrindo os 10 itens pedidos na seção 24 do prompt mestre.

## 1. Arquitetura proposta

Monólito modular em **Next.js 15 (App Router) + TypeScript**, com domínios isolados em `src/lib`:

```
            ┌──────────────── Navegador ────────────────┐
            │ Fuso (IANA, localStorage) · Countdown     │
            │ Tabelas ordenáveis · Tema                 │
            └───────────────▲───────────────────────────┘
                            │ HTML (RSC) + ilhas client
┌───────────────────────────┴──────────────────────────────────────┐
│ Next.js (Node runtime)                                           │
│  app/ (páginas públicas, /admin, /api/cron/news, feed, sitemap)  │
│                                                                  │
│  lib/f1 ── contrato F1DataProvider ── providers/jolpica (HTTP)   │
│     schedule · points · probability (Monte Carlo)                │
│  lib/news ── pipeline: ingest → cluster → evidence → writer      │
│              → fact-check → policy → publish/review              │
│     ai.ts (EditorialAI) ── AnthropicEditorialAI                  │
│  lib/net/safe-fetch (allowlist, robots.txt, limites)             │
│  lib/auth (scrypt, sessão HMAC, rate limit) · audit              │
└───────────────┬───────────────────────────────┬──────────────────┘
                │ Prisma                        │ HTTPS (allowlist)
         SQLite (dev) / PostgreSQL       Jolpica API · 7 feeds RSS · Claude API
```

- **Dados esportivos** são lidos sob demanda da fonte com cache do Next (ISR, 5–60 min). Nesta fase não são persistidos — ver riscos.
- **Notícias** são persistidas: fontes, itens brutos, pautas, artigos, versões, afirmações checadas, execuções de agentes, auditoria.
- O pipeline roda por **cron HTTP autenticado** (`/api/cron/news`, Vercel Cron a cada 30 min), pelo **painel** ou pela **CLI** (`npm run news:cycle`).

## 2. Estrutura de diretórios

```
prisma/                 schema + migrations versionadas
scripts/                CLI: create-admin, news-cycle
src/app/                rotas (páginas públicas, admin, api, feed.xml, sitemap, robots)
src/components/         UI (server e client)
src/lib/f1/             tipos de domínio, adaptador Jolpica, calendário, pontuação, modelo
src/lib/news/           fontes, RSS, deduplicação, política editorial, prompts, IA, pipeline
src/lib/net/            fetch defensivo (anti-SSRF, robots.txt)
src/lib/auth/           senha, sessão, rate limit, guarda de rotas
tests/                  Vitest (unitários + integração do pipeline com SQLite real)
docs/                   este diretório
```

## 3. Modelo de dados inicial

Implementado em `prisma/schema.prisma`: `NewsSource`, `FeedItem`, `Story`, `Article`, `ArticleVersion`, `ArticleSource`, `ArticleClaim`, `AgentRun`, `IngestionRun`, `AdminUser`, `AuditLog`.

Princípios aplicados: IDs estáveis (cuid / slug de fonte), integridade referencial, índices nas consultas quentes, migrations versionadas, estados explícitos (`src/lib/news/states.ts`), e separação entre **dado bruto de terceiros** (`FeedItem`, não confiável), **texto próprio** (`Article`/`ArticleVersion`) e **evidência de checagem** (`ArticleClaim`).

Entidades esportivas (seasons, events, results, standings, predictions…) ficam para a fase 3, quando houver persistência e histórico — hoje o domínio está tipado em `src/lib/f1/types.ts` e é preenchido pelo adaptador.

## 4. Estratégia de integração de dados

- Contrato `F1DataProvider` (`src/lib/f1/types.ts`); o adaptador Jolpica valida a resposta com Zod e converte para tipos de domínio. Trocar de fornecedor = novo adaptador + 1 linha em `service.ts`.
- Estados especiais de resultado (abandono, DSQ, DNS…) viram `ResultOutcome` tipado, nunca posição/tempo fictícios.
- Fontes de notícias em `src/lib/news/sources.ts`, com **grupo editorial** para medir independência.
- Detalhes e licenças: [DATA_SOURCES.md](DATA_SOURCES.md).

## 5. Estratégia de fusos horários

- Horários armazenados/transportados em **UTC ISO-8601**, como a fonte publica.
- Conversão exclusivamente via `Intl.DateTimeFormat` com zonas **IANA** (`src/lib/time.ts`); nenhuma soma de horas fixas.
- Fuso do circuito via mapa `circuitId → IANA` (`src/lib/f1/circuits.ts`); circuito desconhecido → `null` (não inventamos).
- `zonedLocalToUtc` cobre fontes que só publicam horário local: rejeita horários inexistentes na transição de verão e resolve ambíguos para a primeira ocorrência (testado).
- Preferência do usuário (Brasília / navegador / circuito / IANA personalizado + até 3 comparações) em `localStorage`; servidor sempre renderiza Brasília e o cliente ajusta após montar (sem erro de hidratação). Sem geolocalização.

## 6. Metodologia inicial de probabilidades

Monte Carlo com Plackett-Luce ponderado por recência, choque de equipe compartilhado (correlação entre companheiros), taxa de abandono com prior Beta e desempate por countback. Chance **matemática** calculada separadamente e de forma exata. Detalhes: [PROBABILITY.md](PROBABILITY.md).

## 7. Plano de implementação

| Fase | Entrega | Estado |
|---|---|---|
| 0 | Arquitetura, pesquisa de fontes | ✅ este documento |
| 1 | Identidade, navegação, estrutura | ✅ |
| 2 | Calendário + fusos | ✅ |
| 3 | Sessões, grid, resultados, classificação | ✅ leitura da fonte; ⏳ persistência própria e histórico |
| 4 | Estatísticas, perfis, head-to-head | ⏳ |
| 5 | Modelo probabilístico + backtesting | ✅ v1 · ⏳ backtest |
| 6 | Notícias e agentes de IA | ✅ pipeline completo |
| 7 | Newsletter | ⏳ |
| 8 | F2 e F3 | ⏳ (sem fonte licenciada) |
| 9 | Afiliados | ⏳ |
| 10 | Observabilidade e lançamento | parcial (auditoria, custos, execuções no painel) |

## 8. Dependências externas

| Dependência | Uso | Observação |
|---|---|---|
| Jolpica-F1 API | calendário, resultados, classificação | gratuita, comunitária; limites ~4 req/s, 500 req/h |
| Feeds RSS (7) | monitoramento de notícias | públicos; ver política em NEWSROOM.md |
| Anthropic Claude API | Redator e Verificador | opcional; sem chave o sistema só monitora |
| Google Fonts (build) | Inter, Barlow Condensed, JetBrains Mono | baixadas no build e servidas localmente pelo Next |
| npm: next, react, prisma, zod, fast-xml-parser, @anthropic-ai/sdk, tailwindcss, vitest | — | versões fixadas por major |

## 9. Custos estimados e riscos

**IA (estimativa, não medição):** ~12–15 mil tokens de entrada e ~3–5 mil de saída por agente → cerca de **US$ 0,20–0,30 por artigo** com `claude-opus-5-5` (US$ 4/20 por milhão). Com o teto padrão de 24 artigos/dia: até ~US$ 7/dia. O custo **real** de cada execução é registrado em `AgentRun` e exibido no painel. Limites: `NEWS_MAX_ARTICLES_PER_RUN`, `NEWS_MAX_ARTICLES_PER_DAY`.

**Riscos principais**

1. *Licença dos dados esportivos*: a Jolpica é comunitária; uso comercial e redistribuição precisam de confirmação antes do lançamento.
2. *Direitos autorais das notícias*: só exibimos título + link das fontes; o texto completo é usado apenas como evidência interna quando o robots.txt permite. Termos de uso de cada veículo devem passar por revisão jurídica antes de operar comercialmente.
3. *Erros factuais da IA*: mitigados por checagem independente, regras determinísticas, revisão humana obrigatória para temas sensíveis e política de correção. Risco residual não é zero.
4. *Rate limit / indisponibilidade da fonte*: páginas exibem estado de erro honesto; nenhuma estimativa substitui dado oficial.
5. *Escala*: rate limit e trava de pipeline em memória/BD servem para uma instância; produção multi-instância requer Redis (docs/SECURITY.md).

## 10. Critérios de aceitação (desta entrega)

- [x] Calendário da temporada atual exibido a partir da fonte real, com formatos Sprint/tradicional corretos e sem sessões inventadas.
- [x] Horários convertidos por IANA com testes de horário de verão (Melbourne, Londres, Brasília histórico).
- [x] Contagem regressiva calculada no navegador, nunca negativa, sem afirmar "ao vivo".
- [x] Resultados com estados especiais preservados; grid oficial ou mensagem de indisponibilidade.
- [x] Probabilidades com metodologia, número de simulações, versão, hipóteses e limitações visíveis.
- [x] Pipeline de notícias executado contra os **feeds reais** (7/7 fontes OK, 164 itens, 91 pautas) e testado ponta a ponta com IA simulada em SQLite real.
- [ ] Redação com a API real do Claude — **não validada nesta máquina** (sem `ANTHROPIC_API_KEY`). Ver README → "Validar a redação com IA".
- [x] Admin com login, sessão httpOnly, RBAC, rate limit e proteção CSRF verificados contra o servidor de produção local.
- [x] `npm run build`, `tsc` e 78 testes passando.
