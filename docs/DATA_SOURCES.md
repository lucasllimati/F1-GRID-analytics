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

## Feeds de notícias (28 fontes · verificadas em 2026-10-12)

Cada feed foi testado com o parser do projeto: responde 200, itens com data e links do próprio domínio, e a matéria mais recente tem menos de 7 dias. "Multi" = cobre várias categorias; só itens que mencionam F1 (categoria, equipe, piloto ou chefe de equipe) entram.

| Região | Fonte | Idioma | Grupo editorial | Cobertura |
|---|---|---|---|---|
| Oficial | Formula1.com | en | fom | F1 · **sem `pubDate`** (data marcada como desconhecida) |
| Oficial | FIA (comunicados) | en | fia | Multi |
| Oficial | Pirelli Motorsport (imprensa) | en | pirelli | Multi · fornecedora oficial de pneus |
| Internacional | Autosport | en | motorsport-network | F1 |
| Internacional | Motorsport.com | en | motorsport-network | F1 |
| Internacional | BBC Sport | en | bbc | F1 |
| Internacional | The Race | en | the-race | Multi |
| Internacional | Sky Sports F1 | en | sky | F1 · datas em "BST" (tratado pelo parser) |
| Internacional | The Guardian | en | guardian | F1 |
| Internacional | ESPN F1 | en | espn | F1 |
| Internacional | RACER | en | racer | F1 |
| Internacional | Crash.net | en | crash | F1 |
| Internacional | PlanetF1 | en | planet-sport | Multi |
| Internacional | GPFans | en | gpfans | F1 |
| Internacional | RacingNews365 | en | racingnews365 | Multi (feed grande: ~300 itens) |
| Internacional | F1i.com | en | f1i | F1 |
| Internacional | Motorsport Week | en | motorsport-week | Multi |
| Internacional | Speedcafe | en | speedcafe | Multi (Austrália) |
| Europa | Motorsport.com España | es | motorsport-network | F1 |
| Europa | Marca | es | unidad-editorial | F1 |
| Europa | FormulaPassion | it | formulapassion | F1 |
| Europa | Formel1.de | de | motorsport-network | F1 |
| Brasil | Motorsport.com Brasil | pt-BR | motorsport-network | F1 |
| Brasil | ge (Globo) | pt-BR | globo | F1 |
| Brasil | Grande Prêmio | pt-BR | grande-premio | Multi |
| Brasil | Autoracing | pt-BR | autoracing | Multi |
| Brasil | F1Mania | pt-BR | f1mania | F1 |
| Brasil | Projeto Motor | pt-BR | projeto-motor | Multi (muitas matérias históricas) |

**Independência:** quatro fontes são da Motorsport Network (Autosport, Motorsport.com, Motorsport.com España/Brasil, Formel1.de) e contam como **uma** confirmação. Uma fonte oficial basta sozinha.

### Testadas e descartadas

| Fonte | Motivo |
|---|---|
| AS (Espanha) | feed parado desde junho de 2022 |
| Gazzetta dello Sport | feed parado desde setembro de 2023 |
| GrandPrix.com | responde 429 ("tráfego ocupado") de forma intermitente |
| RaceFans, L'Équipe | bloqueiam robôs (403) |
| Autosprint, Warm Up, Bandeirada, Tazio | sem resposta |
| Terra, UOL Esporte, Lance!, Motor1 Brasil | sem RSS de F1 (404/410) |
| Sites de equipes, F1 Academy, F2/F3, documentos da FIA | sem RSS público |
| Formula Nerds | blog de opinião (critério editorial) |

Para adicionar uma fonte: incluir em `src/lib/news/sources.ts` (com `group`, `region`, idioma e `requireF1Keyword`), confirmar os termos de uso e rodar `npm run news:ingest`. Fontes removidas do cadastro são desativadas automaticamente no próximo ciclo.

**Manutenção anual:** a lista de pilotos e chefes de equipe usada para reconhecer matérias de F1 em feeds multiesportivos fica em `src/lib/news/policy.ts` (`F1_KEYWORDS`) e deve ser revisada a cada temporada.
