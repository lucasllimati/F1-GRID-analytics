# Modelo de probabilidade de título — `mc-pl-1.0`

Código: `src/lib/f1/probability.ts` · Testes: `tests/probability.test.ts`

## Duas perguntas diferentes

- **Chance matemática** (exata): `pontos atuais + máximo restante ≥ pontos do líder`. Máximo restante = corridas × (25 + ponto de volta rápida, se a temporada tiver) + sprints × 8.
- **Probabilidade estimada** (modelo): frequência de títulos em N temporadas simuladas.

## Simulação

1. **Força** de cada piloto: Plackett-Luce ajustado por MM (Hunter, 2004) às ordens de chegada dos classificados que terminaram a prova, com peso `0,5^(Δcorridas/meia-vida)` e pseudo-observação para evitar forças degeneradas.
2. **Encolhimento** da força individual para a média da equipe (30%).
3. **Correlação**: a cada sessão, choque comum por equipe `N(0, 0,35)` + choque individual `N(0, 0,25)`.
4. **Confiabilidade**: abandono com probabilidade `(DNF + a) / (largadas + a + b)`, prior Beta(1, 12).
5. **Ordem** via truque de Gumbel (equivalente a amostrar Plackett-Luce).
6. **Pontos** pela tabela da temporada (`src/lib/f1/points.ts`); sprints antes das corridas restantes.
7. **Desempate** de pilotos por countback (vitórias, 2º lugares…), contando apenas GPs.
8. Semente fixa → resultados reprodutíveis.

Etapas restantes = rodadas posteriores à última classificação publicada. Se uma sprint do fim de semana corrente já aconteceu mas a classificação ainda não foi atualizada, ela é tratada como ainda não disputada (consistente com os pontos usados).

## Salvaguardas

- Menos de 3 corridas → aviso e **probabilidades não exibidas**.
- Temporada com novo regulamento e < 6 corridas → aviso.
- Erro de Monte Carlo exibido e explicitamente distinguido da incerteza do modelo.

## Limitações

Sem efeito de circuito, atualizações técnicas, clima, penalidades futuras ou trocas de piloto; sprints usam a força das corridas; desempate de construtores simplificado (pontos).

## Próximos passos (fase 5)

1. Persistir `prediction_runs` e evolução por etapa.
2. **Backtest** 2014–2025 recriando o estado após cada etapa usando só dados disponíveis naquela data; métricas: Brier score, log loss, curva de calibração.
3. Comparar com baselines (pontos atuais proporcionais; forma recente simples).
4. Calibrar σ e meia-vida por validação cruzada temporal.
5. v2: efeito de circuito/tipo de pista quando houver dados suficientes.
