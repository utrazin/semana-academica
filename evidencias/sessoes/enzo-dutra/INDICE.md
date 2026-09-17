# Sessões — Enzo Dutra

Cada execução de teste é lida pelo que mudou desde a anterior:

- **Ciclo** — vermelho logo depois de mexer só em teste, e depois verde logo depois de mexer só em código. É o TDD.
- **Nasceu verde** — verde logo depois de mexer só em teste. Ou o comportamento já existia, ou o teste não testa o que diz.
- **Juntos** — teste e código mudaram antes da mesma execução. Não houve vermelho para ver.

**Alertas:** *colou* = prompt com 10 palavras seguidas ou mais iguais às do documento de requisitos (só aparece quando o resumo é gerado com `--requisitos`); *leu* = o agente acessou um arquivo de requisitos; *anexou* = o documento foi anexado à conversa.

Requisições são chamadas ao modelo: cada passo do agente é uma. Skills contam tanto a ferramenta `skill` quanto o comando `/nome`.

| Início | Sessão | Requisições | Skills | Subagentes | Vermelhas / verdes | Ciclos | Nasceu verde | Juntos | Alertas |
|---|---|---|---|---|---|---|---|---|---|
| 16/09 19:59 | [Entrevista M1 grade de atividades SemanaAcadêmica](ses_f538e0d90ffehmqIy6ALQB6GRE.md) | 22 | grilling | — | 0 / 0 | 0 | 0 | 0 | — |
| 16/09 20:45 | [Specs M1-grade a partir de entrevistas](ses_f536339f2ffevMexjvZyDKD186.md) | 7 | to-spec | — | 0 / 0 | 0 | 0 | 0 | — |
| 16/09 20:54 | [Criar spec M1-grade a partir de entrevistas](ses_f535b8464ffe2T9ZV3A2ojBcQ5.md) | 8 | to-spec | — | 0 / 0 | 0 | 0 | 0 | — |
| 16/09 21:24 | [Change to api directory](ses_f5340414fffeMXloEJS3jdpjQO.md) | 51 | tdd | — | 7 / 4 | 1 | 0 | 2 | — |
| 16/09 21:33 | [TDD fatia 2 M1-grade: filtros ?dia= e ?tipo=](ses_f533755a9ffeR098UBrcNcod9L.md) | 20 | tdd | — | 3 / 4 | 3 | 0 | 0 | — |
| 16/09 21:40 | [TDD fatia 3: POST /atividades](ses_f53314acbffev3L7o70Fs5y3u3.md) | 44 | tdd | — | 6 / 8 | 4 | 4 | 0 | — |
| 16/09 21:48 | [Implementar fatia 4 de M1-grade com TDD](ses_f532a169fffee0jBiq12LwVqtD.md) | 16 | tdd | — | 0 / 4 | 0 | 3 | 0 | — |
| 16/09 21:53 | [Implementar fatia 5 de M1-grade (PATCH)](ses_f53254ba0ffex8Q6gWWWT6rpOO.md) | 52 | tdd | — | 7 / 13 | 6 | 3 | 0 | — |
| 16/09 22:10 | [Fatia 6: cancelamento e GET atividade](ses_f5315ee57ffeuj3mBQBQnZmo2U.md) | 34 | tdd | — | 2 / 7 | 2 | 3 | 0 | — |
| 16/09 22:16 | [Auditoria do módulo M1 contra specs](ses_f53109b7cffelfGDVQcAvG436l.md) | 7 | — | auditor (2) | 0 / 0 | 0 | 0 | 0 | — |
| 16/09 22:26 | [Navigate to api directory](ses_f5306af74ffezvPh9ELstVNeb5.md) | 13 | — | — | 0 / 1 | 0 | 1 | 0 | — |
| 16/09 22:36 | [Esqueleto web da tela de programação M1](ses_f52fe23c6ffex64fAe77RFqJ6k.md) | 26 | — | — | 1 / 1 | 0 | 1 | 1 | — |
| 16/09 22:43 | [Tela detalhe M1: GET /atividades/:id e 404](ses_f52f7266fffeVbIa43cfvqpisy.md) | 23 | — | — | 3 / 4 | 0 | 2 | 1 | — |
| 16/09 22:47 | [Formulário de atividade POST /atividades](ses_f52f43ba2ffe66AU3XJ17HGO3Q.md) | 27 | — | — | 1 / 2 | 1 | 0 | 1 | — |
| | **Total: 14 sessões** | 350 | grilling, to-spec (2), tdd (6) | auditor (2) | 30 / 48 | 17 | 17 | 5 | — |
