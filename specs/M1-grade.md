# Spec — M1: Grade de atividades

## 1. Objetivo

Permitir que a organização monte e gerencie a grade da Semana Acadêmica 2026: consultar
salas, criar, alterar, cancelar, listar e filtrar atividades — cada uma com seus encontros,
vagas e sala. Qualquer pessoa autenticada consulta; só organização escreve. Campos derivados
(`cargaHorariaMinutos`, `situacao`, `ocupadas`, `vagasRestantes`, `emEspera`) são calculados
no momento da leitura, sem job nem agendador.

## 2. Fora de escopo

M1 **não** faz:
- Inscrições, lista de espera, convocação (M2).
- Presença por QR (M3).
- Certificados e extrato (M4).
- Painel da organização e bloqueios (M5).
- Criar usuário, sala ou evento — vêm dos dados iniciais (contrato seção 4).
- Persistir `ocupadas`, `vagasRestantes`, `emEspera` ou `cargaHorariaMinutos` — são derivados.
- Persistir `situacao` — derivada do relógio.
- Editar qualquer campo além de `titulo` e `vagas` (tipo, sala, encontros são fixados na criação).
- Regras que dependem de inscrições existentes: em M1 o banco não tem inscrições, então
  `ocupadas`/`vagasRestantes`/`emEspera` saem 0. `VAGAS_ABAIXO_DOS_INSCRITOS` só passa a
  ter efeito real quando M2 existir.

## 3. Modelo

**Sala** — informado pelo cliente (dados iniciais, contrato seção 4):

| campo | tipo | origem |
|---|---|---|
| `id` | string | dados iniciais |
| `nome` | string | dados iniciais |
| `capacidade` | inteiro | dados iniciais |

**Atividade**:

| campo | tipo | origem |
|---|---|---|
| `id` | string (`atv_` + 8 hex) | gerado |
| `titulo` | string | informado (1–120, ver R7) |
| `tipo` | `palestra` \| `minicurso` | informado |
| `salaId` | string | informado |
| `vagas` | inteiro | informado |
| `encontros` | `[Encontro]` | informado |
| `cargaHorariaMinutos` | inteiro | calculado (R27) |
| `situacao` | `prevista` \| `em_andamento` \| `encerrada` \| `cancelada` | calculado (R28) |
| `ocupadas` | inteiro | calculado (R29) |
| `vagasRestantes` | inteiro | calculado (R29) |
| `emEspera` | inteiro | calculado (R29) |

**Encontro**:

| campo | tipo | origem |
|---|---|---|
| `id` | string (`enc_` + 8 hex) | gerado |
| `inicio` | ISO 8601 com fuso | informado |
| `fim` | ISO 8601 com fuso | informado |

Na resposta, `encontros` sai em ordem de início (contrato seção 5).

## 4. Endpoints

Identificação (`X-Usuario`) e ordem geral são do contrato: 401 (usuário desconhecido) → 403
(quem pode chamar) → 404 (recurso inexistente) → 422 (corpo) → regras do recurso.

| Método | Rota | Quem | Sucesso |
|---|---|---|---|
| GET | `/salas` | todos | 200 `[Sala]` |
| GET | `/atividades` | todos | 200 `[Atividade]` — filtros `?dia=AAAA-MM-DD` e `?tipo=palestra\|minicurso` |
| GET | `/atividades/:id` | todos | 200 `Atividade` |
| POST | `/atividades` | organização | 201 `Atividade` |
| PATCH | `/atividades/:id` | organização | 200 `Atividade` |
| POST | `/atividades/:id/cancelamento` | organização | 200 `Atividade` |

POST espera `{ titulo, tipo, salaId, vagas, encontros }`. PATCH aceita qualquer subconjunto
editável de `{ titulo, vagas }`. Sala inexistente em POST → 404 `NAO_ENCONTRADO` (R14);
atividade inexistente em GET/PATCH/cancelamento → 404 `NAO_ENCONTRADO`.

## 5. Regras

Cada regra cita a pergunta da entrevista (P-xx) que a originou e, quando existe, a regra
do documento de requisitos (RN-xxx). Sem RN, a fonte é decisão do grupo.

### Listagem

- **R1** (P2, RN-115): `GET /atividades` retorna todas as atividades, inclusive canceladas.
- **R2** (P3, RN-115): `GET /atividades` ordena por início do 1º encontro (o mais cedo
  primeiro); empate por `titulo`. Atividade sem encontros não existe (ver R8), então toda
  atividade tem 1º encontro.
- **R3** (P3, decisão do grupo): `GET /salas` ordena por `nome`.
- **R4** (P4, RN-116): filtro `?dia=AAAA-MM-DD` — a atividade entra no resultado se **qualquer**
  encontro cai naquele dia, no fuso de Brasília (o filtro compara o dia do instante, não o texto).
- **R5** (P4, decisão do grupo): `?tipo=` diferente de `palestra` ou `minicurso` → 422
  `DADOS_INVALIDOS`.
- **R6** (P2-b, decisão do grupo): os filtros `dia` e `tipo` combinam (AND). Atividades
  canceladas entram no resultado filtrado normalmente.
- **R7** (P8, P8-b, decisão do grupo): `titulo` obrigatório; após trim obrigatório tem 1 a 120
  caracteres. Ausente, tipo errado, vazio ou só espaços → 422 `DADOS_INVALIDOS`.

### Criação (POST /atividades)

- **R8** (P5, RN-102, RN-103): `palestra` tem exatamente 1 encontro; `minicurso` tem de 2 a 5.
  Violação → 422 `QUANTIDADE_DE_ENCONTROS`.
- **R9** (P6, RN-104, RN-105, RN-106): encontro inválido → 422 `ENCONTRO_INVALIDO` quando:
  duração (fim − início) < 1 hora ou > 4 horas; atravessa meia-noite; qualquer parte fora de
  19 a 23/10/2026 (horário de Brasília); ou dois encontros da mesma atividade se sobrepõem.
- **R10** (P7, P19, P20, RN-107): `vagas` mínimo 1; máximo = capacidade da sala. Essa faixa
  vale em criar **e** alterar. Acima da capacidade → 422 `VAGAS_ACIMA_DA_CAPACIDADE`.
  `vagas` 0 ou negativo → 422 `DADOS_INVALIDOS` (corpo fora do domínio, checado nas regras de
  corpo, antes das regras do recurso). Vale também no PATCH.
- **R11** (P9, RN-108): encontros de atividades **não canceladas** na mesma sala precisam de no
  mínimo 15 min entre fim de um e início do próximo (10h14 conflita; 10h15 ok). Violação →
  409 `CONFLITO_DE_SALA`. Atividades canceladas não bloqueiam.
- **R12** (P10-b, decisão do grupo): no POST, quando mais de uma regra recusa, vale a primeira
  na ordem `QUANTIDADE_DE_ENCONTROS` → `ENCONTRO_INVALIDO` → `VAGAS_ACIMA_DA_CAPACIDADE` →
  `CONFLITO_DE_SALA`.
- **R13** (P5-b, decisão do grupo): criar atividade com o 1º encontro no passado do relógio é
  permitido (`situacao` já nasce no valor que o relógio mandar, ver R28).
- **R14** (P18, decisão do grupo): `salaId` inexistente em POST → 404 `NAO_ENCONTRADO`. A
  existência (404) vem antes do corpo (422) na ordem geral do contrato, então um corpo inválido
  junto com sala inexistente também responde 404.

### Edição (PATCH /atividades/:id)

- **R15** (P11, RN-110): só `titulo` e `vagas` são editáveis. Qualquer outro campo do contrato
  no corpo → 422 `CAMPO_NAO_EDITAVEL`.
- **R16** (P11-b, RN-110): enviar campo não editável mesmo com valor idêntico ao atual → 422
  `CAMPO_NAO_EDITAVEL`.
- **R17** (P11-c, decisão do grupo): corpo vazio (`{}`) → 422 `DADOS_INVALIDOS`. Corpo só com
  campos não editáveis → 422 `CAMPO_NAO_EDITAVEL`.
- **R18** (P11-d, decisão do grupo): esquema estrito — campo que não existe no contrato →
  422 `DADOS_INVALIDOS` (tanto no POST quanto no PATCH).
- **R19** (P12, decisão do grupo): `titulo` e `vagas` são editáveis mesmo em
  `em_andamento`/`encerrada` (nenhuma regra bloqueia).
- **R20** (P13, RN-111): reduzir `vagas` a um valor menor que os inscritos atuais → 409
  `VAGAS_ABAIXO_DOS_INSCRITOS`. Conta confirmadas + convocadas (quem ocupa vaga); a espera não
  entra no cálculo.
- **R21** (P15-b, RN-113): PATCH em atividade `cancelada` → 422 `ATIVIDADE_CANCELADA`.
- **R22** (P10-b, decisão do grupo): no PATCH, quando mais de uma regra recusa, vale a primeira
  na ordem `ATIVIDADE_CANCELADA` → `CAMPO_NAO_EDITAVEL` → `VAGAS_ACIMA_DA_CAPACIDADE` →
  `VAGAS_ABAIXO_DOS_INSCRITOS`.

### Cancelamento (POST /atividades/:id/cancelamento)

- **R23** (P14, RN-112): cancela só enquanto o relógio ainda não chegou ao início do 1º
  encontro. Relógio no início do 1º encontro ou depois → 422 `ATIVIDADE_JA_INICIADA`, ainda que
  existam encontros futuros.
- **R24** (P15, RN-113): cancelamento é definitivo e irreversível; não existe rota de reversão.
- **R25** (P15-b, RN-113): cancelar uma atividade já cancelada → 422 `ATIVIDADE_CANCELADA`.
- **R26** (P10-b, decisão do grupo): no cancelamento, `ATIVIDADE_CANCELADA` é verificada antes
  de `ATIVIDADE_JA_INICIADA`.

### Derivados

- **R27** (P16, RN-109): `cargaHorariaMinutos` = soma das durações (fim − início) de todos os
  encontros, em minutos. Qualquer valor no corpo é ignorado.
- **R28** (P17, RN-114): `situacao` segue o relógio: `prevista` até o início do 1º encontro;
  `em_andamento` do início do 1º encontro até o fim do último (entre encontros segue
  `em_andamento`); `encerrada` a partir do fim do último encontro — o fim é inclusivo, ou seja,
  no instante exato do fim do último encontro já vale `encerrada`. `cancelada` prevalece sempre.
- **R29** (P1, contrato): `ocupadas`, `vagasRestantes` e `emEspera` são calculadas na leitura
  (não persistidas). Em M1, sem inscrições no banco, valem 0 (e `vagasRestantes` = `vagas`).

## 6. Critérios de aceite

1. (R1, R2, R6) Com 3 atividades criadas (uma cancelada), `GET /atividades` retorna as 3, em
   ordem de 1º encontro, empates por título, incluindo a cancelada; com `?tipo=` aplica AND
   com `?dia=`.
2. (R3) `GET /salas` retorna salas em ordem de `nome`.
3. (R4) Atividade com encontro às `2026-10-20T19:00:00-03:00` entra em `?dia=2026-10-20` (e
   não em `?dia=2026-10-19`, apesar de o fuso poder mudar o texto).
4. (R5, R18) `GET /atividades?tipo=oficina` → 422 `DADOS_INVALIDOS`; POST com campo
   `{"duracao": 60}` fora do contrato → 422 `DADOS_INVALIDOS`.
5. (R7) POST sem `titulo`, com `titulo: ""`, `titulo: "   "` ou `titulo` com 121 chars → 422
   `DADOS_INVALIDOS`; com 120 chars → 201.
6. (R8) `palestra` com 2 encontros → 422 `QUANTIDADE_DE_ENCONTROS`; `minicurso` com 1 ou 6
   encontros → 422 `QUANTIDADE_DE_ENCONTROS`; `minicurso` com 2 e com 5 → 201.
7. (R9) Encontro com 59 min de duração → `ENCONTRO_INVALIDO`; com 4h01 → `ENCONTRO_INVALIDO`;
   com exatamente 1h e com exatamente 4h → OK; encontro cortando a meia-noite → inválido;
   encontro fora de 19–23/10 → inválido; dois encontros da mesma atividade sobrepostos →
   `ENCONTRO_INVALIDO` (nunca `CONFLITO_DE_SALA`).
8. (R10) `vagas: 0` → 422 `DADOS_INVALIDOS`; `vagas: -5` → 422 `DADOS_INVALIDOS`; `vagas` acima
   da capacidade da sala → 422 `VAGAS_ACIMA_DA_CAPACIDADE`; `vagas` = capacidade → 201. No
   PATCH o mesmo limiar vale (`vagas: 0` → `DADOS_INVALIDOS`, acima da capacidade →
   `VAGAS_ACIMA_DA_CAPACIDADE`).
9. (R11) Encontro começando 14 min após o fim de outro na mesma sala → 409 `CONFLITO_DE_SALA`;
   começando exatamente 15 min depois → 201. Uma atividade cancelada que estaria em conflito
   não bloqueia a criação.
10. (R12) POST que viole `QUANTIDADE_DE_ENCONTROS` e `CONFLITO_DE_SALA` ao mesmo tempo → 422
    `QUANTIDADE_DE_ENCONTROS` (primeira na ordem).
11. (R14) POST com `salaId` inexistente e corpo válido → 404 `NAO_ENCONTRADO`. POST com
    `salaId` inexistente e corpo inválido → 404 `NAO_ENCONTRADO` (existência antes do corpo).
12. (R15, R16, R17, R18) PATCH enviando `salaId` ou `tipo` (mesmo iguais aos atuais, R16) → 422
    `CAMPO_NAO_EDITAVEL`; PATCH `{}` → 422 `DADOS_INVALIDOS` (R17); PATCH só com `tipo` → 422
    `CAMPO_NAO_EDITAVEL` (R17); PATCH com `tipo` e `titulo` válidos → 422 `CAMPO_NAO_EDITAVEL`
    (R15 vale primeiro na ordem de R22).
13. (R19) PATCH de `titulo`/`vagas` funciona em atividade `em_andamento` e `encerrada` → 200
    com os novos valores.
14. (R20) Atividade com 2 inscrições confirmadas e `vagas: 1` → 409
    `VAGAS_ABAIXO_DOS_INSCRITOS`. (Com M2 o cenário usa inscrições reais; em M1 o teste de
    unidade cobre o cálculo da contagem confirmadas+convocadas.)
15. (R21, R22) PATCH em atividade cancelada com corpo que também tenha campo não editável →
    422 `ATIVIDADE_CANCELADA` (primeira na ordem).
16. (R23) Cancelamento com relógio antes do início do 1º encontro → 200 `cancelada`
    (R28). Relógio avançado até o início do 1º encontro → 422 `ATIVIDADE_JA_INICIADA`, mesmo
    com o 2º encontro no futuro.
17. (R24, R25, R26) Cancelar atividade já cancelada → 422 `ATIVIDADE_CANCELADA`; não existe
    reversão (nenhuma rota restaura `prevista`/`em_andamento`).
18. (R27, R29) `POST` ignorando `cargaHorariaMinutos` enviado no corpo: atividade com 2
    encontros de 3h → `cargaHorariaMinutos: 360`. `ocupadas`/`emEspera` 0 e
    `vagasRestantes` igual a `vagas` na resposta de qualquer rota.
19. (R28) Com relógio parado: antes do 1º encontro → `prevista`; no início do 1º → `em_andamento`;
    entre encontros → `em_andamento`; após o fim do último → `encerrada`; cancelada sobrepõe
    qualquer estado.
20. (R13) Criar atividade com 1º encontro no passado do relógio → 201, com `situacao`
    derivada do relógio (`em_andamento`/`encerrada`), sem bloqueio.

## 7. Como isto será verificado

Pela costura mais externa que já existe: **HTTP**, na API subida por `npm start` dentro de
`api/` (stack do `projeto.json`), com `MODO_TESTE=1`. Cada cenário começa com
`POST /_teste/reset`, usa `PUT /_teste/relogio` para fixar o tempo e `X-Usuario` para
autenticação. O juiz do contrato confere status, `erro` e corpo nas mesmas rotas, então o teste
que exercita a rota real cobre automaticamente regra e contrato. M2 ainda não existe: os
cenários que dependem de inscrições (R20) rodam só quando M2 surgir — até lá o cálculo é
provado por teste direto da função de contagem.

## 8. Fatias de entrega

1. **Salas + listagem**: `GET /salas` (R3), `GET /atividades` sem filtros (R1, R2).
2. **Filtros**: `?dia` (R4), `?tipo` e validação (R5), combinação AND e canceladas (R6).
3. **Criação**: `POST /atividades` com título (R7), quantidade de encontros (R8), validade de
   encontro (R9), vagas (R10), conflito de sala (R11), ordem de erros (R12), passado permitido
   (R13), sala inexistente → 404 (R14).
4. **Cálculos no relógio**: `cargaHorariaMinutos` (R27), `situacao` (R28),
   `ocupadas`/`vagasRestantes`/`emEspera` (R29) — derivados na leitura, com `_teste/relogio`.
5. **Edição**: `PATCH` — campos editáveis e ordem (R15–R18, R22), iniciada/editável (R19),
   abaixo dos inscritos (R20), cancelada (R21).
6. **Cancelamento**: `POST cancelamento` — janela (R23), irreversível (R24), já cancelada
   (R25), ordem (R26); e `GET /atividades/:id` cobrindo a resposta completa.