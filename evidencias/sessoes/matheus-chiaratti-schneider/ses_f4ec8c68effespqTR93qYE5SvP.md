# Fila offline para tela do participante

| | |
|---|---|
| Sessão | `ses_f4ec8c68effespqTR93qYE5SvP` |
| Pasta | semana-academica/web |
| Período | 17/09 18:13 → 17/09 18:15 |
| Modelo | opencode/big-pickle |
| Requisições ao modelo | 18 |
| Tokens de entrada / saída | 67.404 / 20.248 |
| Skills | nova-tela |
| Subagentes | — |
| Execuções de teste | 1 vermelhas, 2 verdes |
| TDD | 1 ciclo(s) vermelho → verde · 0 teste(s) que já nasceram verdes · 0 vez(es) teste e código juntos |
| Arquivos editados | 1 de teste, 1 de código, 0 de entrevista, 0 de spec, 0 de contexto, 0 de auditoria |
| Alertas | — |

## Linha do tempo

- `17/09 18:13` **prompt** — Use a skill nova-tela. Complete a tela do participante com a fila offline: sem internet, a leitura fica guardada e é enviada quando a rede voltar. Como distinguir os dois casos, que é o ponto central: em web/src/api.js, quando a API responde e recusa, o erro tem os campos erro e status; quando a rede falha, o fetch estoura um erro sem status. Então a regra é: erro com status é resposta da API e v…
- `17/09 18:13` carrega a skill **nova-tela**
- `17/09 18:14` roda `Get-ChildItem -Name "C:\Users\matga\OneDrive\Área de Trabalho\semana-academica\…` → verde
- `17/09 18:14` edita teste `src/paginas/presenca-participante/PresencaParticipante.test.jsx`
- `17/09 18:14` roda `npm test -- --root . 2>&1 | Select-Object -Last 60` → **vermelho** (46 passaram, 5 falharam) — _teste novo falhando, como deve ser_
- `17/09 18:15` edita código `src/paginas/presenca-participante/PresencaParticipante.jsx`
- `17/09 18:15` roda `npm test 2>&1 | Select-Object -Last 25` → verde (51 passaram) — _fecha um ciclo vermelho → verde_
