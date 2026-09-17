# Sessões — Ithallo Emanuel

Cada execução de teste é lida pelo que mudou desde a anterior:

- **Ciclo** — vermelho logo depois de mexer só em teste, e depois verde logo depois de mexer só em código. É o TDD.
- **Nasceu verde** — verde logo depois de mexer só em teste. Ou o comportamento já existia, ou o teste não testa o que diz.
- **Juntos** — teste e código mudaram antes da mesma execução. Não houve vermelho para ver.

**Alertas:** *colou* = prompt com 10 palavras seguidas ou mais iguais às do documento de requisitos (só aparece quando o resumo é gerado com `--requisitos`); *leu* = o agente acessou um arquivo de requisitos; *anexou* = o documento foi anexado à conversa.

Requisições são chamadas ao modelo: cada passo do agente é uma. Skills contam tanto a ferramenta `skill` quanto o comando `/nome`.

| Início | Sessão | Requisições | Skills | Subagentes | Vermelhas / verdes | Ciclos | Nasceu verde | Juntos | Alertas |
|---|---|---|---|---|---|---|---|---|---|
| 17/09 08:10 | [Definição de regras do módulo M2 de inscrições](ses_f50f0d836fferct0eCOB2WEJmS.md) | 15 | grilling | — | 0 / 0 | 0 | 0 | 0 | — |
| 17/09 08:21 | [Definição de regras do módulo M2 de inscrições](ses_f50e6bb2effeMrY17vrsT9Suvi.md) | 13 | grilling | — | 0 / 0 | 0 | 0 | 0 | — |
| 17/09 08:30 | [Preenchimento de pendências em M2-inscricoes.md](ses_f50de00a5ffewQcW2q8Hn1kQsU.md) | 61 | — | — | 0 / 0 | 0 | 0 | 0 | — |
| 17/09 08:47 | [Criação da spec specs/M2-inscricoes.md](ses_f50ceda60ffetsa1zvbllgKLxU.md) | 16 | to-spec | — | 0 / 0 | 0 | 0 | 0 | — |
| 17/09 08:59 | [TDD da fatia 1 de inscrições (M2)](ses_f50c33562ffeUyFzgPTh3ACwPd.md) | 78 | tdd | — | 12 / 5 | 2 | 1 | 0 | — |
| 17/09 10:26 | [TDD, Fatia 2 (prazos e cancelamento de inscrição)](ses_f507403b8ffe60SO1qeSKQ0APm.md) | 24 | tdd | — | 2 / 5 | 2 | 1 | 0 | — |
| 17/09 10:35 | [TDD da fatia 3: R6, R7 e R8 de inscrições](ses_f506b575cffevM5N4wFcCAJSnP.md) | 34 | tdd | — | 3 / 7 | 2 | 3 | 0 | — |
| 17/09 10:46 | [TDD, Fatia 4 (lista de espera e convocação)](ses_f5061ca96ffeHZKR3PqFxhxsKR.md) | 31 | tdd | — | 4 / 2 | 0 | 1 | 1 | — |
| 17/09 11:18 | [TDD, Fatia 5 (confirmação de convocação)](ses_f50445e6bffeKb3Zi8uFxlMiIl.md) | 35 | tdd | — | 5 / 6 | 2 | 2 | 0 | — |
| 17/09 11:31 | [TDD, Fatia 6 (cancelamento da atividade em cascata)](ses_f5038d580ffeCgsbG3fzhGp5Di.md) | 23 | tdd | — | 2 / 3 | 1 | 1 | 0 | — |
| 17/09 11:39 | [Relatório de Auditoria — Módulo M2 (Inscrições)](ses_f50316259ffeXti4kuOoidfuog.md) | 6 | — | auditor | 0 / 0 | 0 | 0 | 0 | — |
| 17/09 12:04 | [confirmação de convocação](ses_f5019f817ffezsu1umKyaxsLK4.md) | 12 | grilling | — | 0 / 0 | 0 | 0 | 0 | — |
| 17/09 12:22 | [reforçar provas apontadas como fracas](ses_f500969e6ffehe7aRAL04MLu5v.md) | 21 | — | — | 0 / 8 | 0 | 7 | 0 | — |
| 17/09 12:33 | [Rastreabilidade Atualizada (M2)](ses_f50000f73ffeja7TPwit5Hcw2f.md) | 8 | — | — | 0 / 1 | 0 | 0 | 0 | — |
| 17/09 12:44 | [New session - 2026-09-17T15:44:30.472Z](ses_f4ff58af7ffeYHlycD7XhG7Ng7.md) | 39 | nova-tela | — | 3 / 4 | 0 | 1 | 2 | — |
| | **Total: 15 sessões** | 416 | grilling (3), to-spec, tdd (6), nova-tela | auditor | 31 / 41 | 9 | 17 | 3 | — |
