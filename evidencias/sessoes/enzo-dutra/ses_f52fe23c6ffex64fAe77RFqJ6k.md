# Esqueleto web da tela de programação M1

| | |
|---|---|
| Sessão | `ses_f52fe23c6ffex64fAe77RFqJ6k` |
| Pasta | dev/semana-academica |
| Período | 16/09 22:36 → 16/09 22:41 |
| Modelo | opencode/big-pickle |
| Requisições ao modelo | 26 |
| Tokens de entrada / saída | 53.193 / 26.444 |
| Skills | — |
| Subagentes | — |
| Execuções de teste | 1 vermelhas, 1 verdes |
| TDD | 0 ciclo(s) vermelho → verde · 1 teste(s) que já nasceram verdes · 1 vez(es) teste e código juntos |
| Arquivos editados | 4 de teste, 9 de código, 0 de entrevista, 0 de spec, 0 de contexto, 0 de auditoria |
| Alertas | — |

## Linha do tempo

- `16/09 22:36` **prompt** — Use a skill nova-tela. Crie o esqueleto de web/: Vite + React + Vitest +@testing-library/react. Crie web/src/api.js (cliente da API real, funções listarAtividades({dia, tipo}) e listarSalas(), lendo API_URL de env) e um seletor de usuário simples (dropdown com os 10 usuários da seção 4 do contrato-api.md, guardado em localStorage, mandado como X-Usuario em toda chamada). Depois, a tela de Program…
- `16/09 22:39` edita código `web/package.json`
- `16/09 22:39` edita código `web/vite.config.js`
- `16/09 22:39` edita código `web/index.html`
- `16/09 22:39` edita teste `web/src/test/setup.js`
- `16/09 22:40` edita código `web/src/api.js` (2×)
- `16/09 22:40` edita código `web/src/componentes/SelectorDeUsuario.jsx`
- `16/09 22:40` edita código `web/src/App.jsx`
- `16/09 22:40` edita código `web/src/paginas/programacao/Programacao.jsx`
- `16/09 22:40` edita código `web/src/main.jsx`
- `16/09 22:40` edita teste `web/src/paginas/programacao/Programacao.test.jsx`
- `16/09 22:40` edita teste `web/src/api.test.js`
- `16/09 22:41` roda `npm test` → **vermelho** (8 passaram, 1 falharam) — _teste e código mudaram juntos: não houve vermelho para ver_
- `16/09 22:41` edita teste `web/src/paginas/programacao/Programacao.test.jsx`
- `16/09 22:41` roda `npm test` → verde (9 passaram) — _teste novo já nasceu verde_
