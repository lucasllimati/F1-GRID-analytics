# Redação automatizada — funcionamento e política

## Fluxo

```
feeds RSS ──► FeedItem ──► filtro (promoções, apostas, ao vivo, fora da F1)
                 │
                 ▼
           Story (deduplicação: Jaccard de tokens + nomes próprios, janela 48h)
                 │  elegível? fonte oficial OU ≥2 grupos editoriais independentes
                 │  maturada? ≥30 min desde a primeira publicação (ou fonte oficial)
                 ▼
     evidência: página original (só se robots.txt permitir) → texto interno
                 ▼
     Agente Redator (pt-BR, só fatos das fontes, atribuição, sem cópia)
                 ▼
     Agente Verificador (independente: extrai TODAS as afirmações e checa)
                 ▼
     Regras determinísticas (src/lib/news/policy.ts)
        ├─ tudo OK e modo auto_restricted ──► published
        └─ qualquer falha ──► in_review (com os motivos) ──► editor humano
```

Estados do artigo: `drafting → fact_checking → in_review | published`, e depois `approved`, `rejected`, `retracted`, `failed`. As transições permitidas estão em `src/lib/news/states.ts`.

## Regras de publicação automática

Todas precisam passar (`decidePublication`):

| Regra | Limite |
|---|---|
| Modo | `NEWS_PUBLISH_MODE=auto_restricted` |
| Fontes | oficial (F1/FIA) **ou** ≥ 2 grupos editoriais distintos |
| Checagem | 0 afirmações sem suporte, contraditas ou não verificáveis; ≥ 3 afirmações |
| Confiança do verificador | ≥ 0,8 |
| Números e atribuição | consistentes / adequados |
| Tema sensível | nenhum (detector por palavras-chave **e** marcação do redator) |
| Cópia | ≤ 6% de 8-gramas em comum e nenhum trecho contínuo > 14 palavras |
| Tamanho | 180–1200 palavras |
| Volume | ≤ `NEWS_MAX_ARTICLES_PER_DAY` publicações automáticas em 24h |

Temas sensíveis (sempre revisão humana): morte, lesão/saúde, questão jurídica, acusação/investigação, penalidade ou recurso controverso, informação não confirmada (rumor, negociação, "segundo fontes").

Publicação de texto sensível exige papel **admin**; editores publicam apenas textos não sensíveis.

## Defesas contra prompt injection

- Conteúdo externo é delimitado e tem `<`/`>` neutralizados (não consegue "fechar" o bloco de dados).
- Os prompts de sistema declaram o material como dado não confiável.
- Os agentes **não têm ferramentas**: não acessam rede, banco, segredos nem permissões.
- Saída restrita a um esquema (structured outputs) e revalidada localmente com Zod.
- HTML, links e imagens são removidos do corpo; o renderizador não usa `dangerouslySetInnerHTML`.
- Mesmo uma saída manipulada ainda passa pelo verificador independente e pelas regras determinísticas.

## O que nunca fazemos

- Republicar ou exibir o texto das fontes (o radar mostra apenas a manchete com link).
- Inventar datas: quando o feed não informa a data (caso da Formula1.com), registramos `publishedAtKnown=false` e exibimos "coletado"/"consultado".
- Baixar páginas quando o robots.txt bloqueia ou não pode ser lido.
- Apagar silenciosamente: correções ficam registradas; despublicação mantém a página com aviso.

## Operação

- `npm run news:ingest` — só monitora e agrupa.
- `npm run news:cycle` — ciclo completo conforme o modo.
- Painel `/admin`: fila de revisão, pautas abertas, fontes (ativar/desativar), execuções, falhas de agentes, custos.
- Prompts versionados em `src/lib/news/prompts.ts`; a versão usada fica registrada em cada `AgentRun`.
