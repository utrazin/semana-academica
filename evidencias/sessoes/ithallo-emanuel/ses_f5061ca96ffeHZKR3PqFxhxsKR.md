# TDD, Fatia 4 (lista de espera e convocação)

| | |
|---|---|
| Sessão | `ses_f5061ca96ffeHZKR3PqFxhxsKR` |
| Pasta | PROJETO FINAL — SEMANA ACADÊMICA/semana-academica |
| Período | 17/09 10:46 → 17/09 10:57 |
| Modelo | google/gemini-3.5-flash-lite |
| Requisições ao modelo | 31 |
| Tokens de entrada / saída | 376.176 / 48.607 |
| Skills | tdd |
| Subagentes | — |
| Execuções de teste | 4 vermelhas, 2 verdes |
| TDD | 0 ciclo(s) vermelho → verde · 1 teste(s) que já nasceram verdes · 1 vez(es) teste e código juntos |
| Arquivos editados | 3 de teste, 4 de código, 0 de entrevista, 0 de spec, 0 de contexto, 0 de auditoria |
| Alertas | — |

## Linha do tempo

- `17/09 10:46` **prompt** — Use a skill tdd. Implemente só a fatia 4 de specs/M2-inscricoes.md (R5): lista de espera, convocacao automatica e expiracao em cascata. Regras: - Quando uma vaga e liberada (cancelamento de confirmada/convocada, convocacao vencida, ou aumento de vagas via PATCH do M1), o 1o da fila em_espera vira convocada e recebe convocadaAte = instante da liberacao + 2h. - O prazo NUNCA passa do fecho das insc…
- `17/09 10:48` carrega a skill **tdd**
- `17/09 10:49` roda `npm test` → verde (44 passaram)
- `17/09 10:50` edita teste `api/verificacoes/m2-inscricoes.spec.js`
- `17/09 10:50` roda `npm test` → **vermelho** (44 passaram, 1 falharam) — _teste novo falhando, como deve ser_
- `17/09 10:51` edita código `api/src/app.js` (3×)
- `17/09 10:53` roda `npm test` → **vermelho** (43 passaram, 2 falharam)
- `17/09 10:54` edita código `api/src/app.js`
- `17/09 10:54` edita teste `api/verificacoes/m2-inscricoes.spec.js`
- `17/09 10:54` roda `npm test` → **vermelho** (47 passaram, 1 falharam) — _teste e código mudaram juntos: não houve vermelho para ver_
- `17/09 10:56` roda `node --test verificacoes/m2-inscricoes.spec.js` → **vermelho** (14 passaram, 1 falharam)
- `17/09 10:57` edita teste `api/verificacoes/m2-inscricoes.spec.js`
- `17/09 10:57` roda `npm test` → verde (48 passaram) — _teste novo já nasceu verde_
