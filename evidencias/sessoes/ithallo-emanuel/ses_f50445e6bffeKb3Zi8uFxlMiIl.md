# TDD, Fatia 5 (confirmação de convocação)

| | |
|---|---|
| Sessão | `ses_f50445e6bffeKb3Zi8uFxlMiIl` |
| Pasta | PROJETO FINAL — SEMANA ACADÊMICA/semana-academica |
| Período | 17/09 11:18 → 17/09 11:28 |
| Modelo | google/gemini-3.5-flash-lite |
| Requisições ao modelo | 35 |
| Tokens de entrada / saída | 358.966 / 28.300 |
| Skills | tdd |
| Subagentes | — |
| Execuções de teste | 5 vermelhas, 6 verdes |
| TDD | 2 ciclo(s) vermelho → verde · 2 teste(s) que já nasceram verdes · 0 vez(es) teste e código juntos |
| Arquivos editados | 5 de teste, 2 de código, 0 de entrevista, 0 de spec, 0 de contexto, 0 de auditoria |
| Alertas | — |

## Linha do tempo

- `17/09 11:18` **prompt** — Use a skill tdd. Implemente só a fatia 5 de specs/M2-inscricoes.md (R15, R16): confirmacao de convocacao (POST /inscricoes/:id/confirmacao). Regras: - R15: participante com inscricao convocada confirma dentro do prazo -> status vira confirmada e convocadaAte vira null (200). - R16 validacoes: - inscricao que nao esta convocada (confirmada, em_espera, cancelada, expirada) -> 422 SEM_CONVOCACAO. - …
- `17/09 11:18` carrega a skill **tdd**
- `17/09 11:18` roda `npm test` → verde (48 passaram)
- `17/09 11:18` edita teste `api/verificacoes/m2-inscricoes.spec.js`
- `17/09 11:19` roda `npm test` → **vermelho** (48 passaram, 1 falharam) — _teste novo falhando, como deve ser_
- `17/09 11:19` edita código `api/src/app.js`
- `17/09 11:19` roda `npm test` → verde (49 passaram) — _fecha um ciclo vermelho → verde_
- `17/09 11:21` edita teste `api/verificacoes/m2-inscricoes.spec.js`
- `17/09 11:21` roda `npm test` → verde (50 passaram) — _teste novo já nasceu verde_
- `17/09 11:21` edita teste `api/verificacoes/m2-inscricoes.spec.js`
- `17/09 11:21` roda `npm test` → **vermelho** (50 passaram, 1 falharam) — _teste novo falhando, como deve ser_
- `17/09 11:22` edita código `api/src/app.js`
- `17/09 11:23` roda `npm test` → verde (51 passaram) — _fecha um ciclo vermelho → verde_
- `17/09 11:23` edita teste `api/verificacoes/m2-inscricoes.spec.js`
- `17/09 11:24` roda `npm test` → **vermelho** (51 passaram, 1 falharam) — _teste novo falhando, como deve ser_
- `17/09 11:24` edita teste `api/verificacoes/m2-inscricoes.spec.js`
- `17/09 11:25` roda `npm test` → verde (52 passaram) — _teste novo já nasceu verde_
- `17/09 11:26` roda `npm --prefix api test` → verde (52 passaram)
- `17/09 11:26` roda `npm --prefix web test -- --run` → **vermelho**
- `17/09 11:28` roda `npm --prefix web test` → **vermelho**
