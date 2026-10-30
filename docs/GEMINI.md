# Testar a redação com o Google Gemini (gratuito)

Guia para gerar a chave da API do Gemini e ligá-la à Apex Grid. Conferido com a documentação oficial em 2026-10-10. As telas e limites do Google mudam com frequência; em caso de diferença, a [página oficial](https://ai.google.dev/gemini-api/docs/api-key) prevalece.

## Antes de começar: o que saber sobre o plano gratuito

- **Custo zero**, mas com **limites de uso** por minuto e por dia. Os limites atuais da sua conta aparecem no painel do AI Studio (menu **Dashboard → Rate limits**).
- No plano gratuito, **o Google pode usar o conteúdo enviado para melhorar os produtos dele**. A Apex Grid envia apenas trechos de notícias públicas e o rascunho gerado — nunca dados de usuários ou segredos —, mas leve isso em conta.
- Modelos gratuitos erram mais. Use **`NEWS_PUBLISH_MODE="semi"`**: todo texto passa por você antes de ir ao ar.

## Passo 1 — Criar a chave

1. Acesse **https://aistudio.google.com/api-keys** e entre com sua conta Google.
2. Se for o primeiro acesso, **aceite os Termos de Serviço**. Para contas novas, o AI Studio cria automaticamente um projeto do Google Cloud e, em alguns casos, já uma chave.
3. Clique em **"Create API key"**.
   - Se o AI Studio pedir um projeto, escolha o projeto padrão criado para você.
   - Se você já usa o Google Cloud e nenhum projeto aparece: abra **Dashboard → Projects → "Import projects"**, selecione o projeto e clique em **"Import"**. Depois volte a **API Keys**.
   - Se o botão estiver desativado, sua conta não tem permissão no projeto (é comum em contas de empresa/escola). Use uma conta Google pessoal.
4. **Copie a chave** exibida.
5. Recomendado: na mesma tela, clique em **"Add restrictions"**, escolha **"Restrict to Gemini API only"** e confirme em **"Restrict key"**. Assim, se a chave vazar, ela só serve para o Gemini.
6. **Não ative faturamento** se quiser ficar apenas no plano gratuito.

## Passo 2 — Colocar a chave no projeto

Abra o arquivo **`.env`** na raiz do projeto e preencha:

```env
NEWS_AI_PROVIDER="gemini"
NEWS_AI_MODEL=""                 # vazio = gemini-3.8-flash (estável, com plano gratuito)
GEMINI_API_KEY="cole-sua-chave-aqui"
NEWS_PUBLISH_MODE="semi"
```

O `.env` está no `.gitignore` e não vai para o Git. **Nunca** coloque a chave no `.env.example`, no código ou em mensagens.

Outros modelos com plano gratuito (escolha pelo `NEWS_AI_MODEL`): `gemini-3.6-flash`, `gemini-3.5-flash-lite` (mais rápido, mais limites, menor qualidade). Modelos Pro não têm plano gratuito.

## Passo 3 — Rodar e conferir

```bash
npm run news:cycle
```

A primeira linha mostra o provedor ativo, por exemplo:

```
[ia] provedor=gemini modelo=gemini-3.8-flash
```

Depois:

```bash
npm run dev
```

Abra **http://localhost:3000/admin**, entre com seu usuário e veja a **Fila de revisão**. Em cada texto, confira a checagem de fatos e as fontes antes de clicar em **Aprovar e publicar**.

## Problemas comuns

| Mensagem | Causa | O que fazer |
|---|---|---|
| `IA desativada — GEMINI_API_KEY ausente` | chave vazia ou `.env` não salvo | confira o `.env`; reinicie o `npm run dev` |
| `Chave da API inválida ou sem permissão` | chave copiada errada, revogada ou com restrição de IP | gere outra chave |
| `Limite de uso por minuto atingido` / `Cota do plano esgotada` | estourou o limite por minuto/dia do modelo | a cadeia de reserva assume (abaixo); se todas caírem, as pautas voltam para a fila |
| `Nenhum provedor disponível — …` | todos os modelos da cadeia falharam neste ciclo | as pautas ficam "adiadas" e são retomadas no próximo ciclo; adicione o OpenRouter |
| `Saída fora do esquema` / `Saída sem JSON válido` | o modelo não seguiu o formato após 4 tentativas | a pauta fica marcada como falha; tente outro modelo |
| Nenhum artigo gerado | nenhuma pauta elegível (precisa de fonte oficial ou ≥2 veículos independentes, com ≥30 min) | normal; rode de novo mais tarde |

## Cadeia de reserva (quando a cota acaba)

No plano gratuito do Google a cota é **por modelo**. Por isso, quando o modelo principal esgota ou fica sobrecarregado, a mesma tarefa passa para o próximo da cadeia — com a mesma checagem de fatos e as mesmas regras editoriais:

```
gemini-3.8-flash → gemini-3.6-flash → gemini-3.5-flash-lite → (OpenRouter gratuito, se configurado)
```

- Modelo com cota esgotada sai da cadeia até o fim do ciclo (não insiste).
- Se **todos** falharem, nenhuma pauta é perdida: ela volta para a fila como "adiada" e o ciclo para de tentar até o próximo horário.
- `npm run ai:check` testa cada elo e mostra ✅/❌.

**Recomendado: adicionar um provedor de outra empresa.** Os três modelos acima são do Google — se o serviço do Google ficar instável, caem juntos. O OpenRouter oferece modelos gratuitos (sufixo `:free`) de outras empresas:

1. Crie uma conta em **https://openrouter.ai** (pode entrar com Google/GitHub).
2. Abra **https://openrouter.ai/settings/keys** → **Create Key** → copie (começa com `sk-or-`).
3. No `.env` (e como *secret* `OPENROUTER_API_KEY` no GitHub, para o agendamento):

   ```env
   OPENROUTER_API_KEY="sk-or-..."
   ```

Pronto: os modelos gratuitos `nvidia/nemotron-3.5-super-vl:free` e `google/gemma-4-31b-it:free` entram no fim da cadeia. O site **só aceita modelos terminados em `:free`** no OpenRouter (nunca gera cobrança). Modelos gratuitos mudam com frequência — se o `npm run ai:check` mostrar "unavailable for free", troque em `NEWS_AI_FALLBACKS` por outro da lista https://openrouter.ai/models?max_price=0. Limites gratuitos do OpenRouter: 20 pedidos/min e 50 pedidos/dia (1.000/dia se a conta tiver ao menos US$ 10 de créditos comprados). Cada notícia usa ~2 pedidos (redação + checagem).

Para escolher a cadeia manualmente, use `NEWS_AI_FALLBACKS` (ordem = prioridade; `none` desliga):

```env
NEWS_AI_FALLBACKS="gemini:gemini-3.6-flash,openrouter:google/gemma-4-31b-it:free,openrouter:nvidia/nemotron-3.5-super-vl:free"
```

> Não existe "token gratuito compartilhado" entre empresas: cada provedor exige a **sua** chave (todas gratuitas aqui). O sistema só alterna entre as que você configurar.

## Se a chave vazar

1. Crie uma nova chave no AI Studio.
2. Troque no `.env`.
3. Exclua a chave antiga na página **API Keys**.

## Voltar para o Claude (produção)

```env
NEWS_AI_PROVIDER="anthropic"
ANTHROPIC_API_KEY="sk-ant-..."
```
