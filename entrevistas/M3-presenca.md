# Entrevista M3 — Presença por QR

- Dono: Matheus Chiaratti Schenider (Matzikaaa)
- Início: 2026-09-17
- Fonte do que a API responde: `contrato-api.md` seção M3 (fixo, não se negocia)
- Fonte do **quando** cada regra vale: documento de requisitos (RN-\*).
- Dependências: encontros de M1 (`specs/M1-grade.md`) e inscrições de M2 (`specs/M2-inscricoes.md`).
- Regra: toda pergunta de negócio respondida como "consultar requisitos" entra na lista de **pendentes** (rodada 2) e é resolvida só na rodada 2.

## Fatos já resolvidos (contrato, não se negocia)

- Seção 6: `ATIVIDADE_CANCELADA` só aparece em "obter código" no M3 — **não** está listada para `POST .../presencas` nem `POST .../presencas/manual`. (Correção da rodada de revisão do dono.)
- Rotas, métodos e quem chama:
  - `GET /encontros/:id/codigo` — organização — 200 `CodigoDoEncontro`.
  - `POST /encontros/:id/presencas` — participante — 201 na primeira vez; 200 nas demais (repetir não é erro).
  - `POST /encontros/:id/presencas/manual` — organização — 201 na primeira vez; 200 nas demais.
  - `GET /encontros/:id/presencas` — organização — 200 `[Presenca]`.
- `CodigoDoEncontro`: `encontroId`, `codigo` (6 caracteres), `trocaEm` (quando buscar o próximo), `validoAte` (primeiro instante em que o código deixa de ser aceito).
- Entrada `POST /encontros/:id/presencas`: `{ "codigo", "lidoEm"? }` — `lidoEm` é opcional (leitura sem internet → origem `qr_offline`).
- Entrada manual: `{ "participanteId", "justificativa" }` — `justificativa` ausente também é `JUSTIFICATIVA_OBRIGATORIA`.
- Entrada `lidoEm`: não-string ou que não dá para interpretar como data → 422 `DADOS_INVALIDOS` (seção 1, tipo errado).
- `Presenca`: `id` (`pre_` + 8 hex), `encontroId`, `participanteId`, `origem` (`qr` | `qr_offline` | `manual`), `lidoEm` (instante que valeu para as regras), `registradaEm`, `justificativa` (só quando manual).
- Erros do M3: `ATIVIDADE_CANCELADA`, `FORA_DA_JANELA`, `CODIGO_INVALIDO`, `NAO_INSCRITO` (403), `SINCRONIZACAO_TARDIA`, `JUSTIFICATIVA_OBRIGATORIA`, `LIMITE_DE_MANUAIS`.
- Ordem geral do contrato: 401 → 403 (perfil) → 404 (existência) → 422 (corpo) → regras do recurso. A ordem **entre** as regras do recurso é regra de negócio.
- Modo de teste (seção 3): relógio parado; toda regra que depende de tempo usa o relógio (`_teste/relogio`); `reset` recarrega os dados iniciais.
- Encontros vêm de M1: palestra tem exatamente 1 encontro; minicurso de 2 a 5; cada encontro tem `id` (`enc_` + 8 hex), `inicio`, `fim`.
- Inscrições vêm de M2: status `confirmada`, `em_espera`, `convocada`, `cancelada`, `expirada`; quem ocupa vaga = `confirmada` + `convocada`.

## Rodada 1 (respostas do dono)

| # | Pergunta | Decisão | Fonte |
|---|---|---|---|
| P1 | Fronteira do escopo: o que M3 faz e o que NÃO faz. | M3 = gerar código do encontro, registrar presença (online, offline e manual) e listar presenças de um encontro. Fora: certificado/extrato (M4); painel, frequência, sem-chance e bloqueio (M5); criar/cancelar atividade e encontro (M1); inscrever, cancelar e convocar (M2). M3 lê a inscrição para decidir quem pode registrar, mas não cria nem altera inscrição. | — |
| P2 | Janela para `GET /encontros/:id/codigo` (`FORA_DA_JANELA`): em que instantes a organização pode obter código? | PENDENTE | |
| P3 | Janela para presença por QR (`FORA_DA_JANELA`): em que instantes o participante pode registrar? | PENDENTE | |
| P4 | Janela para presença manual (`FORA_DA_JANELA`): em que instantes a organização pode registrar? | PENDENTE | |
| P5 | Validade e rotação do código: quanto vale; chamadas repetidas dentro do período devolvem o mesmo código; `trocaEm`/`validoAte` calculados na leitura? | Mecânica: código estável dentro do seu período; GET repetido no mesmo período devolve o mesmo código; `trocaEm`/`validoAte` calculados na leitura a partir do relógio, sem nada guardado. Duração do período: PENDENTE. | decisão do grupo / |
| P6 | O que separa `trocaEm` de `validoAte` (por que são dois instantes e não um)? | PENDENTE — saber se `validoAte` fica depois de `trocaEm` (sobra tempo em que o código que já saiu da tela ainda é aceito) e quanto é esse tempo. | |
| P7 | O que conta como `CODIGO_INVALIDO`? | Tudo que não é um código aceito para aquele encontro no instante que vale (P11): código inexistente, de outro encontro, já fora do `validoAte`, tamanho errado. Separar de corpo mal formado: `codigo` ausente ou não-string → `DADOS_INVALIDOS` (seção 1); string de 3 letras → `CODIGO_INVALIDO` (tipo certo, valor que não serve). | decisão do grupo |
| P8 | Quem pode registrar / `NAO_INSCRITO`: vale igual para presença QR **e** presença manual? | PENDENTE | |
| P9 | Segundo registro na mesma rota (201 → 200): devolve a mesma `Presenca`, sem sobrescrever? | PENDENTE | |
| P10 | Cruzamento das rotas: manual em cima de presença QR existente, e QR depois de uma manual — o que acontece? | PENDENTE | |
| P11 | `lidoEm` presente: contra qual instante as regras (janela, validade do código) são aplicadas — o da leitura ou o da chegada? | PENDENTE | |
| P12 | `lidoEm` adiantado (futuro) ou de muito tempo atrás: o que acontece? | PENDENTE — do contrato já sai: `lidoEm` não-string ou não interpretável como data → 422 `DADOS_INVALIDOS`. | |
| P13 | `SINCRONIZACAO_TARDIA`: quanto de atraso entre `lidoEm` e a chegada é tolerado? | PENDENTE | |
| P14 | Código digitado à mão (6 caracteres): quais caracteres usa e a digitação diferencia maiúscula de minúscula? | Alfabeto alfanumérico maiúsculo sem ambíguos (sem O, 0, I, 1). Para conferir o enviado, normalizar: tirar espaços das pontas e subir para maiúscula antes de comparar (minúscula digitada não é recusada à toa). Se a rodada 2 mostrar charset fixado no documento, voltar e corrigir. | decisão do grupo |
| P15 | `JUSTIFICATIVA_OBRIGATORIA`: justificativa vazia ou só com espaços dispara o erro? | Sim — ausente, string vazia ou só com espaços → `JUSTIFICATIVA_OBRIGATORIA`. Mesma leitura de trim do `titulo` do M1. | decisão do grupo |
| P16 | Atividade cancelada: `ATIVIDADE_CANCELADA` em "obter código" (seção 6); nas rotas de presença/manual o código não existe — o que vale em cada caso? | PENDENTE — os dois pedaços: ordem entre `ATIVIDADE_CANCELADA` e `FORA_DA_JANELA` no obter código; o que acontece ao registrar presença numa atividade cancelada. Não decidir pelo silêncio da seção 6 (M2 R11 já cancela as inscrições ativas quando a atividade é cancelada). | |
| P17 | `LIMITE_DE_MANUAIS`: o limite é por encontro, por atividade ou por participante? Qual o teto? | PENDENTE | |
| P18 | Ordem de precedência na presença QR (`FORA_DA_JANELA`, `CODIGO_INVALIDO`, `NAO_INSCRITO`, `SINCRONIZACAO_TARDIA`). | PENDENTE | |
| P19 | Ordem de precedência na presença manual (`FORA_DA_JANELA`, `NAO_INSCRITO`, `JUSTIFICATIVA_OBRIGATORIA`, `LIMITE_DE_MANUAIS` — sem `ATIVIDADE_CANCELADA`, corrigido). | PENDENTE | |
| P20 | Ordem da listagem `GET /encontros/:id/presencas`. | Por nome do participante; desempate por `participanteId`. Não usar `registradaEm`: no modo de teste o relógio fica parado, várias presenças na mesma janela teriam `registradaEm` idêntico e a ordem ficaria indefinida. | decisão do grupo |
| P21 | Passagem de tempo sem acesso: janelas e validade do código calculadas na leitura (relógio parado no teste); código com `validoAte` no passado é recusado mesmo sem a rotação ter sido buscada? | Sim — tudo calculado na leitura, pelo relógio; código com `validoAte` vencido é recusado mesmo sem ninguém ter buscado a rotação. Mesmo padrão do M1 (`situacao`) e do M2 (expiração em cascata na leitura). | decisão do grupo |

## Rodada 2 (Questões de regra de negócio / PENDENTES)

| # | Pergunta | Status |
|---|---|---|
| P2 | Janela para obter código | PENDENTE |
| P3 | Janela para presença por QR | PENDENTE |
| P4 | Janela para presença manual | PENDENTE |
| P5 | Duração do período de validade/rotação do código (mecânica já decidida) | PENDENTE |
| P6 | Relação `trocaEm` × `validoAte` (se `validoAte` fica depois de `trocaEm` e quanto) | PENDENTE |
| P8 | `NAO_INSCRITO` — quem pode registrar (QR e manual) | PENDENTE |
| P9 | Segundo registro na mesma rota (201 → 200) | PENDENTE |
| P10 | Cruzamento manual × QR | PENDENTE |
| P11 | Instante das regras com `lidoEm` (leitura × chegada) | PENDENTE |
| P12 | `lidoEm` adiantado (futuro) ou muito antigo | PENDENTE |
| P13 | Tolerância de `SINCRONIZACAO_TARDIA` | PENDENTE |
| P16 | Atividade cancelada — ordem no obter código e registro em atividade cancelada | PENDENTE |
| P17 | `LIMITE_DE_MANUAIS` — unidade e teto | PENDENTE |
| P18 | Ordem de precedência na presença QR | PENDENTE |
| P19 | Ordem de precedência na presença manual | PENDENTE |