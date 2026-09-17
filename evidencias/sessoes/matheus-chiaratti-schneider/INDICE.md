# Sessões — Matheus Chiaratti Schneider

Cada execução de teste é lida pelo que mudou desde a anterior:

- **Ciclo** — vermelho logo depois de mexer só em teste, e depois verde logo depois de mexer só em código. É o TDD.
- **Nasceu verde** — verde logo depois de mexer só em teste. Ou o comportamento já existia, ou o teste não testa o que diz.
- **Juntos** — teste e código mudaram antes da mesma execução. Não houve vermelho para ver.

**Alertas:** *colou* = prompt com 10 palavras seguidas ou mais iguais às do documento de requisitos (só aparece quando o resumo é gerado com `--requisitos`); *leu* = o agente acessou um arquivo de requisitos; *anexou* = o documento foi anexado à conversa.

Requisições são chamadas ao modelo: cada passo do agente é uma. Skills contam tanto a ferramenta `skill` quanto o comando `/nome`.

| Início | Sessão | Requisições | Skills | Subagentes | Vermelhas / verdes | Ciclos | Nasceu verde | Juntos | Alertas |
|---|---|---|---|---|---|---|---|---|---|
| 17/09 16:21 | [Spec M3-presenca a partir de entrevista](ses_f4f2eeb29ffeJiIdpr2hQoihpG.md) | 19 | to-spec | — | 0 / 0 | 0 | 0 | 0 | — |
| 17/09 16:38 | [TDD fatia 1 de M3-presenca e ajuste da spec](ses_f4f1f5400ffehe4xM0ZIyVLuMY.md) | 111 | tdd (2), regra-de-tempo (2) | — | 13 / 29 | 12 | 4 | 0 | — |
| 17/09 17:05 | [Presença offline (lidoEm) e ordem rota QR](ses_f4f06ebb0ffeEqmAg7R4w6XnyW.md) | 39 | tdd, regra-de-tempo | — | 7 / 7 | 4 | 2 | 0 | — |
| 17/09 17:10 | [Fatia 5 M3-presenca: Presença manual (TDD)](ses_f4f01fc33ffeuCzaSyWcCP34Pq.md) | 5 | tdd, regra-de-tempo | — | 0 / 0 | 0 | 0 | 0 | — |
| 17/09 17:10 | [Implementar fatia 5 presença manual](ses_f4f01a623ffeLl2uISDIWpYWV9.md) | 38 | tdd, regra-de-tempo | — | 6 / 10 | 4 | 3 | 0 | — |
| 17/09 17:21 | [Listagem de presenças com TDD (R22)](ses_f4ef7958effekbwdvhi7QOu0Ht.md) | 14 | tdd | — | 1 / 2 | 1 | 0 | 0 | — |
| 17/09 17:25 | [Auditar módulo M3 contra specs/M3-presenca.md](ses_f4ef47405ffe1cok63p4EAnK24.md) | 5 | — | auditor | 0 / 0 | 0 | 0 | 0 | — |
| 17/09 17:37 | [TDD: teste de presença em atividade cancelada](ses_f4ee909beffeEKoTuiZOYIdWjz.md) | 15 | tdd | — | 0 / 2 | 0 | 1 | 0 | — |
| 17/09 17:40 | [Auditoria do módulo M3 contra specs](ses_f4ee645b3ffePMOM1x2r3BAf6M.md) | 5 | — | auditor | 0 / 0 | 0 | 0 | 0 | — |
| 17/09 17:46 | [Criar subagente revisor-de-contrato](ses_f4ee15213ffeQlH5BTwGVzxNxL.md) | 25 | novo-subagente | — | 0 / 0 | 0 | 0 | 0 | — |
| 17/09 17:53 | [Revisão do módulo M3 contra contrato-api](ses_f4eda4cb6ffeVnL093sBA4CT8S.md) | 5 | — | revisor-de-contrato | 0 / 0 | 0 | 0 | 0 | — |
| 17/09 17:58 | [TDD: três correções dos pareceres](ses_f4ed5a782ffevN0IfRGdC8UGbd.md) | 31 | tdd | — | 2 / 4 | 2 | 1 | 0 | — |
| 17/09 18:06 | [Criar telas M3 de presença por QR](ses_f4ecea76fffebAJQB4pMCEDhXz.md) | 35 | nova-tela | — | 2 / 5 | 2 | 0 | 2 | — |
| 17/09 18:13 | [Fila offline para tela do participante](ses_f4ec8c68effespqTR93qYE5SvP.md) | 18 | nova-tela | — | 1 / 2 | 1 | 0 | 0 | — |
| 17/09 18:17 | [Criar AGENTS.md para api e web](ses_f4ec46762ffeaoUziXJKL3HRD6.md) | 4 | — | — | 0 / 0 | 0 | 0 | 0 | — |
| 17/09 18:19 | [Revisão módulo M3 contra contrato-api.md](ses_f4ec32a8affe04InSEkMFiE3gf.md) | 6 | — | revisor-de-contrato | 0 / 0 | 0 | 0 | 0 | — |
| | **Total: 16 sessões** | 375 | to-spec, tdd (8), regra-de-tempo (5), novo-subagente, nova-tela (2) | auditor (2), revisor-de-contrato (2) | 32 / 61 | 26 | 11 | 2 | — |
