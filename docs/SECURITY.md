# Segurança

| Ameaça | Controle | Onde |
|---|---|---|
| Acesso ao painel | scrypt (N=16384), sessão HMAC-SHA256 com expiração de 8h, cookie `httpOnly` + `SameSite=Strict` + `Secure` em produção, usuário reconsultado no banco a cada requisição | `src/lib/auth/*` |
| Força bruta | 5 tentativas / 15 min por IP; tempo de verificação constante mesmo para e-mail inexistente | `rate-limit.ts`, `admin/actions.ts` |
| Privilégio | RBAC `editor`/`admin`; publicar texto sensível, operar fontes e rodar pipeline exigem admin | `editorial.ts`, `actions.ts` |
| CSRF | Server Actions (POST + checagem Origin×Host do Next) + `SameSite=Strict` | verificado com origem forjada → rejeitado |
| XSS | React escapa tudo; renderizador de Markdown próprio sem HTML; JSON-LD com `<` escapado; CSP restritiva | `article-body.tsx`, `next.config.ts` |
| SSRF | Somente HTTPS, hosts em lista fechada, sem credenciais/porta, redirecionamentos revalidados, limite de tamanho e tempo | `src/lib/net/safe-fetch.ts` |
| XML malicioso | Feeds com `<!ENTITY` rejeitados; entidades não expandidas pelo parser | `rss.ts` |
| Prompt injection | ver docs/NEWSROOM.md | `prompts.ts`, `ai.ts` |
| Endpoint de cron | `Authorization: Bearer CRON_SECRET` comparado em tempo constante; fechado se o segredo não estiver configurado | `api/cron/news` |
| Segredos | Só em variáveis de ambiente lidas no servidor; `.env` no `.gitignore` | `env.ts` |
| Custos de IA | limites por ciclo e por dia; custo por execução registrado | `pipeline.ts` |
| CSV injection | células iniciadas por `= + - @` são prefixadas | `results-table.tsx` |
| Auditoria | login, falhas de login, ações editoriais, publicação automática, operações de fonte | `AuditLog` |

## Pendências para produção

- Rate limit e trava do pipeline distribuídos (Redis) se houver mais de uma instância.
- CSP com nonce (remover `'unsafe-inline'` de `script-src`).
- Backups automáticos do PostgreSQL e teste de restauração.
- 2FA para administradores.
- Alertas (falha de fonte por > N ciclos, custo diário acima do limite).
