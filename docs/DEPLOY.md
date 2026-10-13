# Publicar o Apex Grid na web

## Por que não dá para publicar "só no GitHub"

O GitHub Pages hospeda apenas sites **estáticos** (HTML pronto). O Apex Grid precisa de:

| Peça | Por quê | Onde roda |
|---|---|---|
| Servidor Next.js | páginas com dados ao vivo, painel com login, APIs | **Vercel** |
| Banco PostgreSQL | notícias, usuários, auditoria, execuções (o SQLite local não persiste em servidores na nuvem) | **Neon** (São Paulo) |
| Ciclo de notícias agendado | coletar fontes e redigir com IA a cada hora; pode passar de 5 min | **GitHub Actions** |
| Código, CI, segredos do agendamento | — | **GitHub** (você já tem) |

Tudo isso tem plano gratuito. Limites que importam (verificados em 2026-10-12):

- **Vercel Hobby (grátis):** só uso **pessoal, não comercial**; função até 5 min; cron no máximo 1×/dia (por isso o agendamento fica no GitHub). Com afiliados, anúncios ou patrocínio, use o **Pro (US$ 20/mês)**.
- **Neon Free:** sem cartão; 1 GB por projeto; o banco "dorme" após 5 min sem uso (a primeira consulta depois disso leva um instante a mais).
- **GitHub Actions:** grátis em repositório **público**. Em repositório **privado**, 2.000 min/mês — o ciclo de hora em hora usa perto disso; se o repositório for privado, mude o agendamento para a cada 2 horas (ver passo 4).

---

## Passo 1 — Banco de dados (Neon)

1. Crie uma conta em **https://neon.com** (pode entrar com o GitHub).
2. **Create project** → nome `apex-grid` → região **AWS South America (São Paulo)** → Postgres mais recente.
3. No painel do projeto, clique em **Connect** e copie **duas** strings:
   - **Pooled connection** (o host tem `-pooler`) → será o `DATABASE_URL`. Acrescente ao final: `&pgbouncer=true&connect_timeout=15` (ou `?…` se ainda não houver `?`).
   - **Direct connection** (sem `-pooler`) → será o `DIRECT_URL`.

As tabelas são criadas automaticamente no primeiro deploy (passo 3).

## Passo 2 — Gerar os segredos

No PowerShell, rode duas vezes e guarde os resultados:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- 1º valor → `SESSION_SECRET`
- 2º valor → `CRON_SECRET`

Escolha também a senha do painel de produção (12+ caracteres) → `ADMIN_PASSWORD`. Guarde tudo em `.local/CREDENCIAIS.md` (fora do Git).

## Passo 3 — Site (Vercel)

1. Crie uma conta em **https://vercel.com** entrando com o GitHub.
2. **Add New → Project** → importe `lucasllimati/F1-GRID-analytics`.
3. O `vercel.json` do projeto já define o build (`npm run build:vercel`: gera o cliente PostgreSQL, aplica as migrations e compila) e a região São Paulo (`gru1`). Não altere.
4. Em **Environment Variables**, adicione (ambiente *Production*):

| Variável | Valor |
|---|---|
| `DATABASE_URL` | string *pooled* do Neon (com `&pgbouncer=true&connect_timeout=15`) |
| `DIRECT_URL` | string *direct* do Neon |
| `SESSION_SECRET` | 1º segredo do passo 2 |
| `CRON_SECRET` | 2º segredo do passo 2 |
| `NEWS_AI_PROVIDER` | `gemini` |
| `GEMINI_API_KEY` | sua chave do AI Studio (use uma **nova**, a antiga apareceu na conversa) |
| `NEWS_PUBLISH_MODE` | `semi` |
| `NEWS_MAX_ARTICLES_PER_RUN` | `2` |
| `SITE_URL` | deixe em branco por enquanto (usa o domínio `.vercel.app` automaticamente); preencha quando tiver domínio próprio |

5. **Deploy**. Ao final, abra `https://SEU-PROJETO.vercel.app/api/health` — deve responder `"status":"ok"` ou `"degraded"` (degradado é normal até o primeiro ciclo de notícias rodar).

## Passo 4 — Agendamento das notícias (GitHub Actions)

No GitHub: repositório → **Settings → Secrets and variables → Actions**.

**Secrets** (aba *Secrets*, botão *New repository secret*):

| Nome | Valor |
|---|---|
| `DATABASE_URL` | mesma do Neon (pooled) |
| `DIRECT_URL` | mesma do Neon (direct) |
| `GEMINI_API_KEY` | sua chave |
| `ADMIN_PASSWORD` | senha do painel de produção |
| `OPENROUTER_API_KEY` | *(recomendado)* chave gratuita do OpenRouter — reserva de outra empresa quando o Gemini falhar ([docs/GEMINI.md](GEMINI.md#cadeia-de-reserva-quando-a-cota-acaba)) |

**Variables** (aba *Variables*, opcional — há valores padrão):

| Nome | Valor sugerido |
|---|---|
| `NEWS_PUBLISH_MODE` | `semi` |
| `NEWS_MAX_ARTICLES_PER_RUN` | `2` |
| `SITE_URL` | `https://SEU-PROJETO.vercel.app` |
| `NEWS_AI_FALLBACKS` | vazio (cadeia padrão) ou lista `provedor:modelo,…` |

O workflow **Ciclo de notícias** (`.github/workflows/news-cycle.yml`) roda de hora em hora no horário comercial (seg–sex, 8h–19h de Brasília), com janela maior no fim de semana de corrida (sex 20h → dom 23h) — ≈1.350 min/mês, dentro dos 2.000 gratuitos de repositório privado. Para testar agora: **Actions → Ciclo de notícias → Run workflow** (marque "Só buscar manchetes" na primeira vez).


> O GitHub desativa agendamentos de repositórios públicos sem nenhum commit por 60 dias. Se isso acontecer, aparece um aviso na aba Actions com o botão para reativar.

## Passo 5 — Criar seu usuário do painel em produção

**Actions → Criar usuário do painel → Run workflow** → informe e-mail, nome e papel `admin`. A senha usada é o secret `ADMIN_PASSWORD`. Depois entre em `https://SEU-PROJETO.vercel.app/admin/login`.

## Passo 6 (opcional) — Botão "Buscar e escrever notícias" do painel

Em produção, esse botão dispara o mesmo workflow do GitHub (sem o limite de 5 min da Vercel). Para habilitar:

1. GitHub → foto do perfil → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. *Repository access*: **Only select repositories** → `F1-GRID-analytics`. *Permissions → Repository → Actions*: **Read and write**. Expiração: 90 dias (renove depois).
3. Na Vercel, adicione `GITHUB_REPOSITORY` = `lucasllimati/F1-GRID-analytics` e `GITHUB_DISPATCH_TOKEN` = o token. Faça um *Redeploy*.

Sem o token, "Só buscar manchetes" funciona normalmente no painel; o ciclo completo fica a cargo do agendamento.

## Passo 7 — Verificar

```powershell
$env:SMOKE_BASE_URL="https://SEU-PROJETO.vercel.app"; npm run smoke
```

E no painel: "Estado do sistema" deve mostrar banco OK, configuração OK e o horário do último ciclo.

## Domínio próprio (opcional)

Vercel → projeto → **Settings → Domains** → adicione o domínio e siga as instruções de DNS (HTTPS é automático). Depois atualize `SITE_URL` na Vercel e no GitHub (variável) e faça um *Redeploy*.

---

## Atualizações do dia a dia

- **Código:** faça commit e `git push` na `main` → o CI testa e a Vercel publica sozinha. Rollback: Vercel → *Deployments* → deploy anterior → **Promote to Production**.
- **Mudanças no banco:** edite `prisma/schema.prisma`, aplique localmente com `npx prisma migrate dev` e gere a migration de produção com:

  ```powershell
  npm run db:pg:migration -- nome_da_mudanca
  ```

  Ele compara com a última versão commitada, cria `prisma/postgres/migrations/<data>_nome/migration.sql` e avisa se houver remoção de tabela/coluna. Revise, commite e faça push: o deploy aplica sozinho. O CI falha se os dois schemas estiverem fora de sincronia.

## Desenvolvimento local continua igual

`npm run dev` com SQLite (`prisma/dev.db`). Nada do que está acima muda o ambiente local.

## Como isto foi validado

- Migration PostgreSQL aplicada num **PostgreSQL 18 real** (PGlite) e o sistema inteiro executado contra ele: criação de usuário, coleta real das 28 fontes (732 manchetes), agrupamento, ciclo de redação com IA simulada, gravação de progresso, aprovação, despublicação, consultas do painel, alertas, health check e auditoria — tudo OK.
- **Não** foi testado um deploy real na Vercel/Neon/GitHub Actions (exige as suas contas). Siga o passo 7 após publicar.
