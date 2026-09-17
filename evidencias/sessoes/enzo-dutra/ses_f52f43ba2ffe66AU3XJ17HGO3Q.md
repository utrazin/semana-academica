# Formulário de atividade POST /atividades

| | |
|---|---|
| Sessão | `ses_f52f43ba2ffe66AU3XJ17HGO3Q` |
| Pasta | dev/semana-academica |
| Período | 16/09 22:47 → 16/09 22:54 |
| Modelo | opencode/big-pickle |
| Requisições ao modelo | 27 |
| Tokens de entrada / saída | 98.995 / 19.689 |
| Skills | — |
| Subagentes | — |
| Execuções de teste | 1 vermelhas, 2 verdes |
| TDD | 1 ciclo(s) vermelho → verde · 0 teste(s) que já nasceram verdes · 1 vez(es) teste e código juntos |
| Arquivos editados | 2 de teste, 5 de código, 0 de entrevista, 0 de spec, 0 de contexto, 0 de auditoria |
| Alertas | — |

## Linha do tempo

- `16/09 22:47` **prompt** — Use a skill nova-tela. Formulário de criação de atividade (só para usuárioorganização) consumindo POST /atividades: título, tipo, salaId, vagas, encontros (lista de início/fim). Em erro, mostra o erro e a mensagem crus que a API devolveu (422 DADOS_INVALIDOS, QUANTIDADE_DE_ENCONTROS, ENCONTRO_INVALIDO, VAGAS_ACIMA_DA_CAPACIDADE, 404 NAO_ENCONTRADO, 409 CONFLITO_DE_SALA, 403 SOMENTE_ORGANIZACAO). …
- `16/09 22:49` edita teste `web/src/paginas/criar-atividade/CriarAtividade.test.jsx`
- `16/09 22:49` roda `npx vitest run src/paginas/criar-atividade/CriarAtividade.test.jsx` → **vermelho** — _teste novo falhando, como deve ser_
- `16/09 22:49` edita código `web/src/paginas/criar-atividade/CriarAtividade.jsx`
- `16/09 22:49` roda `npx vitest run src/paginas/criar-atividade/CriarAtividade.test.jsx` → verde (8 passaram) — _fecha um ciclo vermelho → verde_
- `16/09 22:49` edita código `web/src/api.js` (3×)
- `16/09 22:50` edita teste `web/src/api.test.js`
- `16/09 22:50` edita código `web/src/App.jsx`
- `16/09 22:50` roda `npm test` → sem resultado — _teste e código mudaram juntos: não houve vermelho para ver_
- `16/09 22:53` **prompt** — Terminou?
- `16/09 22:53` roda `npm test` → verde (21 passaram)
