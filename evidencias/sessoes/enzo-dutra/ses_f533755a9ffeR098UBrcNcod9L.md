# TDD fatia 2 M1-grade: filtros ?dia= e ?tipo=

| | |
|---|---|
| Sessão | `ses_f533755a9ffeR098UBrcNcod9L` |
| Pasta | dev/semana-academica |
| Período | 16/09 21:33 → 16/09 21:35 |
| Modelo | opencode/big-pickle |
| Requisições ao modelo | 20 |
| Tokens de entrada / saída | 38.984 / 11.976 |
| Skills | tdd |
| Subagentes | — |
| Execuções de teste | 3 vermelhas, 4 verdes |
| TDD | 3 ciclo(s) vermelho → verde · 0 teste(s) que já nasceram verdes · 0 vez(es) teste e código juntos |
| Arquivos editados | 3 de teste, 3 de código, 0 de entrevista, 0 de spec, 0 de contexto, 0 de auditoria |
| Alertas | — |

## Linha do tempo

- `16/09 21:33` **prompt** — Use a skill tdd. Implemente só a fatia 2 de specs/M1-grade.md (R4, R5, R6:filtro ?dia=, ?tipo= com validação, e a combinação AND). Um teste por vez: escreva o teste, mostre ele falhando, e só então o código.
- `16/09 21:33` carrega a skill **tdd**
- `16/09 21:34` roda `npm test` → verde (3 passaram)
- `16/09 21:34` edita teste `api/verificacoes/m1-grade.spec.js`
- `16/09 21:35` roda `npm test` → **vermelho** (3 passaram, 1 falharam) — _teste novo falhando, como deve ser_
- `16/09 21:35` edita código `api/src/app.js`
- `16/09 21:35` roda `npm test` → verde (4 passaram) — _fecha um ciclo vermelho → verde_
- `16/09 21:35` edita teste `api/verificacoes/m1-grade.spec.js`
- `16/09 21:35` roda `npm test` → **vermelho** (4 passaram, 1 falharam) — _teste novo falhando, como deve ser_
- `16/09 21:35` edita código `api/src/app.js`
- `16/09 21:35` roda `npm test` → verde (5 passaram) — _fecha um ciclo vermelho → verde_
- `16/09 21:35` edita teste `api/verificacoes/m1-grade.spec.js`
- `16/09 21:35` roda `npm test` → **vermelho** (5 passaram, 1 falharam) — _teste novo falhando, como deve ser_
- `16/09 21:35` edita código `api/src/app.js`
- `16/09 21:35` roda `npm test` → verde (6 passaram) — _fecha um ciclo vermelho → verde_
