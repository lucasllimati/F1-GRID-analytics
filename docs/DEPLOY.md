# Deploy

## Banco de dados em produção (PostgreSQL)

O desenvolvimento usa SQLite. Para PostgreSQL:

1. Em `prisma/schema.prisma`, troque `provider = "sqlite"` por `provider = "postgresql"`.
2. Mova `prisma/migrations` para um backup e gere uma baseline nova: `npx prisma migrate dev --name init` contra um Postgres de desenvolvimento.
3. Em produção: `DATABASE_URL=postgresql://...` e `npm run db:deploy`.

Os campos JSON estão como `String` por compatibilidade; podem migrar para `Json` no Postgres numa etapa futura.

## Vercel

1. Variáveis: `DATABASE_URL`, `SITE_URL`, `SESSION_SECRET` (≥32 chars), `CRON_SECRET` (≥24 chars), `ANTHROPIC_API_KEY`, `NEWS_PUBLISH_MODE`, limites.
2. `vercel.json` agenda `/api/cron/news` a cada 30 minutos (planos com cron frequente). A Vercel envia `Authorization: Bearer $CRON_SECRET` automaticamente.
3. Crie o primeiro admin localmente apontando para o banco de produção: `ADMIN_PASSWORD=... npm run admin:create -- --email ... --role admin`.

## Servidor próprio / Windows

- `npm run build && npm start`.
- Agende `npm run news:cycle` no cron do sistema (Linux) ou no Agendador de Tarefas (Windows), por exemplo a cada 30 minutos, ou chame o endpoint com `curl -H "Authorization: Bearer $CRON_SECRET" https://seu-site/api/cron/news`.
