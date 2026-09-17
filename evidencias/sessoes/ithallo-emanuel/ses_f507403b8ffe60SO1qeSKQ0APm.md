# TDD, Fatia 2 (prazos e cancelamento de inscrição)

| | |
|---|---|
| Sessão | `ses_f507403b8ffe60SO1qeSKQ0APm` |
| Pasta | PROJETO FINAL — SEMANA ACADÊMICA/semana-academica |
| Período | 17/09 10:26 → 17/09 10:33 |
| Modelo | google/gemini-3.5-flash-lite |
| Requisições ao modelo | 24 |
| Tokens de entrada / saída | 344.443 / 12.494 |
| Skills | tdd |
| Subagentes | — |
| Execuções de teste | 2 vermelhas, 5 verdes |
| TDD | 2 ciclo(s) vermelho → verde · 1 teste(s) que já nasceram verdes · 0 vez(es) teste e código juntos |
| Arquivos editados | 3 de teste, 2 de código, 0 de entrevista, 0 de spec, 0 de contexto, 0 de auditoria |
| Alertas | — |

## Linha do tempo

- `17/09 10:26` **prompt** — Use a skill tdd. Implemente só a fatia 2 de specs/M2-inscricoes.md (R2, R9, R10): - R2: inscrever fecha 30 minutos antes do início do 1º encontro. Faltando exatamente 30 min ou menos → 422 INSCRICOES_ENCERRADAS; faltando 31 min → 201. Use o relógio de teste para fixar o tempo. - R9: cancelar a própria inscrição (POST /inscricoes/:id/cancelamento) só enquanto o relógio estiver antes do início do 1…
- `17/09 10:26` carrega a skill **tdd**
- `17/09 10:26` roda `npm test` → verde (36 passaram)
- `17/09 10:27` edita teste `api/verificacoes/m2-inscricoes.spec.js`
- `17/09 10:27` roda `npm test` → **vermelho** (36 passaram, 1 falharam) — _teste novo falhando, como deve ser_
- `17/09 10:29` edita código `api/src/app.js`
- `17/09 10:30` roda `npm test` → verde (37 passaram) — _fecha um ciclo vermelho → verde_
- `17/09 10:31` edita teste `api/verificacoes/m2-inscricoes.spec.js`
- `17/09 10:31` roda `npm test` → **vermelho** (37 passaram, 1 falharam) — _teste novo falhando, como deve ser_
- `17/09 10:31` edita código `api/src/app.js`
- `17/09 10:31` roda `npm test` → verde (38 passaram) — _fecha um ciclo vermelho → verde_
- `17/09 10:31` edita teste `api/verificacoes/m2-inscricoes.spec.js`
- `17/09 10:31` roda `npm test` → verde (39 passaram) — _teste novo já nasceu verde_
- `17/09 10:33` roda `npm test` → verde (39 passaram)
