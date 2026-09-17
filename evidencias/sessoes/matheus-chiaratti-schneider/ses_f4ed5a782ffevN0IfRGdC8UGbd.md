# TDD: três correções dos pareceres

| | |
|---|---|
| Sessão | `ses_f4ed5a782ffevN0IfRGdC8UGbd` |
| Pasta | semana-academica/api |
| Período | 17/09 17:58 → 17/09 18:02 |
| Modelo | opencode/big-pickle |
| Requisições ao modelo | 31 |
| Tokens de entrada / saída | 88.197 / 20.581 |
| Skills | tdd |
| Subagentes | — |
| Execuções de teste | 2 vermelhas, 4 verdes |
| TDD | 2 ciclo(s) vermelho → verde · 1 teste(s) que já nasceram verdes · 0 vez(es) teste e código juntos |
| Arquivos editados | 3 de teste, 2 de código, 0 de entrevista, 4 de spec, 0 de contexto, 0 de auditoria |
| Alertas | — |

## Linha do tempo

- `17/09 17:58` **prompt** — Use a skill tdd. Três correções vindas dos pareceres, uma de cada vez, teste antes do código em todas. 1. Do revisor (achado 1, crítico): corpo com JSON mal formado devolve 400 text/html em vez de 422 DADOS_INVALIDOS. Falta um middleware de erro depois do express.json() em src/app.js:22. Isso atinge a API inteira, não só o M3 — o teste pode ser nas rotas do M3, mas o conserto é global. Acrescente…
- `17/09 17:59` carrega a skill **tdd**
- `17/09 18:01` edita spec `C:/Users/matga/OneDrive/Área de Trabalho/semana-academica/semana-academica/specs/M3-presenca.md` (2×)
- `17/09 18:01` edita teste `verificacoes/m3-presenca.spec.js`
- `17/09 18:01` roda `node --test --test-name-pattern "R25" "verificacoes/m3-presenca.spec.js" 2>&1` → **vermelho** (0 passaram, 1 falharam) — _teste novo falhando, como deve ser_
- `17/09 18:01` edita código `src/app.js`
- `17/09 18:01` roda `node --test "verificacoes/m3-presenca.spec.js" 2>&1` → verde (31 passaram) — _fecha um ciclo vermelho → verde_
- `17/09 18:01` edita spec `C:/Users/matga/OneDrive/Área de Trabalho/semana-academica/semana-academica/specs/M3-presenca.md` (2×)
- `17/09 18:02` edita teste `verificacoes/m3-presenca.spec.js`
- `17/09 18:02` roda `node --test --test-name-pattern "tipo errado" "verificacoes/m3-presenca.spec.js…` → **vermelho** (0 passaram, 1 falharam) — _teste novo falhando, como deve ser_
- `17/09 18:02` edita código `src/app.js`
- `17/09 18:02` roda `node --test "verificacoes/m3-presenca.spec.js" 2>&1 | Select-String -Pattern "^…` → verde (32 passaram) — _fecha um ciclo vermelho → verde_
- `17/09 18:02` edita teste `verificacoes/m3-presenca.spec.js`
- `17/09 18:02` roda `node --test --test-name-pattern "R11" "verificacoes/m3-presenca.spec.js" 2>&1 |…` → verde (1 passaram) — _teste novo já nasceu verde_
- `17/09 18:02` roda `npm test 2>&1 | Select-String -Pattern "^# (tests|pass|fail)"` → verde (93 passaram)
