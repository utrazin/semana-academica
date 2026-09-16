# Entrevista M1 — Grade de atividades

- Dono: Enzo
- Início: 2026-09-16
- Fonte do que a API responde: `contrato-api.md` seção M1 (fixo, não se negocia)
- Fonte do **quando** cada regra vale: documento de requisitos (RN-*). Consulta feita na rodada 1.
- Regra: toda pergunta de negócio respondida como "consultar requisitos" entra na lista de **pendentes** abaixo e é resolvida só na rodada 2.

## Fatos já resolvidos (contrato, não se negocia)

- Rotas, métodos, quem pode chamar, campos, códigos de erro e ordem geral (401 → 403 → 404 → 422 → regras do recurso).
- `situacao`, `cargaHorariaMinutos`, `ocupadas`, `vagasRestantes`, `emEspera` são **calculados** — nada de job/agendador; derivados no momento da leitura (inclui o relógio de teste parado).
- `ocupadas`/`emEspera`/`vagasRestantes` só têm conteúdo real quando M2 existir; em M1 sozinho refletem um banco sem inscrições (0).
- IDs: `atv_` + 8 hex; encontros: `enc_` + 8 hex.
- Evento: 19 a 23/10/2026, horário de Brasília.

## Rodada 1 (respostas do dono)

| # | Pergunta | Decisão |
|---|---|---|
| P1 | Fronteira do escopo | M1 = `GET /salas`, grade (`GET /atividades` + filtros, `GET /atividades/:id`, `POST`, `PATCH`, `POST /cancelamento`). M2–M5 fora; campos `ocupadas`/`vagasRestantes`/`emEspera` já saem no JSON (0 sem inscrições). |
| P2 | O que aparece na lista | Todas, inclusive canceladas (RN-115). |
| P3 | Ordem da lista | `GET /atividades`: por início do 1º encontro; empate por título (RN-115). `GET /salas`: por nome. |
| P4 | Filtro `?dia=` | Qualquer encontro naquele dia de Brasília conta (RN-116). `?tipo=` inválido → 422 `DADOS_INVALIDOS`. |
| P5 | Qtd. encontros | Palestra: exatamente 1. Minicurso: 2 a 5 (RN-102, RN-103). |
| P6 | Encontro inválido | `ENCONTRO_INVALIDO` se: duração < 1h ou > 4h; atravessa meia-noite; fora de 19–23/10; dois encontros da mesma atividade se sobrepõem (RN-104, 105, 106). |
| P7 | Limites de vagas | Mínimo 1; máximo = capacidade da sala (RN-107). |
| P8 | Título | Sem RN de tamanho. Ausente/tipo errado → 422 `DADOS_INVALIDOS`. Tamanho = decisão do grupo. |
| P9 | Conflito de sala | Intervalo mínimo de 15 min entre encontros na mesma sala (10h14 conflita; 10h15 ok). Canceladas não contam como bloqueadoras (RN-108). |
| P10 | Ordem dos erros no POST | Sem RN. Proposta do dono: `QUANTIDADE_DE_ENCONTROS` → `ENCONTRO_INVALIDO` → `VAGAS_ACIMA_DA_CAPACIDADE` → `CONFLITO_DE_SALA`. |
| P11 | Campos editáveis | Só `titulo` e `vagas`. Qualquer outro → `CAMPO_NAO_EDITAVEL` (RN-110). |
| P12 | Editar iniciada | Sem RN bloqueando; título e vagas editáveis mesmo em `em_andamento`/`encerrada`. |
| P13 | `VAGAS_ABAIXO_DOS_INSCRITOS` | Conta confirmadas + convocadas (quem ocupa vaga); espera não entra (RN-111). |
| P14 | Já iniciada no cancelamento | Relógio chegou ao início do 1º encontro → `ATIVIDADE_JA_INICIADA`, não cancela, mesmo com encontros futuros (RN-112). |
| P15 | Cancelada | Definitivo, sem reversão (RN-113). |
| P16 | `cargaHorariaMinutos` | Soma das durações (fim − início) em minutos (RN-109). Valor do corpo é ignorado. |
| P17 | Transições de `situacao` | `prevista` → `em_andamento` no início do 1º encontro; → `encerrada` no fim do último. Entre encontros segue `em_andamento`. `cancelada` prevalece sempre (RN-114). |

## Rodada 2 (todas as recomendadas aceitas)

| # | Pergunta | Decisão |
|---|---|---|
| P8-b | Tamanho do título | 1 a 120 caracteres, trim obrigatório; vazio ou só espaços → 422 `DADOS_INVALIDOS`. |
| P10-b | Ordens completas | POST: `QUANTIDADE_DE_ENCONTROS` → `ENCONTRO_INVALIDO` → `VAGAS_ACIMA_DA_CAPACIDADE` → `CONFLITO_DE_SALA`. PATCH: `ATIVIDADE_CANCELADA` → `CAMPO_NAO_EDITAVEL` → `VAGAS_ACIMA_DA_CAPACIDADE` → `VAGAS_ABAIXO_DOS_INSCRITOS`. Cancelamento: `ATIVIDADE_CANCELADA` antes de `ATIVIDADE_JA_INICIADA`. |
| P11-b | Não editável idêntico | Qualquer envio de campo não editável (mesmo valor igual ao atual) → `CAMPO_NAO_EDITAVEL`. |
| P11-c | PATCH `{}` | Corpo vazio → 422 `DADOS_INVALIDOS`. Só campos não editáveis → `CAMPO_NAO_EDITAVEL`. |
| P11-d | Campos desconhecidos | Esquema estrito: campo fora do contrato → 422 `DADOS_INVALIDOS`. |
| P2-b | Filtros combinados | `dia`+`tipo` combinam (AND); canceladas entram no resultado filtrado. |
| P5-b | Criar já começada | Criar atividade com 1º encontro no passado do relógio → permitido. |
| P15-b | PATCH/recancelar cancelada | 422 `ATIVIDADE_CANCELADA`. |

## Pendentes → documentado (todas as RN da rodada 1 conferidas)

- (nenhuma pendente por responder "consultar requisitos")

## Fronteira: vazia ✅ (reaberta na rodada 3 e fechada novamente)

## Rodada 3 — buracos apontados depois da spec

| # | Pergunta | Decisão |
|---|---|---|
| P18 | `salaId` inexistente em `POST /atividades` → qual retorno? (404 `NAO_ENCONTRADO` da existência × 422 `DADOS_INVALIDOS` do corpo) | 404 `NAO_ENCONTRADO` (todas as recomendadas). Existência (404) vem antes do corpo (422) na ordem geral do contrato. |
| P19 | A regra "`vagas` de 1 até a capacidade" vale só no criar ou também no alterar? | Vale nos dois: piso 1 e teto = capacidade da sala em criar **e** alterar (todas as recomendadas). |
| P20 | `vagas` veio 0 ou negativo → qual retorno? (não existe código específico) | 422 `DADOS_INVALIDOS` em criar e alterar — corpo fora do domínio (piso 1), antes das regras do recurso (todas as recomendadas). |

## Resumo das decisões (consolidado)

1. **Escopo M1**: salas + grade (criar/alterar/cancelar/listar/filtrar). M2–M5 fora; `ocupadas`/`vagasRestantes`/`emEspera` no JSON com 0 sem inscrições.
2. **Título**: obrigatório, 1–120 chars após trim; vazio/só espaços → 422.
3. **`vagas`**: 1 até capacidade da sala, em **criar e alterar**; 0 ou negativo → 422 `DADOS_INVALIDOS`; teto → `VAGAS_ACIMA_DA_CAPACIDADE`.
4. **Encontros**: palestra = 1; minicurso 2–5, cada um com duração de 1h a 4h inclusive, sem atravessar meia-noite, dentro de 19–23/10, sem sobreposição entre encontros da mesma atividade.
5. **`salaId` inexistente** no POST → 404 `NAO_ENCONTRADO` (checagem de existência antes do corpo).
6. **Conflito de sala**: mínimo 15 min entre encontros na mesma sala; atividades canceladas não bloqueiam.
7. **Campos**: criar = título, tipo, salaId, vagas, encontros; PATCH = só título e vagas.
8. **Ordem PATCH**: `ATIVIDADE_CANCELADA` → `CAMPO_NAO_EDITAVEL` → `VAGAS_ACIMA` → `VAGAS_ABAIXO_DOS_INSCRITOS`.
9. **Ordem POST**: `QUANTIDADE_DE_ENCONTROS` → `ENCONTRO_INVALIDO` → `VAGAS_ACIMA` → `CONFLITO_DE_SALA`.
10. **Cancelamento**: antes do início do 1º encontro; `ATIVIDADE_CANCELADA` precede `ATIVIDADE_JA_INICIADA`; irreversível; PATCH/recancelar em cancelada → 422.
11. **`cargaHorariaMinutos`** = soma das durações; `situacao` calculada no relógio (`prevista`/`em_andamento`/`encerrada`; cancelada sobrepõe).
12. **Lista**: todas as atividades, ordenadas por início do 1º encontro, empate por título; filtros `dia`/`tipo` AND; salas por nome.
13. **Verificação**: cada RN vira cenário de aceite na spec (skill `to-spec`) coberto por teste.