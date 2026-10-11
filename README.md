# Apex Grid — Formula 1, decoded

Plataforma independente de Fórmula 1 em português: calendário no seu fuso, Race Center, resultados, grid, classificação, probabilidades de título e uma **redação automatizada** que monitora os principais veículos, escreve versões próprias das notícias com atribuição às fontes e só publica sozinha o que passa na checagem de fatos.

## Início rápido

```bash
npm install
cp .env.example .env          # preencha SESSION_SECRET e CRON_SECRET (comandos no arquivo)
npx prisma migrate dev        # cria o banco SQLite local
ADMIN_PASSWORD="uma-senha-longa-aqui" npm run admin:create -- --email voce@exemplo.com --name "Seu Nome" --role admin
npm run news:ingest           # primeira coleta real das fontes
npm run dev                   # http://localhost:3000
```

No PowerShell, defina a senha com `$env:ADMIN_PASSWORD="..."` antes do `admin:create`.

## Ativar a redação com IA

Sem IA configurada, o sistema monitora e agrupa pautas, mas não escreve. Provedores suportados (`NEWS_AI_PROVIDER`):

| Provedor | Uso indicado | Guia |
|---|---|---|
| `gemini` | **testes gratuitos** (padrão do `.env.example`) | [docs/GEMINI.md](docs/GEMINI.md) |
| `anthropic` | produção (`claude-opus-5-5`, structured outputs e fallback em recusas) | `ANTHROPIC_API_KEY` |
| `openai_compatible` | Ollama local, Groq, OpenRouter… | `NEWS_AI_BASE_URL`, `NEWS_AI_API_KEY`, `NEWS_AI_MODEL` |

Comece sempre em `NEWS_PUBLISH_MODE="semi"` (tudo vai para revisão em `/admin`). Só passe para `auto_restricted` depois de revisar a qualidade dos textos.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | 124 testes (fusos/DST, pontuação, modelo, RSS, deduplicação, política editorial, segurança, pipeline integrado) |
| `npm run lint` | checagem de tipos |
| `npm run news:ingest` | monitora as 7 fontes e agrupa pautas |
| `npm run news:cycle` | ciclo completo (monitorar → redigir → checar → publicar/revisar) |
| `npm run admin:create` | cria/atualiza usuário da redação |
| `npm run ai:check` | testa a conexão com a IA configurada |
| `npm run data:check` | valida a consistência dos dados esportivos da temporada contra a fonte |
| `npm run smoke` | teste de fumaça das rotas (use `SMOKE_BASE_URL` para produção) |
| `npm run db:migrate` / `db:deploy` | migrations |

## Páginas

`/` · `/race-center` · `/calendar` · `/calendar/[ano]/[etapa]` (Race Center da etapa) · `/results` (vencedores, poles e voltas mais rápidas da temporada) · `/standings` · `/championship-probabilities` · `/head-to-head` (comparar pilotos/equipes) · `/news` · `/news/[slug]` · `/sources` · `/methodology` · `/about` · `/privacy` · `/feed.xml` · `/admin`

## Documentação

- [Arquitetura, plano, custos, riscos e critérios de aceitação](docs/ARCHITECTURE.md)
- [Redação automatizada e política editorial](docs/NEWSROOM.md)
- [Fontes de dados e licenças](docs/DATA_SOURCES.md)
- [Modelo de probabilidade](docs/PROBABILITY.md)
- [Segurança](docs/SECURITY.md)
- [Deploy](docs/DEPLOY.md)
- [Runbook de operação](docs/RUNBOOK.md)
- [Diagnóstico técnico, riscos residuais e próximas fases](docs/DIAGNOSTICO.md)

Monitoramento: `GET /api/health` (para um monitor de uptime). CI: `.github/workflows/ci.yml`.

## Limitações atuais

- Redação com APIs reais (Claude ou Gemini) ainda não validada neste ambiente (sem chave); o adaptador foi testado com respostas simuladas.
- Dados esportivos lidos da Jolpica com cache, sem persistência própria nem histórico de previsões.
- Modelo de probabilidade sem backtest publicado.
- F2/F3, estatísticas históricas, perfis, head-to-head, newsletter e afiliados ainda não implementados — essas seções não aparecem na navegação para não exibir páginas vazias.
