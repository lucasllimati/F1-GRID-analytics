# Runbook de operação

Procedimentos práticos. Comandos para PowerShell/bash na pasta do projeto.

## Verificações rápidas

| Pergunta | Como responder |
|---|---|
| O site está no ar? | `GET /api/health` → `status` ok/degraded (200) ou down (503) |
| As páginas principais funcionam? | `SMOKE_BASE_URL=https://seu-dominio npm run smoke` |
| Os dados esportivos estão coerentes? | `npm run data:check` (ou `-- 2025` para outra temporada) |
| A IA responde? | `npm run ai:check` |
| O que aconteceu agora? | Painel → "Estado do sistema" e "Execuções recentes"; logs JSON do servidor |

## Iniciar localmente

```bash
npm install
npx prisma migrate dev
npm run dev
```

Build de verificação sem derrubar um `npm run dev` aberto: `NEXT_DIST_DIR=.next-ci npx next build`.

## Deploy

1. CI verde (tipos, testes, build) no commit.
2. `npm run db:deploy` (migrations) **antes** de publicar o código novo.
3. Publicar (Vercel ou `npm run build && npm start`).
4. `npm run smoke` contra o domínio e conferir `/api/health`.
5. Acompanhar o painel por 15 min.

## Rollback

- **Vercel:** "Promote" do deploy anterior no painel da Vercel (instantâneo).
- **Servidor próprio:** `git checkout <tag-anterior> && npm ci && npm run build && npm start`.
- Migrations são aditivas por política (não removemos colunas sem uma versão intermediária), então o código anterior continua compatível com o banco.

## Fonte esportiva (Jolpica) instável

Sintomas: páginas com "Dados indisponíveis", alerta "Fonte de dados esportivos instável", logs `f1.jolpica` com `falha ao consultar a fonte`.

1. O disjuntor já pausa as consultas por 60 s após 5 falhas — não reinicie em loop.
2. Verifique a API: `curl -I https://api.jolpi.ca/ergast/f1/current.json`.
3. Se for 429 persistente: há tráfego demais com cache frio; aguarde o cache aquecer (os TTLs são de 10–30 min).
4. Nada é inventado durante a falha: as páginas mostram erro honesto e voltam sozinhas.

## Resultado oficial não aparece

1. A Jolpica publica algumas horas após a corrida.
2. Depois disso: Painel → "Atualizar dados esportivos agora".
3. `npm run data:check` para conferir a consistência.

## Dados inconsistentes (`npm run data:check` com alerta)

1. Compare com a fonte oficial (FIA/F1).
2. Divergência legítima (ex.: meio ponto em corrida encurtada, punição posterior): registrar e seguir.
3. Erro da fonte: o site **não corrige** valores automaticamente; avise os mantenedores da Jolpica e, se necessário, desative temporariamente a página afetada.

## Histórico (recordes, campeões, "neste dia")

`src/data/f1-history.json` guarda as temporadas encerradas; a temporada atual é somada ao vivo. **Uma vez por ano**, depois da última corrida (e de a fonte publicar a classificação final), rode:

```bash
npm run data:history -- --until 2026
```

Leva ~1 h (uma consulta a cada 8 s, abaixo do limite de ~500/h da Jolpica). As respostas ficam em `.cache/jolpica/`: se parar no meio, rode de novo e ele continua de onde parou. Para refazer só uma temporada, apague `.cache/jolpica/<ano>-*`. Revise o diff do JSON e faça commit. Enquanto não atualizar, `/records` mostra um aviso de que há temporada encerrada fora do histórico.

## Classificação atrasada na fonte

A Jolpica às vezes publica os resultados antes de atualizar a classificação (já aconteceu com a de construtores, uma etapa atrás). O site detecta isso (rodada da classificação < última corrida publicada) e recalcula pela soma dos resultados, a partir de 2010. Quando a fonte se atualiza, a classificação oficial volta a prevalecer (punições da FIA incluídas).

## Reprocessar notícias

- Só coletar: Painel → "Só buscar manchetes" ou `npm run news:ingest`.
- Ciclo completo: Painel → "Buscar e escrever notícias" ou `npm run news:cycle`.
- Acompanhamento: enquanto um ciclo roda (painel, cron ou CLI), o topo do painel mostra o banner de progresso por etapa (coleta das fontes → agrupamento → redação e checagem), atualizado a cada 2 s.
- Ciclo "travado" (banner avisa "sem atualização há mais de 2 minutos"): costuma ser reinício do servidor no meio do ciclo, inclusive o recarregamento automático do `npm run dev` ao editar código. É liberado automaticamente 20 min após o início e aparece como "interrompida" em Execuções recentes.
- Fonte de notícias com erro: Painel → Fontes → desativar temporariamente.

## Corrigir ou despublicar uma matéria

Painel → matéria → "Editar" (com nota pública de correção) ou "Despublicar" (a página continua no ar com o aviso).

## Rotacionar segredos

| Segredo | Como |
|---|---|
| `SESSION_SECRET` | Gerar novo (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), trocar no ambiente, reiniciar. Todas as sessões caem. |
| `CRON_SECRET` | Trocar no ambiente e no agendador (Vercel faz sozinha). |
| `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` | Criar chave nova no provedor, trocar, `npm run ai:check`, apagar a antiga. |
| Senha de usuário | `npm run admin:create -- --email ... --role ...` com `ADMIN_PASSWORD` novo. |

## Banco de dados

- SQLite (dev): copiar `prisma/dev.db` com o servidor parado é o backup.
- PostgreSQL (produção): backups automáticos do provedor + teste de restauração trimestral (`pg_restore` num banco temporário e `npm run smoke` apontando para ele).

## Alerta crítico

1. Painel → "Estado do sistema": identificar componente.
2. Logs do servidor filtrando por `"level":"error"` e pelo `requestId` do ciclo.
3. Banco fora: checar `DATABASE_URL`/serviço; o site público continua servindo páginas em cache, mas notícias e painel ficam indisponíveis.
4. Suspeita de vazamento de credencial: rotacionar o segredo afetado imediatamente (tabela acima) e revisar a auditoria (`AuditLog`).
