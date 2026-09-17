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
| P2 | Janela para `GET /encontros/:id/codigo` (`FORA_DA_JANELA`): em que instantes a organização pode obter código? | A organização só obtém o código dentro da mesma janela de registro da RN-301: de 15 minutos antes do início do encontro até 30 minutos depois do início, bordas incluídas. Fora disso, `FORA_DA_JANELA`. Em atividade cancelada também não sai código: `ATIVIDADE_CANCELADA`. | RN-302 |
| P3 | Janela para presença por QR (`FORA_DA_JANELA`): em que instantes o participante pode registrar? | De 15 minutos antes do início do encontro até 30 minutos depois do início — não depois do fim. Os dois extremos estão dentro da janela. Exemplo do cliente: encontro das 19:00 às 22:00 tem janela de 18:45:00 a 19:30:00. | RN-301 |
| P4 | Janela para presença manual (`FORA_DA_JANELA`): em que instantes a organização pode registrar? | A presença manual tem janela maior: abre junto com a janela da RN-301 (15 min antes do início) e vai até 2 horas depois do fim do encontro. | RN-312 |
| P5 | Validade e rotação do código: quanto vale; chamadas repetidas dentro do período devolvem o mesmo código; `trocaEm`/`validoAte` calculados na leitura? | Mecânica: código estável dentro do seu período; GET repetido no mesmo período devolve o mesmo código; `trocaEm`/`validoAte` calculados na leitura a partir do relógio, sem nada guardado. Duração: o código troca a cada minuto, em janelas alinhadas ao relógio — cada código vale para o minuto cheio, de hh:mm:00 a hh:mm:59. | decisão do grupo / RN-303 |
| P6 | O que separa `trocaEm` de `validoAte` (por que são dois instantes e não um)? | `validoAte` fica depois de `trocaEm`, com um minuto de sobreposição: são aceitos o código do minuto corrente e o do minuto anterior. Para o código da janela das 19:03, `trocaEm` é 19:04:00 (quando a tela busca o próximo) e `validoAte` é 19:05:00 (primeiro instante em que ele deixa de ser aceito). Exemplo do cliente: código obtido às 19:03:20 e enviado às 19:04:59 ainda vale; às 19:05:00 dá `CODIGO_INVALIDO`. Código de outro encontro também é recusado. | RN-304 |
| P7 | O que conta como `CODIGO_INVALIDO`? | Tudo que não é um código aceito para aquele encontro no instante que vale (P11): código inexistente, de outro encontro, já fora do `validoAte`, tamanho errado. Separar de corpo mal formado: `codigo` ausente ou não-string → `DADOS_INVALIDOS` (seção 1); string de 3 letras → `CODIGO_INVALIDO` (tipo certo, valor que não serve). | decisão do grupo |
| P8 | Quem pode registrar / `NAO_INSCRITO`: vale igual para presença QR **e** presença manual? | Só registra presença quem tem inscrição com status `confirmada`. `convocada`, `em_espera`, `cancelada` e `expirada` não registram: 403 `NAO_INSCRITO`. Vale igual nas duas rotas — a manual também exige inscrito confirmado. | RN-306 e RN-311 |
| P9 | Segundo registro na mesma rota (201 → 200): devolve a mesma `Presenca`, sem sobrescrever? | A presença é única por participante e encontro. O primeiro registro devolve 201; qualquer repetição devolve 200 com a mesma presença, sem alterar campo nenhum. Essa verificação vem antes de todas as outras regras do módulo, de propósito: é o que permite ao app offline reenviar a fila sem medo. | RN-307 |
| P10 | Cruzamento das rotas: manual em cima de presença QR existente, e QR depois de uma manual — o que acontece? | Mesma regra da RN-307, e ela não olha origem: a presença é única por participante e encontro, venha de onde vier. Manual em cima de uma presença de QR devolve 200 com a presença que já existe, preservando origem e justificativa; QR depois de manual, idem. | RN-307 |
| P11 | `lidoEm` presente: contra qual instante as regras (janela, validade do código) são aplicadas — o da leitura ou o da chegada? | Quando a leitura chega com `lidoEm`, a janela e a validade do código são conferidas no instante da leitura, não no do envio. | RN-308 |
| P12 | `lidoEm` adiantado (futuro) ou de muito tempo atrás: o que acontece? | `lidoEm` adiantado (posterior ao envio, celular com relógio errado) não é erro: vale como se fosse o instante do envio. `lidoEm` antigo não tem regra própria — quem limita é o prazo da RN-310 (ver P13). | RN-309 |
| P13 | `SINCRONIZACAO_TARDIA`: quanto de atraso entre `lidoEm` e a chegada é tolerado? | Um envio com `lidoEm` é aceito até 2 horas depois do fim do encontro. O instante exato de fim + 2h ainda é aceito; do primeiro instante seguinte em diante, `SINCRONIZACAO_TARDIA`. O limite é preso ao fim do encontro, não a um tempo contado desde o `lidoEm`. Exemplo do cliente: encontro das 19:00 às 22:00, leitura offline às 19:10 — enviada às 23:59 é aceita; enviada às 00:00:01 é tardia. | RN-310 |
| P14 | Código digitado à mão (6 caracteres): quais caracteres usa e a digitação diferencia maiúscula de minúscula? | Alfabeto do código: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, 6 caracteres. A leitura aceita minúscula e ignora espaços. | RN-305 |
| P15 | `JUSTIFICATIVA_OBRIGATORIA`: justificativa vazia ou só com espaços dispara o erro? | A justificativa da presença manual precisa ter no mínimo 10 caracteres. Ausente, vazia ou com menos de 10 caracteres → `JUSTIFICATIVA_OBRIGATORIA`. | RN-311 |
| P16 | Atividade cancelada: `ATIVIDADE_CANCELADA` em "obter código" (seção 6); nas rotas de presença/manual o código não existe — o que vale em cada caso? | No obter código, a atividade cancelada bloqueia: `ATIVIDADE_CANCELADA`, junto com o `FORA_DA_JANELA` da janela (RN-302). O documento não diz qual dos dois vem primeiro — decisão do grupo: `ATIVIDADE_CANCELADA` antes de `FORA_DA_JANELA`, para ficar igual à ordem que o M1 e o M2 já usam. Nas rotas de presença não existe esse código e não existe bloqueio próprio: como o M2 cancela todas as inscrições ativas quando a atividade é cancelada (R11), quem tentar registrar cai em `NAO_INSCRITO` pela RN-306. | RN-302 + decisão do grupo |
| P17 | `LIMITE_DE_MANUAIS`: o limite é por encontro, por atividade ou por participante? Qual o teto? | Por encontro, no máximo 10% das inscrições confirmadas podem ser manuais, arredondando para cima. Exemplos do cliente: 20 confirmados permitem 2 manuais; 21 permitem 3; 5 permitem 1. Passou disso, `LIMITE_DE_MANUAIS`. | RN-313 |
| P18 | Ordem de precedência na presença QR (`FORA_DA_JANELA`, `CODIGO_INVALIDO`, `NAO_INSCRITO`, `SINCRONIZACAO_TARDIA`). | Encontro inexistente (404 `NAO_ENCONTRADO`) → presença já registrada (devolve 200 e para por aí) → `NAO_INSCRITO` → `SINCRONIZACAO_TARDIA` → `FORA_DA_JANELA` → `CODIGO_INVALIDO`. | RN-314 |
| P19 | Ordem de precedência na presença manual (`FORA_DA_JANELA`, `NAO_INSCRITO`, `JUSTIFICATIVA_OBRIGATORIA`, `LIMITE_DE_MANUAIS` — sem `ATIVIDADE_CANCELADA`, corrigido). | `JUSTIFICATIVA_OBRIGATORIA` → presença já registrada (devolve 200) → `NAO_INSCRITO` → `FORA_DA_JANELA` → `LIMITE_DE_MANUAIS`. A justificativa é conferida antes de tudo, inclusive antes da presença existente. | RN-314 |
| P20 | Ordem da listagem `GET /encontros/:id/presencas`. | Por nome do participante; desempate por `participanteId`. Não usar `registradaEm`: no modo de teste o relógio fica parado, várias presenças na mesma janela teriam `registradaEm` idêntico e a ordem ficaria indefinida. | decisão do grupo |
| P21 | Passagem de tempo sem acesso: janelas e validade do código calculadas na leitura (relógio parado no teste); código com `validoAte` no passado é recusado mesmo sem a rotação ter sido buscada? | Sim — tudo calculado na leitura, pelo relógio; código com `validoAte` vencido é recusado mesmo sem ninguém ter buscado a rotação. Mesmo padrão do M1 (`situacao`) e do M2 (expiração em cascata na leitura). | decisão do grupo |
| P22 | Quando cada valor de origem se aplica? | `qr` quando a leitura é enviada na hora, sem `lidoEm`; `qr_offline` quando o envio traz `lidoEm`; `manual` no registro feito pela organização. | RN-315 |

*Nota: P22 foi aberta em rodada extra durante a rodada 2.*

## Rodada 2 (Questões de regra de negócio / PENDENTES)

| # | Pergunta | Status |
|---|---|---|
| P2 | Janela para obter código | RESOLVIDA |
| P3 | Janela para presença por QR | RESOLVIDA |
| P4 | Janela para presença manual | RESOLVIDA |
| P5 | Duração do período de validade/rotação do código (mecânica já decidida) | RESOLVIDA |
| P6 | Relação `trocaEm` × `validoAte` (se `validoAte` fica depois de `trocaEm` e quanto) | RESOLVIDA |
| P8 | `NAO_INSCRITO` — quem pode registrar (QR e manual) | RESOLVIDA |
| P9 | Segundo registro na mesma rota (201 → 200) | RESOLVIDA |
| P10 | Cruzamento manual × QR | RESOLVIDA |
| P11 | Instante das regras com `lidoEm` (leitura × chegada) | RESOLVIDA |
| P12 | `lidoEm` adiantado (futuro) ou muito antigo | RESOLVIDA |
| P13 | Tolerância de `SINCRONIZACAO_TARDIA` | RESOLVIDA |
| P16 | Atividade cancelada — ordem no obter código e registro em atividade cancelada | RESOLVIDA |
| P17 | `LIMITE_DE_MANUAIS` — unidade e teto | RESOLVIDA |
| P18 | Ordem de precedência na presença QR | RESOLVIDA |
| P19 | Ordem de precedência na presença manual | RESOLVIDA |