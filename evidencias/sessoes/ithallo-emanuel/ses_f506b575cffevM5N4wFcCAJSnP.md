# TDD da fatia 3: R6, R7 e R8 de inscrições

| | |
|---|---|
| Sessão | `ses_f506b575cffevM5N4wFcCAJSnP` |
| Pasta | PROJETO FINAL — SEMANA ACADÊMICA/semana-academica |
| Período | 17/09 10:35 → 17/09 10:44 |
| Modelo | google/gemini-3.5-flash-lite |
| Requisições ao modelo | 34 |
| Tokens de entrada / saída | 476.753 / 19.061 |
| Skills | tdd |
| Subagentes | — |
| Execuções de teste | 3 vermelhas, 7 verdes |
| TDD | 2 ciclo(s) vermelho → verde · 3 teste(s) que já nasceram verdes · 0 vez(es) teste e código juntos |
| Arquivos editados | 7 de teste, 3 de código, 0 de entrevista, 0 de spec, 0 de contexto, 0 de auditoria |
| Alertas | — |

## Linha do tempo

- `17/09 10:35` **prompt** — Use a skill tdd. Implemente só a fatia 3 de specs/M2-inscricoes.md (R6, R7, R8): - R6 CONFLITO_DE_HORARIO (409): quem vai ocupar vaga (confirmada ou convocada) não pode ter outra inscrição que ocupe vaga com encontro sobreposto. Encostar (um encontro termina no mesmo instante em que outro começa) NÃO é conflito. Quem está só em_espera não é verificado. - R7 LIMITE_DE_MINICURSOS (422): no máximo 3…
- `17/09 10:35` carrega a skill **tdd**
- `17/09 10:36` roda `npm test` → verde (39 passaram)
- `17/09 10:37` edita teste `api/verificacoes/m2-inscricoes.spec.js`
- `17/09 10:37` roda `npm test` → **vermelho** (39 passaram, 1 falharam) — _teste novo falhando, como deve ser_
- `17/09 10:37` edita teste `api/verificacoes/m2-inscricoes.spec.js`
- `17/09 10:37` roda `npm test` → **vermelho** (39 passaram, 1 falharam) — _teste novo falhando, como deve ser_
- `17/09 10:38` edita código `api/src/app.js`
- `17/09 10:39` roda `npm test` → verde (40 passaram) — _fecha um ciclo vermelho → verde_
- `17/09 10:39` edita teste `api/verificacoes/m2-inscricoes.spec.js`
- `17/09 10:39` roda `npm test` → verde (41 passaram) — _teste novo já nasceu verde_
- `17/09 10:39` edita teste `api/verificacoes/m2-inscricoes.spec.js` (2×)
- `17/09 10:39` roda `npm test` → verde (42 passaram) — _teste novo já nasceu verde_
- `17/09 10:40` edita teste `api/verificacoes/m2-inscricoes.spec.js`
- `17/09 10:41` roda `npm test` → **vermelho** (42 passaram, 1 falharam) — _teste novo falhando, como deve ser_
- `17/09 10:41` edita código `api/src/app.js` (2×)
- `17/09 10:41` roda `npm test` → verde (43 passaram) — _fecha um ciclo vermelho → verde_
- `17/09 10:43` edita teste `api/verificacoes/m2-inscricoes.spec.js`
- `17/09 10:43` roda `npm test` → verde (44 passaram) — _teste novo já nasceu verde_
- `17/09 10:43` roda `npm test` → verde (44 passaram)
