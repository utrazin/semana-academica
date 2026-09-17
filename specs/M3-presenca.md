# Spec — M3: Presença por QR

## 1. Objetivo

Registrar presença por QR nos encontros da Semana Acadêmica 2026: a organização gera o código de cada encontro (6 caracteres, troca a cada minuto, com um minuto de sobreposição) e pode registrar presença manualmente com justificativa; participantes inscritos com status `confirmada` registram presença dentro da janela do encontro (de 15 minutos antes do início até 30 minutos depois), inclusive offline — o envio atrasado com `lidoEm` é aceito até 2 horas depois do fim. A presença é única por participante e encontro: repetições devolvem a mesma presença (200), permitindo ao app offline reenviar a fila sem risco. A organização lista as presenças do encontro.

## 2. Fora de escopo

M3 **não** faz:
- Certificado e extrato (M4).
- Painel da organização, frequência, sem-chance e bloqueio (M5).
- Criar, alterar e cancelar atividade e encontro (M1) — os encontros vêm prontos de M1.
- Inscrever, cancelar e convocar participantes (M2). M3 apenas **lê** a inscrição para decidir quem pode registrar; não cria nem altera inscrição nem status.
- `ATIVIDADE_CANCELADA` não é erro das rotas de presença (`POST .../presencas` e `POST .../presencas/manual`) — só do obter código.

## 3. Modelo

Encontros vêm de M1: palestra tem exatamente 1 encontro; minicurso de 2 a 5; cada encontro tem `id` (`enc_` + 8 hex), `inicio`, `fim`. Inscrições vêm de M2: status `confirmada`, `em_espera`, `convocada`, `cancelada`, `expirada`; ocupam vaga `confirmada` + `convocada`.

**CodigoDoEncontro** (resposta do obter código — nada é guardado, tudo é calculado na leitura):

| campo | tipo | origem |
|---|---|---|
| `encontroId` | string | informado (rota) |
| `codigo` | string de 6 caracteres | calculado na leitura |
| `trocaEm` | ISO 8601 com fuso | calculado na leitura |
| `validoAte` | ISO 8601 com fuso | calculado na leitura |

**Presenca**:

| campo | tipo | origem |
|---|---|---|
| `id` | string (`pre_` + 8 hex) | gerado |
| `encontroId` | string | informado (rota) |
| `participanteId` | string | informado (identificação ou corpo da manual) |
| `origem` | `qr` \| `qr_offline` \| `manual` | derivado |
| `lidoEm` | ISO 8601 com fuso | calculado (o instante que valeu para as regras) |
| `registradaEm` | ISO 8601 com fuso | gerado |
| `justificativa` | string \| null | informado (só quando manual) |

## 4. Endpoints

Identificação (`X-Usuario`) e ordem geral são do contrato: 401 (usuário desconhecido) → 403 (quem pode chamar) → 404 (recurso inexistente) → 422 (corpo) → regras do recurso.

| Método | Rota | Quem | Sucesso |
|---|---|---|---|
| GET | `/encontros/:id/codigo` | organização | 200 `CodigoDoEncontro` |
| POST | `/encontros/:id/presencas` | participante | 201 `Presenca` na primeira vez; 200 `Presenca` nas repetições |
| POST | `/encontros/:id/presencas/manual` | organização | 201 `Presenca` na primeira vez; 200 `Presenca` nas repetições |
| GET | `/encontros/:id/presencas` | organização | 200 `[Presenca]` |

Entradas:

```jsonc
// POST /encontros/:id/presencas
{ "codigo": "K7M2QX", "lidoEm": "…" }   // lidoEm opcional: leitura feita sem internet

// POST /encontros/:id/presencas/manual
{ "participanteId": "p-carla", "justificativa": "…" }   // justificativa ausente também é JUSTIFICATIVA_OBRIGATORIA
```

## 5. Regras

Cada regra cita a pergunta da entrevista (`P-xx`) que a originou e, quando existe, a regra do documento de requisitos (`RN-xxx`). Sem RN, a fonte é decisão do grupo ou contrato.

- **R1** (P1, decisão do grupo): O escopo de M3 é gerar o código do encontro, registrar presença (online por QR, offline por `lidoEm` e manual pela organização) e listar as presenças de um encontro. M3 lê a inscrição para decidir quem pode registrar, mas não cria nem altera inscrição.
- **R2** (P1, contrato): Identificação e papéis: sem `X-Usuario` válido → 401 `USUARIO_DESCONHECIDO` em qualquer rota de M3. `GET /encontros/:id/codigo`, `POST /encontros/:id/presencas/manual` e `GET /encontros/:id/presencas` são da organização → participante que chamar → 403 `SOMENTE_ORGANIZACAO`. `POST /encontros/:id/presencas` é do participante → organização que chamar → 403 `SOMENTE_PARTICIPANTE`.
- **R3** (P18, contrato — ordem geral): Nas quatro rotas, `:id` que não corresponde a nenhum encontro → 404 `NAO_ENCONTRADO`, verificado antes das regras do recurso.
- **R4** (P12, contrato, seção 1): Entrada `lidoEm` que não seja string ou que não possa ser interpretado como data → 422 `DADOS_INVALIDOS`.
- **R5** (P7, decisão do grupo): `CODIGO_INVALIDO` cobre tudo que não é um código aceito para aquele encontro no instante que vale: código inexistente, de outro encontro, fora do `validoAte` (R12) ou de tamanho errado. Separar de corpo mal formado: `codigo` ausente ou não-string → 422 `DADOS_INVALIDOS` (seção 1); uma string de 3 letras é valor do tipo certo que não serve → 422 `CODIGO_INVALIDO`.
- **R6** (P8, RN-306, RN-311): Só registra presença quem tem inscrição com status `confirmada`. `convocada`, `em_espera`, `cancelada` e `expirada` não registram → 403 `NAO_INSCRITO`. Vale igual nas duas rotas — a manual também exige inscrito confirmado.
- **R7** (P2, RN-301, RN-302): Janela para obter código: de 15 minutos antes do início até 30 minutos depois do início do encontro, bordas incluídas. Fora disso → 422 `FORA_DA_JANELA`.
- **R8** (P16, RN-302, decisão do grupo): Em atividade cancelada o obter código não sai: 422 `ATIVIDADE_CANCELADA`, verificado antes de `FORA_DA_JANELA` — mesma ordem que M1 e M2 já usam. Nas rotas de presença não existe bloqueio próprio: como o M2 cancela todas as inscrições ativas quando a atividade é cancelada (R11 do M2), quem tenta registrar cai em `NAO_INSCRITO` (R6).
- **R9** (P3, RN-301): Janela da presença por QR: definida só pelo início do encontro — de 15 minutos antes do início até 30 minutos depois do início, extremos dentro da janela. A janela não é cortada pelo fim do encontro; mas como o M1 garante encontro de no mínimo 1 hora (R9 do M1 — duração de 1 a 4 horas), início + 30min sempre precede o fim, e não existe cenário criável que distinga as duas leituras. Exemplo: encontro das 19:00 às 22:00 tem janela de 18:45:00 a 19:30:00. Fora → 422 `FORA_DA_JANELA`.
- **R10** (P4, RN-312): Janela da presença manual: abre junto com a janela da RN-301 (15 minutos antes do início) e vai até 2 horas depois do fim do encontro. Fora → 422 `FORA_DA_JANELA`.
- **R11** (P5, RN-303, decisão do grupo): O código troca a cada minuto, em janelas alinhadas ao relógio — cada código vale para o minuto cheio, de `hh:mm:00` a `hh:mm:59`. O código é estável dentro do seu período: GET repetido no mesmo período devolve o mesmo código. `trocaEm` e `validoAte` são calculados na leitura a partir do relógio, sem nada guardado.
- **R12** (P6, RN-304): `validoAte` fica depois de `trocaEm`, com um minuto de sobreposição: são aceitos o código do minuto corrente e o do minuto anterior. Para o código da janela das 19:03, `trocaEm` é 19:04:00 (quando a tela busca o próximo) e `validoAte` é 19:05:00 (primeiro instante em que o código deixa de ser aceito). Código obtido às 19:03:20 e enviado às 19:04:59 ainda vale; às 19:05:00 → 422 `CODIGO_INVALIDO`. Código de outro encontro também é recusado.
- **R13** (P14, RN-305): O código usa o alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, com 6 caracteres. A comparação normaliza o valor recebido — sobe para maiúsculas e descarta espaços — antes de comparar com o código do encontro.
- **R14** (P11, RN-308): Quando o corpo traz `lidoEm`, a janela e a validade do código são conferidas no instante da leitura, não no do envio.
- **R15** (P12, RN-309): `lidoEm` adiantado (posterior ao envio, relógio do celular errado) não é erro: vale como se fosse o instante do envio. `lidoEm` antigo não tem regra própria — quem limita é o prazo de sincronização (R16).
- **R16** (P13, RN-310): Um envio com `lidoEm` é aceito até 2 horas depois do fim do encontro. O instante exato de fim + 2h ainda é aceito; do primeiro instante seguinte em diante → 422 `SINCRONIZACAO_TARDIA`. O limite é preso ao fim do encontro, não a um tempo contado desde o `lidoEm`. Exemplo: encontro das 19:00 às 22:00, leitura offline às 19:10 — enviada às 23:59 é aceita; enviada às 00:00:01 é tardia.
- **R17** (P9, P10, RN-307): A presença é única por participante e encontro, e a regra não olha origem: vale igual para QR e manual. O primeiro registro devolve 201; qualquer repetição devolve 200 com a mesma `Presenca`, sem alterar campo nenhum (origem e justificativa preservados) — o que permite ao app offline reenviar a fila sem medo. Manual em cima de presença de QR devolve 200 com a presença existente, preservando origem e justificativa; QR depois de manual, idem.
- **R18** (P15, RN-311): A justificativa da presença manual precisa ter no mínimo 10 caracteres. Ausente, vazia ou com menos de 10 caracteres → 422 `JUSTIFICATIVA_OBRIGATORIA`.
- **R19** (P17, RN-313): As presenças manuais são limitadas por encontro: no máximo 10% das inscrições confirmadas, arredondando para cima. Exemplos: 20 confirmadas permitem 2 manuais; 21 permitem 3; 5 permitem 1. Passou disso → 422 `LIMITE_DE_MANUAIS`.
- **R20** (P18, RN-314): Ordem de precedência na presença por QR (`POST /encontros/:id/presencas`): encontro inexistente (404 `NAO_ENCONTRADO`) → presença já registrada (devolve 200 e para por aí) → `NAO_INSCRITO` → `SINCRONIZACAO_TARDIA` → `FORA_DA_JANELA` → `CODIGO_INVALIDO`.
- **R21** (P19, RN-314): Ordem de precedência na presença manual (`POST /encontros/:id/presencas/manual`): `JUSTIFICATIVA_OBRIGATORIA` → presença já registrada (devolve 200) → `NAO_INSCRITO` → `FORA_DA_JANELA` → `LIMITE_DE_MANUAIS`. A justificativa é conferida antes de tudo, inclusive antes da presença existente.
- **R22** (P20, decisão do grupo): A listagem `GET /encontros/:id/presencas` ordena por nome do participante; desempate por `participanteId`. `registradaEm` não é usada na ordenação — no modo de teste o relógio fica parado e várias presenças na mesma janela teriam `registradaEm` idêntico, deixando a ordem indefinida.
- **R23** (P21, decisão do grupo): Tudo é calculado na leitura, pelo relógio: código com `validoAte` vencido é recusado mesmo sem ninguém ter buscado a rotação. Mesmo padrão do M1 (`situacao`) e do M2 (expiração em cascata na leitura).
- **R24** (P22, RN-315, RN-308, RN-309): `origem` é `qr` quando a leitura é enviada na hora, sem `lidoEm`; `qr_offline` quando o envio traz `lidoEm`, em qualquer caso; `manual` no registro feito pela organização. No campo `lidoEm` da `Presenca`, o valor guardado é sempre o instante que valeu para as regras: quando o corpo não traz `lidoEm`, recebe o instante do envio (`registradaEm`); quando o corpo traz `lidoEm` anterior ao envio, guarda o instante da leitura (o valor do corpo); quando o corpo traz `lidoEm` adiantado (posterior ao envio), guarda o instante do envio, como no R15.

## 6. Critérios de aceite

1. (R1) Registrar presença por QR, offline ou manual nunca altera a inscrição do participante: o status deixado pelo M2 permanece o mesmo depois do registro.
2. (R2) Sem `X-Usuario` (ou com usuário desconhecido) em qualquer rota de M3 → 401 `USUARIO_DESCONHECIDO`; participante em `GET /encontros/:id/codigo`, `POST /encontros/:id/presencas/manual` ou `GET /encontros/:id/presencas` → 403 `SOMENTE_ORGANIZACAO`; organização em `POST /encontros/:id/presencas` → 403 `SOMENTE_PARTICIPANTE`.
3. (R3) Nas quatro rotas, `/encontros/:id` com `id` que não existe → 404 `NAO_ENCONTRADO`, antes de qualquer regra do recurso.
4. (R4) `POST /encontros/:id/presencas` com `lidoEm` não-string ou que não dá para interpretar como data (ex.: `"abc"`) → 422 `DADOS_INVALIDOS`.
5. (R5) `POST /encontros/:id/presencas` com `codigo` ausente ou não-string → 422 `DADOS_INVALIDOS`; com `codigo` de 3 letras → 422 `CODIGO_INVALIDO` (tipo certo, valor que não serve).
6. (R6) Participante sem inscrição, ou com `em_espera`, `convocada`, `cancelada` ou `expirada`, tenta registrar por QR ou manual → 403 `NAO_INSCRITO`; inscrito `confirmada` registra → 201.
7. (R7) Encontro das 19:00: `GET /encontros/:id/codigo` às 18:45:00 → 200; às 18:44:59 → 422 `FORA_DA_JANELA`; às 19:30:00 → 200; às 19:30:01 → 422 `FORA_DA_JANELA`.
8. (R8) Encontro de atividade cancelada com relógio dentro da janela: `GET /encontros/:id/codigo` → 422 `ATIVIDADE_CANCELADA` (antes de `FORA_DA_JANELA`); registro de presença por QR ou manual → 403 `NAO_INSCRITO` (as inscrições ativas foram canceladas pelo M2).
9. (R9) Encontro das 19:00 às 22:00: registro por QR às 18:45:00 (início − 15min) → 201; às 18:44:59 → 422 `FORA_DA_JANELA`; às 19:30:00 (início + 30min, borda incluída) → 201; às 19:30:01 → 422 `FORA_DA_JANELA`. [Cenário precisa de inscrição `confirmada` e código válido.]
10. (R10) Encontro das 19:00 às 22:00: presença manual às 18:45:00 → 201; às 18:44:59 → 422 `FORA_DA_JANELA`; às 23:00 (depois do fim, dentro das 2h) → 201; após fim + 2h (00:00:01, sendo fim 22:00) → 422 `FORA_DA_JANELA`.
11. (R11) Relógio em 19:03:10: GET código duas vezes no mesmo minuto devolve o mesmo `codigo`, com `trocaEm`/`validoAte` calculados do relógio e iguais; avançar o relógio 1 minuto → GET devolve um `codigo` diferente.
12. (R12) Código obtido às 19:03:20 (janela das 19:03, `trocaEm` 19:04:00, `validoAte` 19:05:00): enviado às 19:03:59 → 201; enviado às 19:04:59 (minuto anterior ainda aceito) → 201; enviado às 19:05:00 → 422 `CODIGO_INVALIDO`; código de outro encontro → 422 `CODIGO_INVALIDO`.
13. (R13) `codigo` enviado em minúsculas e/ou com espaços (ex.: `" k7m2qx "`) → 201 — a comparação sobe para maiúsculas e descarta espaços antes de comparar; `codigo` com caractere fora do alfabeto → 422 `CODIGO_INVALIDO`.
14. (R14) Pôr o relógio em 19:20 e obter o código do encontro; avançar o relógio para 20:00 (fora da janela) e enviar esse código com `lidoEm` 19:20 → 201 (regras no instante da leitura, código ainda válido); o mesmo envio sem `lidoEm`, com o relógio em 20:00 → 422 `FORA_DA_JANELA`.
15. (R15, R24) Envio dentro da janela com `lidoEm` no futuro (relógio do celular adiantado) → 201: o instante do envio é o que vale, e adiantamento não é erro; a resposta tem `origem: qr_offline` (o corpo trouxe `lidoEm`) e o campo `lidoEm` igual ao instante do envio.
16. (R16) Encontro das 19:00 às 22:00, leitura offline às 19:10: envio às 23:59 → 201; envio às 00:00:01 → 422 `SINCRONIZACAO_TARDIA`.
17. (R17) Primeiro registro por QR → 201, `origem: qr`; reenviar o mesmo corpo → 200 com a mesma `Presenca`, inalterada; presença manual do mesmo participante em cima da de QR → 200 preservando `origem: qr` e `justificativa: null`; QR em cima de presença manual → 200 preservando `origem: manual` e a justificativa.
18. (R18) Presença manual com `justificativa` ausente, vazia ou com menos de 10 caracteres → 422 `JUSTIFICATIVA_OBRIGATORIA`; com 12 caracteres → 201.
19. (R19) Encontro com 5 inscrições confirmadas: 1ª presença manual → 201 (teto 1 = 10% de 5 arredondado para cima); 2ª presença manual → 422 `LIMITE_DE_MANUAIS`. Encontro com 20 confirmadas: 2ª manual → 201; 3ª manual → 422 `LIMITE_DE_MANUAIS`.
20. (R20) Ordem na rota de QR: não inscrito com código inválido → 403 `NAO_INSCRITO` (antes de `CODIGO_INVALIDO`); presença já registrada com `lidoEm` tardio e código inválido → 200 (para por aí); inscrito com `lidoEm` fora da janela e envio depois de fim + 2h — as duas recusariam → 422 `SINCRONIZACAO_TARDIA`, não `FORA_DA_JANELA`; inscrito fora da janela com código inválido → 422 `FORA_DA_JANELA` (antes de `CODIGO_INVALIDO`).
21. (R21) Ordem na rota manual: já registrado com justificativa inválida → 422 `JUSTIFICATIVA_OBRIGATORIA` (conferida antes da presença existente); já registrado com justificativa válida → 200; não inscrito fora da janela → 403 `NAO_INSCRITO` (antes de `FORA_DA_JANELA`); inscrito fora da janela com teto de manuais cheio → 422 `FORA_DA_JANELA` (antes de `LIMITE_DE_MANUAIS`); inscrito na janela com teto cheio → 422 `LIMITE_DE_MANUAIS`.
22. (R22) `GET /encontros/:id/presencas` → 200 `[Presenca]` ordenado por nome do participante; empates de nome resolvidos por `participanteId`.
23. (R23) Avançar o relógio 10 minutos sem chamar o GET do código de novo e enviar o código da janela anterior → 422 `CODIGO_INVALIDO` (vencido mesmo sem a rotação ter sido buscada).
24. (R24) Envio com `lidoEm` no corpo anterior ao envio → `origem: qr_offline` e `lidoEm` = o instante da leitura (valor do corpo); envio com `lidoEm` adiantado → `origem: qr_offline` e `lidoEm` = o instante do envio (ver critério 15); envio sem `lidoEm` → `origem: qr` e `lidoEm` = `registradaEm`; manual → `origem: manual`, `lidoEm` = o instante do envio que valeu para as regras e `justificativa` preenchida.

## 7. Como isto será verificado

Pela costura mais externa que já existe: **HTTP**, na API subida por `npm start` dentro de `api/` (stack do `projeto.json`), com `MODO_TESTE=1`. Cada cenário começa com `POST /_teste/reset`, usa `PUT /_teste/relogio` para fixar o tempo e `X-Usuario` para autenticação e perfil. Como o encontro vem de M1 e a inscrição `confirmada` de M2, os cenários preparam a base pelas rotas já testadas de M1 (`POST /atividades`) e M2 (`POST /atividades/:id/inscricoes`) e depois movem o relógio para dentro das janelas. O juiz do contrato confere status, `erro` e corpo nas mesmas rotas, então o teste que exercita a rota real cobre automaticamente regra e contrato.

## 8. Fatias de entrega

Fatias verticais: cada uma se implementa e se verifica sozinha, por HTTP, com `POST /_teste/reset` e `PUT /_teste/relogio`.

1. **Envelope: rotas, papéis e existência**: as quatro rotas de M3 respondendo 401 (R2), 403 por perfil (R2) e 404 para encontro inexistente (R3), delimitando o escopo (R1). Verificação: por rota, sem `X-Usuario` → 401; perfil trocado → 403; `:id` que não existe → 404 — tudo com `reset`, sem precisar de atividade nem cenário.
2. **Código do encontro**: `GET /encontros/:id/codigo` e a forma do `CodigoDoEncontro` — janela do obter código (R7), atividade cancelada antes de `FORA_DA_JANELA` (R8), rotação a cada minuto, código estável no período e `trocaEm`/`validoAte` calculados na leitura (R11, R12). Verificação: criar atividade/encontro (M1), `reset` + `relogio` dentro e fora da janela e em atividade cancelada, GET repetido no mesmo minuto e com o relógio avançado.
3. **Presença online por QR**: `POST /encontros/:id/presencas` sem `lidoEm` — inscrito confirmado e `NAO_INSCRITO` (R6), janela do QR (R9), `DADOS_INVALIDOS` × `CODIGO_INVALIDO` no `codigo` (R5), código corrente e do minuto anterior e `validoAte` (R12), alfabeto com normalização (R13), registro único 201 → 200 (R17), código vencido sem rotação buscada (R23), `origem: qr` e presença não alterando a inscrição (R24, R1). Verificação: montar atividade (M1) com inscrição `confirmada` (M2), `reset` + `relogio`, registrar na janela, repetir, trocar relógio.
4. **Presença offline (`lidoEm`) e ordem da rota QR**: `lidoEm` mal formado → `DADOS_INVALIDOS` (R4), janela e validade no instante da leitura (R14), `lidoEm` futuro (R15), sincronização tardia até fim + 2h (R16), ordem completa da rota QR (R20), `origem: qr_offline` (R24). Verificação: `reset` + `relogio` com leitura e envio separados e com as antecessoras da ordem recusando.
5. **Presença manual**: `POST /encontros/:id/presencas/manual` — justificativa de 10 caracteres (R18), janela ampliada da manual (R10), `NAO_INSCRITO` na manual (R6), limite de 10% de manuais por encontro (R19), ordem da rota manual (R21), cruzamento manual × QR preservando a presença (R17), `origem: manual` (R24). Verificação: `reset` + `relogio`, com 5 inscritos confirmados (e 20, para o teto de 2) e com presenças de QR/manual já existentes.
6. **Listagem de presenças**: `GET /encontros/:id/presencas` — ordenação por nome do participante e desempate por `participanteId` (R22). Verificação: registrar vários participantes (QR, offline e manual), listar e conferir a ordem.