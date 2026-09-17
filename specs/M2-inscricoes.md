# Spec — M2: Inscrições e lista de espera

## 1. Objetivo

Permitir que os participantes se inscrevam nas atividades da Semana Acadêmica 2026, gerenciem suas inscrições (cancelamento e confirmação de convocação) e acompanhem a lista de espera e atribuição automática de vagas. Participantes consultam as próprias inscrições e a organização lista todas; inscrições fecham 30 minutos antes do 1º encontro; vagas liberadas convocam automaticamente o próximo da espera com prazo de 2 horas; conflitos de horário e limite de 3 minicursos são respeitados.

## 2. Fora de escopo

M2 **não** faz:
- Presença por QR (M3).
- Certificados e extrato (M4).
- Painel da organização e bloqueios (M5) — exceto listagem geral de inscrições pela organização.
- Bloqueio por faltas (M5) / código `INSCRICAO_BLOQUEADA` fica inativo ou fora do escopo funcional de M2 (só ativado em grupos com M5).
- Criação de usuário ou atividade (vêm dos dados iniciais ou M1).

## 3. Modelo

**Inscrição**:

| campo | tipo | origem |
|---|---|---|
| `id` | string (`ins_` + 8 hex) | gerado |
| `atividadeId` | string | informado |
| `participanteId` | string | informado (identificação) |
| `status` | `confirmada` \| `em_espera` \| `convocada` \| `cancelada` \| `expirada` | calculado / gerenciado |
| `posicaoNaEspera` | inteiro \| null | calculado (só quando `em_espera`) |
| `convocadaAte` | ISO 8601 com fuso \| null | calculado (só quando `convocada`) |
| `criadaEm` | ISO 8601 com fuso | gerado |

## 4. Endpoints

Identificação (`X-Usuario`) e ordem geral são do contrato: 401 (usuário desconhecido) → 403 (quem pode chamar) → 404 (recurso inexistente) → 422 (corpo) → regras do recurso.

| Método | Rota | Quem | Sucesso |
|---|---|---|---|
| POST | `/atividades/:id/inscricoes` | participante | 201 `Inscricao` (sem corpo na entrada) |
| GET | `/inscricoes` | todos | 200 `[Inscricao]` — participante recebe só as próprias; organização recebe todas; filtro `?atividadeId=` |
| GET | `/inscricoes/:id` | todos | 200 `Inscricao` — participante só vê as próprias; de outro → 404 |
| POST | `/inscricoes/:id/cancelamento` | participante | 200 `Inscricao` |
| POST | `/inscricoes/:id/confirmacao` | participante | 200 `Inscricao` |

## 5. Regras

Cada regra cita a pergunta da entrevista (`P-xx`) que a originou e, quando existe, a regra do documento de requisitos (`RN-xxx`). Sem RN, a fonte é decisão do grupo ou contrato.

- **R1** (P1, decisão do grupo): O escopo de M2 abrange inscrições, lista de espera, confirmação de convocação e cancelamento de inscrições.
- **R2** (P2, RN-202): As inscrições fecham 30 minutos antes do início do 1º encontro da atividade. Tentativa de inscrição a partir de 30 minutos antes do início ou depois → 422 `INSCRICOES_ENCERRADAS`.
- **R3** (P3, RN-205, RN-216): Atribuição de vagas na inscrição: havendo vaga na atividade (número de ocupadas < vagas), a inscrição nasce com status `confirmada` e `posicaoNaEspera: null`; sem vaga, nasce com status `em_espera` no fim da fila. Lotar a atividade ou entrar na espera não é erro. "Ocupa vaga" quem está com status `confirmada` ou `convocada`.
- **R4** (P3, RN-205): A posição na espera (`posicaoNaEspera`) é calculada dinamicamente, sendo 1 o próximo a ser convocado, ordenado pela ordem de chegada (`criadaEm`). Para status diferentes de `em_espera`, `posicaoNaEspera` é `null`.
- **R5** (P4, RN-211, RN-212, RN-213): Convocação e expiração da lista de espera: cada vaga liberada (por cancelamento de inscrição, convocação vencida ou aumento de $N$ vagas na atividade) convoca automaticamente o respectivo número de participantes da fila de espera (um por vaga liberada, convocando os $N$ primeiros da fila), alterando seus status para `convocada` e definindo `convocadaAte` com prazo de 2 horas a partir da liberação. O prazo nunca ultrapassa o fecho das inscrições (30 min antes do 1º encontro); vaga liberada após o fecho não convoca ninguém. Convocação cujo `convocadaAte` venceu sem confirmação vira `expirada`, sai da fila e imediatamente convoca o próximo (em cascata), com novo prazo de 2h (respeitando o fecho das inscrições), calculado na leitura (mesmo sem acesso prévio).
- **R6** (P5, RN-206): Conflito de horário: participante que vai ocupar vaga (`confirmada` ou `convocada`) não pode ter outra inscrição que ocupe vaga (`confirmada` ou `convocada`) com encontro sobreposto. Encostar (um encontro termina exatamente no mesmo instante em que outro começa) não constitui conflito. Quem está apenas na espera (`em_espera`) não é verificado para conflito. Violação → 409 `CONFLITO_DE_HORARIO`.
- **R7** (P5, RN-207): Limite de minicursos: no máximo 3 minicursos ocupando vaga (`confirmada` ou `convocada`) por participante simultaneamente. Palestras não contam, e inscrições em espera (`em_espera`) não contam. Exceder o limite → 422 `LIMITE_DE_MINICURSOS`.
- **R8** (P6, RN-208): Ordem de precedência de erros na inscrição (`POST /atividades/:id/inscricoes`): quando mais de uma regra recusa a mesma inscrição, vale a primeira na ordem: atividade inexistente (404 `NAO_ENCONTRADO`) → atividade cancelada (422 `ATIVIDADE_CANCELADA`) → inscrições encerradas (422 `INSCRICOES_ENCERRADAS`) → bloqueio (422 `INSCRICAO_BLOQUEADA`, se aplicável) → já inscrito (409 `JA_INSCRITO`) → conflito de horário (409 `CONFLITO_DE_HORARIO`) → limite de minicursos (422 `LIMITE_DE_MINICURSOS`).
- **R9** (P7, RN-209, RN-210): Cancelamento de inscrição (`POST /inscricoes/:id/cancelamento`): o participante pode cancelar a própria inscrição enquanto o relógio estiver antes do início do 1º encontro da atividade. Se o relógio estiver no início do 1º encontro ou depois → 422 `ATIVIDADE_JA_INICIADA`. Inscrição que já esteja com status `cancelada` ou `expirada` não pode ser cancelada de novo → 422 `INSCRICAO_INATIVA`.
- **R10** (P7, decisão do grupo / RN-210): No cancelamento de inscrição, a verificação de `INSCRICAO_INATIVA` ocorre antes de `ATIVIDADE_JA_INICIADA`.
- **R11** (P8, RN-217): Cancelamento da atividade: quando uma atividade é cancelada (M1), todas as suas inscrições ativas (`confirmada`, `em_espera`, `convocada`) são automaticamente canceladas (status `cancelada`).
- **R12** (P9, RN-218): Privacidade e escopo de visualização/cancelamento/confirmação: o participante só pode visualizar, cancelar ou confirmar as próprias inscrições. Se um participante tentar acessar, cancelar ou confirmar uma inscrição pertencente a outro participante, a API responde 404 `NAO_ENCONTRADO` (e nunca 403), de forma a não revelar a existência da inscrição alheia.
- **R13** (P10, RN-201, RN-219): Participação da organização: apenas participantes podem se inscrever (`POST /atividades/:id/inscricoes`), cancelar inscrição (`POST /inscricoes/:id/cancelamento`) e confirmar convocação (`POST /inscricoes/:id/confirmacao`). A organização pode listar todas as inscrições (`GET /inscricoes`), mas não pode se inscrever, cancelar ou confirmar por ninguém. Tentativa da organização em rotas de escrita de inscrições responde 403 `SOMENTE_PARTICIPANTE`.
- **R14** (P11, RN-204): Reinscrição: é permitida uma única inscrição ativa (`confirmada`, `em_espera` ou `convocada`) por participante e atividade. Tentativa de nova inscrição enquanto já houver inscrição ativa → 409 `JA_INSCRITO`. Quem cancelou ou teve inscrição expirada/cancelada pode se inscrever novamente na mesma atividade, entrando ao final da fila de espera (ou confirmada, se houver vaga).
- **R15** (P12, RN-215): Confirmação de convocação (`POST /inscricoes/:id/confirmacao`): o participante com inscrição em status `convocada` pode confirmar a vaga dentro do prazo (`convocadaAte`). Ao confirmar, o status muda para `confirmada`, e `convocadaAte` passa a ser `null`.
- **R16** (P13, P14, P15, RN-215, RN-214): Validações na confirmação de convocação:
  - Inscrição sem estar convocada (ex: já `confirmada`, `em_espera`, `cancelada`, `expirada`) → 422 `SEM_CONVOCACAO`.
  - Confirmação após o prazo (`convocadaAte` expirado pelo relógio) → 422 `CONVOCACAO_EXPIRADA` (e a vaga é liberada/repassada).
  - Confirmação que gere conflito de horário com outra inscrição confirmada/convocada → 409 `CONFLITO_DE_HORARIO`.
  - Confirmação que exceda o limite de 3 minicursos → 422 `LIMITE_DE_MINICURSOS`.
  Caso a confirmação seja recusada por conflito de horário ou limite de minicursos, a convocação não é cancelada e continua valendo até o prazo original (`convocadaAte`).

## 6. Critérios de aceite

1. (R3) Participante se inscreve em atividade com vagas disponíveis → 201 com status `confirmada`, `posicaoNaEspera: null`.
2. (R3, R4) Participante se inscreve em atividade lotada → 201 com status `em_espera`, `posicaoNaEspera` correspondente (1, 2, ...).
3. (R2) Participante tenta se inscrever em atividade faltando exatamente 30 minutos para o início do 1º encontro → 422 `INSCRICOES_ENCERRADAS`; faltando 31 minutos → 201.
4. (R5) Cancelamento de inscrição confirmada libera vaga e convoca automaticamente o 1º da espera com `convocadaAte` daqui a 2h; se vencer sem confirmação, vira `expirada` e convoca o próximo em cascata.
5. (R6) Participante com vaga ocupada em atividade com encontro sobreposto tenta se inscrever em outra → 409 `CONFLITO_DE_HORARIO`; encostar (fim = início) → 201 ok; quem está só na espera não gera conflito.
6. (R7) Participante com 3 minicursos ocupando vaga tenta se inscrever num 4º minicurso → 422 `LIMITE_DE_MINICURSOS`; palestras e espera não contam.
7. (R8) Inscrição que viole atividade inexistente (404), atividade cancelada (422 `ATIVIDADE_CANCELADA`) e inscrições encerradas (422) ao mesmo tempo respeita a ordem de precedência (404 primeiro, depois 422 `ATIVIDADE_CANCELADA`, etc.).
8. (R9, R10) Participante tenta cancelar inscrição após o início do 1º encontro → 422 `ATIVIDADE_JA_INICIADA`; tentar cancelar inscrição já inativa (cancelada/expirada) → 422 `INSCRICAO_INATIVA`, verificada antes de `ATIVIDADE_JA_INICIADA`.
9. (R11) Cancelamento da atividade cancela automaticamente todas as suas inscrições ativas (`confirmada`, `em_espera`, `convocada`).
10. (R12) Participante tenta acessar, cancelar ou confirmar inscrição de outro participante → 404 `NAO_ENCONTRADO` (nunca 403).
11. (R13) Organização tenta se inscrever, cancelar ou confirmar inscrição → 403 `SOMENTE_PARTICIPANTE`; organização lista todas com `GET /inscricoes`.
12. (R14) Participante com inscrição ativa tenta se inscrever novamente na mesma atividade → 409 `JA_INSCRITO`; após cancelar, pode se inscrever de novo entrando no fim da fila.
13. (R15, R16) Participante com status `convocada` confirma a tempo → 200 `confirmada`; confirmar sem convocação (`SEM_CONVOCACAO`), após o prazo (`CONVOCACAO_EXPIRADA`), com conflito de horário (`CONFLITO_DE_HORARIO`) ou limite de minicursos (`LIMITE_DE_MINICURSOS`) → respectivos erros.

## 7. Como isto será verificado

Pela costura mais externa que já existe: **HTTP**, na API subida por `npm start` dentro de `api/` (stack do `projeto.json`), com `MODO_TESTE=1`. Cada cenário começa com `POST /_teste/reset`, usa `PUT /_teste/relogio` para fixar o tempo e `X-Usuario` para autenticação. O juiz do contrato confere status, `erro` e corpo nas mesmas rotas, então o teste que exercita a rota real cobre automaticamente regra e contrato.

## 8. Fatias de entrega

1. **Inscrições básicas e listagem**: `POST /atividades/:id/inscricoes` (confirmada e em espera), `GET /inscricoes` e `GET /inscricoes/:id` com privacidade e papéis (R1, R3, R4, R12, R13, R14).
2. **Prazos e cancelamento de inscrição**: Fechamento 30 min antes (R2), cancelamento de inscrição e janela/inativa (R9, R10).
3. **Conflitos e limites**: Conflito de horário (R6) e limite de minicursos (R7), além da ordem de precedência de erros (R8).
4. **Lista de espera e convocação**: Convocação automática, prazo de 2h, expiração em cascata na leitura, aumento de vagas (R5).
5. **Confirmação de convocação**: `POST /inscricoes/:id/confirmacao` e suas regras (R15, R16).
6. **Efeito do cancelamento da atividade**: Cancelamento de atividade afetando inscrições ativas (R11).
