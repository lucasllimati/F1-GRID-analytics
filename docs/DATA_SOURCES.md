# Fontes de dados

Verificado em 2026-10-10.

## Dados esportivos

| Fonte | Status | Cobertura | Licença / limites | Uso atual |
|---|---|---|---|---|
| **Jolpica-F1** (`api.jolpi.ca/ergast/f1`) | ✅ integrada | 1950–presente: calendário (UTC), resultados, sprint, classificação, standings | Projeto comunitário aberto (sucessor da Ergast). ~4 req/s e ~500 req/h. **Confirmar uso comercial com os mantenedores antes do lançamento.** | Tudo que é esportivo |
| Formula1.com | ❌ não integrada | oficial | Sem API pública documentada; termos restringem reuso | — |
| FIA (documentos) | ❌ | decisões, grids oficiais (PDF) | Documentos públicos, sem API | Futuro: grid oficial pré-corrida |
| OpenF1 | ❌ avaliar | telemetria/timing desde 2023 | Verificar licença comercial | Futuro: análises técnicas |
| F2 / F3 | ❌ | — | Sem fonte licenciada identificada | Páginas não exibem dados |

Precedência quando houver mais de uma fonte (futuro): documento oficial da FIA > fonte oficial F1 > API licenciada > API comunitária. Divergências devem ser preservadas como evidência.

**Como consumimos a Jolpica (resiliência)**: no máximo 2 requisições simultâneas e ≥ 300 ms entre inícios (abaixo do limite público); timeout de 15 s; até 3 novas tentativas com backoff exponencial + jitter em 429/5xx/rede, respeitando `Retry-After`; disjuntor que pausa as consultas por 60 s após 5 falhas seguidas. Resultados normalizados ficam em cache por 10–30 min (invalidáveis no painel). A consistência é verificada por `npm run data:check` e exibida no painel.

**Limitações conhecidas da Jolpica**: o grid de largada só aparece junto com o resultado da corrida; não há estado ao vivo; a classificação publicada pode atrasar algumas horas após a corrida.

## Feeds de notícias

| Fonte | Feed | Grupo | Observações |
|---|---|---|---|
| Formula1.com | `/en/latest/all.xml` | fom | oficial; **sem `pubDate`** (data marcada como desconhecida) |
| FIA | `/rss/press-release` | fia | oficial; multiesporte → exige menção à F1 |
| Autosport | `/rss/f1/news/` | motorsport-network | |
| Motorsport.com | `/rss/f1/news/` | motorsport-network | |
| Motorsport.com Brasil | `motorsport.uol.com.br/rss/f1/news/` | motorsport-network | pt-BR |
| BBC Sport | `feeds.bbci.co.uk/sport/formula1/rss.xml` | bbc | |
| The Race | `/rss/` | the-race | multiesporte → exige menção à F1 |

Testados e **não usados**: RaceFans (403 para bots), PlanetF1 (feed 404), Grande Prêmio (feed sem itens), ge.globo (sem RSS de F1).

Para adicionar uma fonte: incluir em `src/lib/news/sources.ts` (com `group` e `articleHosts`), confirmar termos de uso e rodar `npm run news:ingest`.
