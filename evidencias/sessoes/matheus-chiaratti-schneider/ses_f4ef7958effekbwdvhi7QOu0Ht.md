# Listagem de presenças com TDD (R22)

| | |
|---|---|
| Sessão | `ses_f4ef7958effekbwdvhi7QOu0Ht` |
| Pasta | semana-academica/api |
| Período | 17/09 17:21 → 17/09 17:23 |
| Modelo | opencode/big-pickle |
| Requisições ao modelo | 14 |
| Tokens de entrada / saída | 70.209 / 12.642 |
| Skills | tdd |
| Subagentes | — |
| Execuções de teste | 1 vermelhas, 2 verdes |
| TDD | 1 ciclo(s) vermelho → verde · 0 teste(s) que já nasceram verdes · 0 vez(es) teste e código juntos |
| Arquivos editados | 1 de teste, 1 de código, 0 de entrevista, 0 de spec, 0 de contexto, 0 de auditoria |
| Alertas | — |

## Linha do tempo

- `17/09 17:21` **prompt** — Use a skill tdd. Implemente só a fatia 6 de ../specs/M3-presenca.md — "Listagem de presenças": GET /encontros/:id/presencas com o R22. Um teste por vez: escreva, rode e me mostre vermelho, então o código mínimo. Suíte inteira no fim. O teste precisa registrar presenças de várias origens (qr, qr_offline e manual) e conferir a ordem: por nome do participante, com desempate por participanteId. Não u…
- `17/09 17:21` carrega a skill **tdd**
- `17/09 17:23` edita teste `verificacoes/m3-presenca.spec.js`
- `17/09 17:23` roda `node --test --test-name-pattern="R22: GET /encontros/:id/presencas" "verificaco…` → **vermelho** (0 passaram, 1 falharam) — _teste novo falhando, como deve ser_
- `17/09 17:23` edita código `src/app.js`
- `17/09 17:23` roda `node --test --test-name-pattern="R22: GET /encontros/:id/presencas" "verificaco…` → verde (1 passaram) — _fecha um ciclo vermelho → verde_
- `17/09 17:23` roda `npm test` → verde (90 passaram)
