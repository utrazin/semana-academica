# TDD: teste de presença em atividade cancelada

| | |
|---|---|
| Sessão | `ses_f4ee909beffeEKoTuiZOYIdWjz` |
| Pasta | semana-academica/api |
| Período | 17/09 17:37 → 17/09 17:39 |
| Modelo | opencode/big-pickle |
| Requisições ao modelo | 15 |
| Tokens de entrada / saída | 77.144 / 13.417 |
| Skills | tdd |
| Subagentes | — |
| Execuções de teste | 0 vermelhas, 2 verdes |
| TDD | 0 ciclo(s) vermelho → verde · 1 teste(s) que já nasceram verdes · 0 vez(es) teste e código juntos |
| Arquivos editados | 1 de teste, 0 de código, 0 de entrevista, 0 de spec, 0 de contexto, 0 de auditoria |
| Alertas | — |

## Linha do tempo

- `17/09 17:37` **prompt** — Use a skill tdd. A auditoria de M3 apontou um achado: a parte 2 do R8 não tem prova. Nenhum teste registra presença (QR ou manual) num encontro de atividade cancelada. Escreva o teste, veja ele falhar, e só então mexa em código — se ele passar de primeira, pare e me diga, porque isso também é informação. Monte o cenário pela cadeia real, não semeando o estado final: semeie a atividade com cancela…
- `17/09 17:37` carrega a skill **tdd**
- `17/09 17:39` edita teste `verificacoes/m3-presenca.spec.js`
- `17/09 17:39` roda `node --test --test-name-pattern="R8 parte 2" "verificacoes/m3-presenca.spec.js"` → verde (1 passaram) — _teste novo já nasceu verde_
- `17/09 17:39` roda `npm test` → verde (91 passaram)
