# Implementar fatia 5 presença manual

| | |
|---|---|
| Sessão | `ses_f4f01a623ffeLl2uISDIWpYWV9` |
| Pasta | semana-academica/api |
| Período | 17/09 17:10 → 17/09 17:17 |
| Modelo | opencode/big-pickle |
| Requisições ao modelo | 38 |
| Tokens de entrada / saída | 62.227 / 38.552 |
| Skills | tdd, regra-de-tempo |
| Subagentes | — |
| Execuções de teste | 6 vermelhas, 10 verdes |
| TDD | 4 ciclo(s) vermelho → verde · 3 teste(s) que já nasceram verdes · 0 vez(es) teste e código juntos |
| Arquivos editados | 9 de teste, 5 de código, 0 de entrevista, 0 de spec, 0 de contexto, 0 de auditoria |
| Alertas | — |

## Linha do tempo

- `17/09 17:10` **prompt** — Use a skill tdd junto com a skill regra-de-tempo. Implemente só a fatia 5 de ../specs/M3-presenca.md — "Presença manual": R18, R10, R6 na manual, R19, R21, o cruzamento do R17 e o origem: manual do R24. Um teste por vez: escreva, rode e me mostre vermelho, então o código mínimo. Suíte inteira entre os testes. A rota está em 501, então nenhum teste desta fatia deve nascer verde — se algum nascer, …
- `17/09 17:10` carrega a skill **tdd**
- `17/09 17:10` carrega a skill **regra-de-tempo**
- `17/09 17:11` roda `npm test 2>&1` → verde (82 passaram)
- `17/09 17:13` edita teste `verificacoes/m3-presenca.spec.js`
- `17/09 17:13` roda `npm test 2>&1 | Select-String -Pattern "R18|tests |pass |fail " -Context 0,6` → **vermelho** — _teste novo falhando, como deve ser_
- `17/09 17:13` edita código `src/app.js`
- `17/09 17:13` roda `npm test 2>&1 | Select-String -Pattern "# tests|# pass|# fail|not ok"` → verde (83 passaram) — _fecha um ciclo vermelho → verde_
- `17/09 17:13` edita teste `verificacoes/m3-presenca.spec.js`
- `17/09 17:13` roda `npm test 2>&1 | Select-String -Pattern "# tests|# pass|# fail|R10: a janela|not…` → **vermelho** — _teste novo falhando, como deve ser_
- `17/09 17:13` edita código `src/app.js`
- `17/09 17:14` roda `npm test 2>&1 | Select-String -Pattern "# tests|# pass|# fail|not ok"` → verde (84 passaram) — _fecha um ciclo vermelho → verde_
- `17/09 17:14` edita teste `verificacoes/m3-presenca.spec.js`
- `17/09 17:14` roda `npm test 2>&1 | Select-String -Pattern "# tests|# pass|# fail|R6 na manual|not …` → **vermelho** — _teste novo falhando, como deve ser_
- `17/09 17:14` edita código `src/app.js`
- `17/09 17:14` roda `npm test 2>&1 | Select-String -Pattern "# tests|# pass|# fail|not ok"` → verde (85 passaram) — _fecha um ciclo vermelho → verde_
- `17/09 17:14` edita teste `verificacoes/m3-presenca.spec.js`
- `17/09 17:14` roda `npm test 2>&1 | Select-String -Pattern "# tests|# pass|# fail|R24: presenca man…` → verde — _teste novo já nasceu verde_
- `17/09 17:14` roda `npm test 2>&1 | Select-String -Pattern "# pass|# fail"` → verde (86 passaram)
- `17/09 17:14` edita teste `verificacoes/m3-presenca.spec.js` (2×)
- `17/09 17:15` roda `npm test 2>&1 | Select-String -Pattern "# tests|# pass|# fail|R19: limite|not o…` → **vermelho** — _teste novo falhando, como deve ser_
- `17/09 17:15` edita código `src/app.js`
- `17/09 17:15` roda `npm test 2>&1 | Select-String -Pattern "# pass|# fail|not ok"` → **vermelho** (86 passaram, 1 falharam)
- `17/09 17:15` edita teste `verificacoes/m3-presenca.spec.js`
- `17/09 17:15` roda `npm test 2>&1 | Select-String -Pattern "# tests|# pass|# fail|not ok"` → verde (87 passaram) — _teste novo já nasceu verde_
- `17/09 17:16` edita teste `verificacoes/m3-presenca.spec.js`
- `17/09 17:16` roda `npm test 2>&1 | Select-String -Pattern "# tests|# pass|# fail|R21: ordem|not ok…` → **vermelho** — _teste novo falhando, como deve ser_
- `17/09 17:16` edita código `src/app.js`
- `17/09 17:16` roda `npm test 2>&1 | Select-String -Pattern "# tests|# pass|# fail|not ok"` → verde (88 passaram) — _fecha um ciclo vermelho → verde_
- `17/09 17:16` edita teste `verificacoes/m3-presenca.spec.js`
- `17/09 17:16` roda `npm test 2>&1 | Select-String -Pattern "# tests|# pass|# fail|R17: manual em ci…` → verde — _teste novo já nasceu verde_
- `17/09 17:16` roda `npm test 2>&1 | Select-String -Pattern "# tests|# pass|# fail|# duration"` → verde (89 passaram)
