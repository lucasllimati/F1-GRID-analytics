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

## Validar a redação com IA

Sem chave, o sistema monitora e agrupa pautas, mas não escreve. Para ativar:

1. Coloque `ANTHROPIC_API_KEY` no `.env` (modelo padrão: `claude-opus-5-5`).
2. Comece em `NEWS_PUBLISH_MODE="semi"` — tudo vai para revisão em `/admin`.
3. Rode `npm run news:cycle` e revise alguns textos e a checagem de fatos no painel.
4. Quando estiver satisfeito com a qualidade, mude para `auto_restricted`.

As chamadas usam *structured outputs* e o fallback do servidor para recusas (`fallbacks: "default"`).

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | 78 testes (fusos/DST, pontuação, modelo, RSS, deduplicação, política editorial, segurança, pipeline integrado) |
| `npm run lint` | checagem de tipos |
| `npm run news:ingest` | monitora as 7 fontes e agrupa pautas |
| `npm run news:cycle` | ciclo completo (monitorar → redigir → checar → publicar/revisar) |
| `npm run admin:create` | cria/atualiza usuário da redação |
| `npm run db:migrate` / `db:deploy` | migrations |

## Páginas

`/` · `/race-center` · `/calendar` · `/calendar/[ano]/[etapa]` · `/results` · `/standings` · `/championship-probabilities` · `/news` · `/news/[slug]` · `/sources` · `/methodology` · `/about` · `/privacy` · `/feed.xml` · `/admin`

## Documentação

- [Arquitetura, plano, custos, riscos e critérios de aceitação](docs/ARCHITECTURE.md)
- [Redação automatizada e política editorial](docs/NEWSROOM.md)
- [Fontes de dados e licenças](docs/DATA_SOURCES.md)
- [Modelo de probabilidade](docs/PROBABILITY.md)
- [Segurança](docs/SECURITY.md)
- [Deploy](docs/DEPLOY.md)

## Limitações atuais

- Redação com a API real ainda não validada neste ambiente (sem chave).
- Dados esportivos lidos da Jolpica com cache, sem persistência própria nem histórico de previsões.
- Modelo de probabilidade sem backtest publicado.
- F2/F3, estatísticas históricas, perfis, head-to-head, newsletter e afiliados ainda não implementados — essas seções não aparecem na navegação para não exibir páginas vazias.
