# TDD fatia 3: POST /atividades

| | |
|---|---|
| Sessão | `ses_f53314acbffev3L7o70Fs5y3u3` |
| Pasta | dev/semana-academica |
| Período | 16/09 21:40 → 16/09 21:45 |
| Modelo | opencode/big-pickle |
| Requisições ao modelo | 44 |
| Tokens de entrada / saída | 55.975 / 39.941 |
| Skills | tdd |
| Subagentes | — |
| Execuções de teste | 6 vermelhas, 8 verdes |
| TDD | 4 ciclo(s) vermelho → verde · 4 teste(s) que já nasceram verdes · 0 vez(es) teste e código juntos |
| Arquivos editados | 12 de teste, 10 de código, 0 de entrevista, 0 de spec, 0 de contexto, 0 de auditoria |
| Alertas | — |

## Linha do tempo

- `16/09 21:40` **prompt** — Use a skill tdd. Implemente só a fatia 3 de specs/M1-grade.md (R7 a R14:POST /atividades — título, quantidade de encontros, validade de encontro, vagas, conflito de sala, ordem de erros, criação no passado, sala inexistente). Um teste por vez: escreva o teste, mostre ele falhando, e só então o código
- `16/09 21:40` carrega a skill **tdd**
- `16/09 21:41` edita teste `api/verificacoes/m1-grade-criacao.spec.js`
- `16/09 21:41` roda `npm test` → **vermelho** (6 passaram, 1 falharam) — _teste novo falhando, como deve ser_
- `16/09 21:41` edita código `api/src/app.js` (3×)
- `16/09 21:41` roda `npm test` → verde (7 passaram) — _fecha um ciclo vermelho → verde_
- `16/09 21:42` edita teste `api/verificacoes/m1-grade-criacao.spec.js` (2×)
- `16/09 21:42` roda `npm test -- --test-name-pattern "R8"` → **vermelho** (7 passaram, 1 falharam) — _teste novo falhando, como deve ser_
- `16/09 21:42` edita código `api/src/app.js`
- `16/09 21:42` roda `npm test` → verde (8 passaram) — _fecha um ciclo vermelho → verde_
- `16/09 21:43` edita teste `api/verificacoes/m1-grade-criacao.spec.js`
- `16/09 21:43` roda `npm test -- --test-name-pattern "R9"` → **vermelho** (8 passaram, 1 falharam) — _teste novo falhando, como deve ser_
- `16/09 21:43` edita código `api/src/app.js` (2×)
- `16/09 21:43` roda `npm test` → verde (9 passaram) — _fecha um ciclo vermelho → verde_
- `16/09 21:43` edita teste `api/verificacoes/m1-grade-criacao.spec.js`
- `16/09 21:43` roda `npm test -- --test-name-pattern "R10"` → **vermelho** (9 passaram, 1 falharam) — _teste novo falhando, como deve ser_
- `16/09 21:43` edita código `api/src/app.js` (2×)
- `16/09 21:44` roda `npm test` → verde (10 passaram) — _fecha um ciclo vermelho → verde_
- `16/09 21:44` edita teste `api/verificacoes/m1-grade-criacao.spec.js` (2×)
- `16/09 21:44` roda `npm test -- --test-name-pattern "R11"` → **vermelho** (10 passaram, 1 falharam) — _teste novo falhando, como deve ser_
- `16/09 21:44` edita código `api/src/app.js` (2×)
- `16/09 21:44` roda `npm test` → **vermelho** (9 passaram, 2 falharam)
- `16/09 21:44` edita teste `api/verificacoes/m1-grade-criacao.spec.js` (2×)
- `16/09 21:44` roda `npm test` → verde (11 passaram) — _teste novo já nasceu verde_
- `16/09 21:45` edita teste `api/verificacoes/m1-grade-criacao.spec.js`
- `16/09 21:45` roda `npm test -- --test-name-pattern "R12"` → verde (12 passaram) — _teste novo já nasceu verde_
- `16/09 21:45` edita teste `api/verificacoes/m1-grade-criacao.spec.js`
- `16/09 21:45` roda `npm test -- --test-name-pattern "R13|R12"` → verde (13 passaram) — _teste novo já nasceu verde_
- `16/09 21:45` edita teste `api/verificacoes/m1-grade-criacao.spec.js`
- `16/09 21:45` roda `npm test` → verde (14 passaram) — _teste novo já nasceu verde_
