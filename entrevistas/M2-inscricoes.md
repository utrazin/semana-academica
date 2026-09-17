# Entrevista M2 — Inscrições e lista de espera

- Dono: Ithallo Emanuel (ithalloe)
- Início: 2026-09-17
- Fonte do que a API responde: `contrato-api.md` seção M2 (fixo, não se negocia)
- Fonte do **quando** cada regra vale: documento de requisitos.
- Regra: toda pergunta de negócio respondida como "consultar requisitos" entra na lista de **pendentes** e é resolvida só na rodada 2.

## Fatos já resolvidos (contrato, não se negocia)

- Rotas, métodos, quem pode chamar (`POST /atividades/:id/inscricoes`, `POST /inscricoes/:id/cancelamento`, `POST /inscricoes/:id/confirmacao` por participante; `GET /inscricoes`, `GET /inscricoes/:id` por todos).
- Status de inscrição: `confirmada`, `em_espera`, `convocada`, `cancelada`, `expirada`.
- Códigos de erro do contrato: `INSCRICOES_ENCERRADAS`, `INSCRICAO_BLOQUEADA`, `JA_INSCRITO`, `CONFLITO_DE_HORARIO`, `LIMITE_DE_MINICURSOS`, `INSCRICAO_INATIVA`, `SEM_CONVOCACAO`, `CONVOCACAO_EXPIRADA`.
- IDs: `ins_` + 8 hexadecimais minúsculos.
- Evento: 19 a 23/10/2026, horário de Brasília.

## Rodada 1

| # | Pergunta | Decisão |
|---|---|---|
| P1 | Fronteira do escopo de M2 | M2 abrange inscrições, lista de espera, confirmação e cancelamento de inscrições; M3 (presença), M4 (certificados) e M5 (painel/bloqueios) ficam fora. |
| P2 | Prazo de encerramento das inscrições | Consultar requisitos (PENDENTE). |
| P3 | Lista de espera e atribuição de vagas | Consultar requisitos (PENDENTE). |
| P4 | Convocação e expiração da lista de espera | Consultar requisitos (PENDENTE). |
| P5 | Conflitos de horário e limites (minicurso/palestra) | Consultar requisitos (PENDENTE). |
| P6 | Ordem de precedência de erros na inscrição | Consultar requisitos (PENDENTE). |
| P7 | Cancelamento de inscrição e janela | Consultar requisitos (PENDENTE). |
| P8 | Efeito do cancelamento da atividade | Consultar requisitos (PENDENTE). |
| P9 | Privacidade e escopo de visualização/cancelamento | Consultar requisitos (PENDENTE). |
| P10 | Participação da organização | Consultar requisitos (PENDENTE). |
| P11 | Reinscrição | Consultar requisitos (PENDENTE). |

## Rodada 2 (Questões de regra de negócio / PENDENTES)

| # | Pergunta | Status |
|---|---|---|
| P2 | Prazo de encerramento das inscrições | PENDENTE |
| P3 | Lista de espera e atribuição de vagas | PENDENTE |
| P4 | Convocação e expiração da lista de espera | PENDENTE |
| P5 | Conflitos de horário e limites (minicurso/palestra) | PENDENTE |
| P6 | Ordem de precedência de erros na inscrição | PENDENTE |
| P7 | Cancelamento de inscrição e janela | PENDENTE |
| P8 | Efeito do cancelamento da atividade | PENDENTE |
| P9 | Privacidade e escopo de visualização/cancelamento | PENDENTE |
| P10 | Participação da organização | PENDENTE |
| P11 | Reinscrição | PENDENTE |
