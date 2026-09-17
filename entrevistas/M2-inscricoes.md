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

| # | Pergunta | Decisão | Fonte |
|---|---|---|---|
| P1 | Fronteira do escopo de M2 | M2 abrange inscrições, lista de espera, confirmação e cancelamento de inscrições; M3 (presença), M4 (certificados) e M5 (painel/bloqueios) ficam fora. | — |
| P2 | Prazo de encerramento das inscrições | As inscrições fecham 30 minutos antes do início do 1º encontro. | RN-202 |
| P3 | Lista de espera e atribuição de vagas | Havendo vaga, a inscrição nasce confirmada; sem vaga, nasce em_espera no fim da fila, e lotar não é erro. A posição na espera é calculada, sendo 1 o próximo a ser convocado, na ordem de chegada. "Ocupa vaga" quem está confirmada ou convocada. | RN-205, RN-216 |
| P4 | Convocação e expiração da lista de espera | Toda vaga liberada (por cancelamento, convocação vencida ou aumento de vagas) convoca o 1º da espera, com prazo de 2h para confirmar. O prazo nunca ultrapassa o fecho das inscrições, e vaga liberada depois do fecho não convoca ninguém. Convocação vencida vira expirada, sai da fila e convoca o próximo, com o prazo contado a partir do vencimento, em cascata e mesmo sem ninguém acessar o sistema (calculado na leitura). | RN-211, RN-212, RN-213 |
| P5 | Conflitos de horário e limites (minicurso/palestra) | Conflito de horário — quem vai ocupar vaga não pode ter outra inscrição que ocupe vaga com encontro sobreposto; encostar (um termina e outro começa no mesmo instante) não é conflito; quem está só na espera não é verificado. Limite de minicursos — no máximo 3 minicursos ocupando vaga por participante; palestra não conta e espera não conta. | RN-206, RN-207 |
| P6 | Ordem de precedência de erros na inscrição | Quando mais de uma regra recusa a mesma inscrição, vale a primeira desta ordem: inexistente (404) → atividade cancelada → inscrições encerradas → bloqueio (só em grupo com M5) → já inscrito → conflito de horário → limite de minicursos. | RN-208 |
| P7 | Cancelamento de inscrição e janela | O participante cancela a própria inscrição até a atividade começar (relógio no início do 1º encontro ou depois → ATIVIDADE_JA_INICIADA). Inscrição já cancelada ou expirada não é cancelada de novo → INSCRICAO_INATIVA. Ordem: verifica INSCRICAO_INATIVA antes de ATIVIDADE_JA_INICIADA. | RN-209, RN-210 |
| P8 | Efeito do cancelamento da atividade | Cancelar a atividade cancela todas as inscrições ativas dela (confirmadas, em espera e convocadas). | RN-217 |
| P9 | Privacidade e escopo de visualização/cancelamento | O participante só vê e mexe nas próprias inscrições. A inscrição de outro participante responde 404, não 403, para não revelar que ela existe. | RN-218 |
| P10 | Participação da organização | Só participante se inscreve, cancela e confirma convocação. A organização lista todas as inscrições, mas não se inscreve nem cancela nem confirma por ninguém. Logo, organização nessas rotas de escrita recebe 403 SOMENTE_PARTICIPANTE. | RN-201, RN-219 |
| P11 | Reinscrição | Vale uma única inscrição ativa (confirmada, em espera ou convocada) por participante e atividade. Quem cancelou pode se inscrever de novo, entrando pelo fim da fila. | RN-204 |

## Rodada 2 (Questões de regra de negócio / PENDENTES)

| # | Pergunta | Status |
|---|---|---|
| P2 | Prazo de encerramento das inscrições | Respondida (RN-202) |
| P3 | Lista de espera e atribuição de vagas | Respondida (RN-205, RN-216) |
| P4 | Convocação e expiração da lista de espera | Respondida (RN-211, RN-212, RN-213) |
| P5 | Conflitos de horário e limites (minicurso/palestra) | Respondida (RN-206, RN-207) |
| P6 | Ordem de precedência de erros na inscrição | Respondida (RN-208) |
| P7 | Cancelamento de inscrição e janela | Respondida (RN-209, RN-210) |
| P8 | Efeito do cancelamento da atividade | Respondida (RN-217) |
| P9 | Privacidade e escopo de visualização/cancelamento | Respondida (RN-218) |
| P10 | Participação da organização | Respondida (RN-201, RN-219) |
| P11 | Reinscrição | Respondida (RN-204) |
