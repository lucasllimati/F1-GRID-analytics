# Diagnóstico técnico e preparação para produção

Auditoria de 2026-10-11 sobre o projeto existente. Escopo deliberado: **somente mudanças essenciais**, preservando todos os fluxos recentes (comparativo, redação com Gemini, painel, notícias).

## 1. Linha de base (antes das mudanças)

| Verificação | Resultado |
|---|---|
| `tsc --noEmit` | ✅ sem erros |
| Testes (Vitest) | ✅ 104/104 |
| Build de produção | ✅ (17 páginas) |
| `npm audit --omit=dev` | ⚠️ 5 alertas (1 moderado, 4 altos) |
| Varredura de rotas (103 URLs: 23 etapas × abas, sprints, temporadas 2010–2026, 404s, proteção) | ✅ 0 falhas |
| Consistência de dados 2026/2025 (pontos, ordem, calendário) | ✅ confere com a classificação oficial |

## 2. Problemas encontrados e corrigidos

| # | Problema | Gravidade | Correção | Evidência |
|---|---|---|---|---|
| 1 | Fonte esportiva sem resiliência: falha momentânea virava erro de página; nenhuma proteção contra martelar a API | Alta | Novas tentativas limitadas (backoff exponencial + jitter, respeita `Retry-After`), disjuntor (5 falhas → pausa 60 s), timeout 15 s | `tests/reliability.test.ts` |
| 2 | **Rajadas acima do limite da Jolpica (HTTP 429)** com cache frio — reproduzido ao validar 2025 e 2021 | Alta | Limitador: 2 requisições simultâneas, ≥ 300 ms entre inícios | `npm run data:check -- 2025` passou de 429 para OK |
| 3 | Regressão que eu mesmo introduzi com o limitador (páginas de 0,3 s → 3–7 s) | Alta | Cache do resultado normalizado por consulta (`unstable_cache` com a tag de invalidação) | páginas quentes 0,10–0,27 s |
| 4 | PostCSS vulnerável dentro do Next 15 | Moderada (build-time, entrada confiável) | `overrides` para `postcss ^8.5.29` (mesma major) | `npm ls postcss` |
| 5 | Sem validação automática de consistência dos dados | Alta | `src/lib/f1/validate.ts`: calendário, duplicatas, pontos × regra da temporada, soma e ordem × classificação oficial | `npm run data:check`; detectou corretamente os meio-pontos de Spa 2021 |
| 6 | Logs não estruturados | Média | Logger JSON com mascaramento de segredos e `requestId` por ciclo | `src/lib/log.ts` |
| 7 | Sem health check | Média | `GET /api/health` (estados agregados, sem detalhes internos; 503 se o banco cair) | smoke |
| 8 | Painel sem estado do sistema nem alertas | Média | Seção "Estado do sistema": checks medidos + alertas com gravidade, componente e ação | painel |
| 9 | Navegação sem indicação da seção atual | Baixa (UX/a11y) | Destaque visual + `aria-current="page"` | teste de rota ativa |
| 10 | Sem CI, sem teste de fumaça, sem runbook | Média | `.github/workflows/ci.yml`, `npm run smoke`, `docs/RUNBOOK.md` | smoke 22/22 |

## 3. Riscos residuais (aceitos ou pendentes)

| Risco | Situação | Mitigação atual |
|---|---|---|
| `deepmerge-ts` (via `@prisma/config`) — 3 alertas altos | Aceito: afeta só a leitura da configuração do Prisma, com entrada própria e confiável; a "correção" sugerida rebaixa o Prisma | Reavaliar ao migrar para Prisma 7+ |
| Licença comercial da Jolpica não confirmada | Pendente (externo) | Documentado em DATA_SOURCES.md |
| Termos de uso dos veículos de notícia | Pendente (jurídico) | Só manchete + link; texto completo apenas como evidência interna, respeitando robots.txt |
| Disjuntor, limitador e rate limit de login são **por instância** (memória) | Aceitável em 1 instância | Com várias instâncias: Redis (SECURITY.md) |
| Alertas sem histórico/reconhecimento (são recalculados a cada acesso) | Pendente | Painel deixa a limitação explícita |
| Sem notificação externa (e-mail/Telegram) | Pendente: depende de conta/canal | `/api/health` pode ser ligado a um monitor de uptime |
| Sem métricas de CPU/memória, Core Web Vitals de campo, monitoramento de erros do frontend | Pendente | Não exibimos indicadores que não medimos |
| Sem testes E2E com navegador (Playwright) | Pendente | Smoke HTTP + testes de integração + screenshots manuais |
| Modelo de probabilidades sem backtest | Pendente | Página marca como experimental |
| CSP com `'unsafe-inline'` em scripts | Pendente | Exige nonce no Next; sem scripts de terceiros |
| Sem MFA no painel | Pendente | Senha ≥ 12, scrypt, rate limit, sessão httpOnly/SameSite=Strict |

Nenhuma afirmação de "sem bugs" ou "totalmente seguro": o acima é o que foi verificado e o que não foi.

## 4. Próximas fases sugeridas (por prioridade)

1. Backtest do modelo de probabilidades (Brier/log loss, 2014–2025) e evolução da probabilidade por etapa.
2. Persistir dados esportivos no banco (ingestão agendada + validação antes de publicar), reduzindo dependência da Jolpica em tempo real.
3. Alertas persistidos com estados (novo/reconhecido/resolvido) e notificação por e-mail/Telegram com deduplicação.
4. Playwright para as jornadas críticas (home → fuso → calendário → etapa → comparar; login → aprovar).
5. Páginas de piloto/equipe/circuito e "Apex Grid Lab" (o comparativo atual é a base).
6. MFA para administradores e CSP com nonce.
