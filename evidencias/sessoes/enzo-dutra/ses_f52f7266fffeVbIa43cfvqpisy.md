# Tela detalhe M1: GET /atividades/:id e 404

| | |
|---|---|
| Sessão | `ses_f52f7266fffeVbIa43cfvqpisy` |
| Pasta | dev/semana-academica |
| Período | 16/09 22:43 → 16/09 22:46 |
| Modelo | opencode/big-pickle |
| Requisições ao modelo | 23 |
| Tokens de entrada / saída | 41.546 / 11.804 |
| Skills | — |
| Subagentes | — |
| Execuções de teste | 3 vermelhas, 4 verdes |
| TDD | 0 ciclo(s) vermelho → verde · 2 teste(s) que já nasceram verdes · 1 vez(es) teste e código juntos |
| Arquivos editados | 5 de teste, 2 de código, 0 de entrevista, 0 de spec, 0 de contexto, 0 de auditoria |
| Alertas | — |

## Linha do tempo

- `16/09 22:43` **prompt** — Use a skill nova-tela. Tela de detalhe da atividade do M1: mostra título,tipo, sala, encontros (ordenados), vagas/vagasRestantes/ocupadas, cargaHorariaMinutos e situação, consumindo GET /atividades/:id. Trate o 404 NAO_ENCONTRADO. Teste com API falsa, um comportamento por vez.
- `16/09 22:45` roda `npm test` → verde (9 passaram)
- `16/09 22:45` edita código `web/src/api.js`
- `16/09 22:45` edita teste `web/src/api.test.js`
- `16/09 22:45` roda `npm test -- src/api.test.js` → verde (6 passaram) — _teste e código mudaram juntos: não houve vermelho para ver_
- `16/09 22:45` edita teste `web/src/paginas/atividade/Atividade.test.jsx`
- `16/09 22:45` roda `npm test -- src/paginas/atividade/Atividade.test.jsx` → **vermelho** — _teste novo falhando, como deve ser_
- `16/09 22:45` edita código `web/src/paginas/atividade/Atividade.jsx`
- `16/09 22:45` roda `npm test -- src/paginas/atividade/Atividade.test.jsx` → **vermelho**
- `16/09 22:45` edita teste `web/src/paginas/atividade/Atividade.test.jsx`
- `16/09 22:45` roda `npm test -- src/paginas/atividade/Atividade.test.jsx` → **vermelho** — _teste novo falhando, como deve ser_
- `16/09 22:45` edita teste `web/src/paginas/atividade/Atividade.test.jsx`
- `16/09 22:45` roda `npm test -- src/paginas/atividade/Atividade.test.jsx` → verde (1 passaram) — _teste novo já nasceu verde_
- `16/09 22:45` edita teste `web/src/paginas/atividade/Atividade.test.jsx`
- `16/09 22:46` roda `npm test` → verde (12 passaram) — _teste novo já nasceu verde_
