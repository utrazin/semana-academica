# Spec — M4: Certificados

## 1. Objetivo

Permitir que o participante emita e liste os próprios certificados, que qualquer pessoa
verifique um certificado pelo código (rota pública) e que o participante consulte o
extrato de horas complementares. Emissão exige inscrição confirmada em atividade não
cancelada e já encerrada, com frequência mínima de 75% sem arredondamento. O certificado
traz a carga horária integral da atividade. A reemissão devolve o mesmo certificado.
O extrato lista todas as atividades elegíveis (mesmo sem emissão) e aplica tetos só no
aproveitamento. Tudo que depende do tempo lê o relógio do modo de teste.

## 2. Fora de escopo

M4 **não** faz:

- Criar, alterar, cancelar atividade ou encontro (M1) — lê atividades e encontros.
- Inscrever, cancelar, convocar ou confirmar inscrição (M2) — lê a inscrição.
- Registrar presença por QR, offline ou manual (M3) — lê as presenças.
- Painel da organização e bloqueios (M5).
- Criar usuário ou sala — vêm dos dados iniciais (contrato seção 4).
- Definir política de correção, revogação ou atualização posterior de certificado
  (em aberto — ver D2).
- Definir a posição exata da consulta de certificado já emitido frente às
  verificações gerais (em aberto — ver D1).

## 3. Modelo

**Certificado** (contrato seção M4):

| campo | tipo | origem |
|---|---|---|
| `codigo` | string (`SA26-XXXX-XXXX`) | gerado na primeira emissão (R8, R9) |
| `atividadeId` | string | informado (rota) |
| `participanteId` | string | informado (identificação) |
| `cargaHorariaMinutos` | inteiro | carga integral da atividade (R5) |
| `presencas` | inteiro | contagem na emissão (ver D2) |
| `encontros` | inteiro | quantidade de encontros da atividade (ver D2) |
| `emitidoEm` | ISO 8601 com fuso | instante da primeira emissão (R7, ver D2) |

**Verificacao** (contrato seção M4):

| campo | tipo | origem |
|---|---|---|
| `codigo` | string | do certificado |
| `participante` | string (nome abreviado, R11) | do participante |
| `atividade` | string (título) | da atividade |
| `cargaHorariaMinutos` | inteiro | do certificado |
| `emitidoEm` | ISO 8601 com fuso | do certificado |

**Extrato** (contrato seção M4):

| campo | tipo | origem |
|---|---|---|
| `itens[]` | `{ atividadeId, titulo, tipo, cargaHorariaMinutos, codigo \| null }` | elegíveis (R12) |
| `palestrasMinutos` | inteiro | soma bruta das palestras elegíveis (R13) |
| `minicursosMinutos` | inteiro | soma bruta dos minicursos elegíveis (R13) |
| `totalMinutos` | inteiro | soma bruta (R13) |
| `aproveitadoMinutos` | inteiro | com tetos (R13) |

## 4. Endpoints

Identificação (`X-Usuario`) e ordem geral são do contrato: 401 (usuário desconhecido) →
403 (quem pode chamar) → 404 (recurso inexistente) → 422 (corpo) → regras do recurso.
`GET /certificados/:codigo` é pública e não exige `X-Usuario`.

| Método | Rota | Quem | Sucesso |
|---|---|---|---|
| POST | `/atividades/:id/certificado` | participante | 201 `Certificado` (primeira vez); 200 `Certificado` (repetição) |
| GET | `/certificados` | participante | 200 `[Certificado]` — os já emitidos pelo participante |
| GET | `/certificados/:codigo` | público, sem `X-Usuario` | 200 `Verificacao` |
| GET | `/extrato` | participante | 200 `Extrato` |

## 5. Regras

Cada regra cita a pergunta da entrevista (`P-xx`) que a originou e, quando existe, a
regra do documento de requisitos (`RN-xxx`). O rótulo indica a natureza:
`[explícito]` = requisito dito na entrevista; `[consequência]` = decorre das regras
sem ser regra nova; `[interpretação proposta]` = leitura sugerida na resposta, sem
força de requisito confirmado. Nada além do que a entrevista traz vira regra.

- **R1** (P-01, definição do módulo e contrato-api.md; sem RN) [explícito]: o escopo
  de M4 é emissão e listagem dos meus certificados, verificação pública pelo código
  e extrato de horas complementares. M4 lê dados de M1, M2 e M3 sem alterar
  atividades, inscrições ou presenças. Não inclui o painel M5.
- **R2** (P-02, RN-401 a RN-405) [explícito]: condições cumulativas da emissão em
  `POST /atividades/:id/certificado`: inscrição confirmada do participante na
  atividade, atividade não cancelada, atividade encerrada e frequência mínima
  atingida. Faltar qualquer uma recusa a emissão.
- **R3** (P-02, RN-401 a RN-405) [explícito]: a atividade é considerada encerrada a
  partir do instante do fim do último encontro, inclusive (no instante exato do fim
  já vale encerrada).
- **R4** (P-02, RN-401 a RN-405) [explícito]: frequência mínima de 75% dos encontros,
  sem arredondamento para favorecer o participante. Comparação inteira:
  `presencas × 4 ≥ encontros × 3`. Contam igualmente todas as presenças aceitas,
  qualquer que seja a origem — `qr`, `qr_offline` ou `manual` (M3).
- **R5** (P-11, RN-406 e RN-109) [explícito]: o certificado informa a carga horária
  integral da atividade — soma da duração de todos os encontros, em minutos.
  A frequência decide o direito, mas não reduz a carga (ex.: 3 de 4 encontros com
  mínimo atingido recebe a carga total).
- **R6** (P-09, RN-401; prazo máximo não especificado) [explícito]: emissão
  disponível a partir do instante do fim do último encontro, sem prazo máximo.
  Não se acrescenta data de expiração.
- **R7** (P-03, RN-407, RN-413 e contrato-api.md) [explícito]: a primeira solicitação
  que atende às condições cria o certificado (201). As seguintes devolvem o mesmo
  certificado (200), sem gerar outro código nem nova emissão.
- **R8** (P-04, RN-407 e RN-305) [explícito]: código no formato `SA26-XXXX-XXXX`;
  os oito caracteres variáveis usam o alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
  (sem `0`, `O`, `1`, `I`). Cada código é único entre os certificados do sistema.
  Criado na primeira emissão e nunca muda.
- **R9** (P-04; sem RN de algoritmo) [explícito]: não há algoritmo obrigatório do
  cliente para gerar o código; a escolha do gerador faz parte da implementação.
  Obrigatórios são o formato, o alfabeto e a unicidade de R8, que a implementação
  garante, impedindo duplicados.
- **R10** (P-05, RN-408, RN-409 e contrato-api.md) [explícito]: qualquer pessoa
  consulta pelo código sem `X-Usuario`; a consulta aceita letras minúsculas.
  Código inexistente → 404 `NAO_ENCONTRADO`.
- **R11** (P-05, RN-409) [explícito]: a verificação responde código, nome abreviado
  do participante, atividade, carga horária e data de emissão. Abreviação: primeiro
  nome por extenso; demais nomes abreviados pela inicial com ponto; partículas
  `de`, `da`, `do`, `das` e `dos` preservadas por extenso e em minúsculas.
  Ex.: "Elisa Fernandes da Rocha" → "Elisa F. da R.".
- **R12** (P-06, RN-410 e RN-401 a RN-405) [explícito]: o extrato inclui todas as
  atividades para as quais o participante já pode receber certificado — encerrada,
  não cancelada, inscrição confirmada, frequência mínima — mesmo sem emissão
  solicitada. Com certificado emitido, `codigo` vem preenchido; sem emissão, `null`.
  Calculado no momento da consulta.
- **R13** (P-07, RN-406 e RN-410 a RN-412) [explícito]: `palestrasMinutos` = soma
  das cargas das palestras elegíveis; `minicursosMinutos` = soma das cargas dos
  minicursos elegíveis; `totalMinutos` = soma dos dois, sem tetos;
  `aproveitadoMinutos = min(min(palestrasMinutos, 240) + minicursosMinutos, 1200)`.
  Os tetos afetam só o aproveitamento; não reduzem a carga dos certificados nem os
  totais brutos.
- **R14** (P-08, RN-413 e convenções do contrato-api.md) [explícito, só primeira
  emissão]: após as verificações gerais (identificação, perfil, existência,
  corpo), a ordem dos impedimentos é: atividade inexistente → 404 `NAO_ENCONTRADO`;
  atividade cancelada → 422 `ATIVIDADE_CANCELADA`; inscrição não confirmada → 403
  `NAO_INSCRITO`; atividade ainda não encerrada → 422 `ATIVIDADE_NAO_ENCERRADA`;
  frequência abaixo do mínimo → 422 `PRESENCA_INSUFICIENTE`.
- **R15** (P-10, RN-404, RN-405 e RN-310) [consequência + explícito do M3]:
  tentativa recusada por `PRESENCA_INSUFICIENTE` não bloqueia nova solicitação; se
  presenças offline forem aceitas (sincronização até 2 horas após o fim do
  encontro, inclusive o instante limite, cumpridas as demais validações) e o mínimo
  for atingido, a emissão sai normalmente. Não é preciso esperar o prazo de
  sincronização terminar: atividade encerrada + condições atendidas já permite emitir.
- **R16** (P-12, RN-407 e RN-413) [parte explícita + interpretação proposta]: o
  código nunca muda e nova solicitação devolve o mesmo certificado, sem outra
  emissão nem mudança da data original — isso é explícito. Preservar também carga
  horária, `presencas` e `encontros` da primeira emissão é interpretação proposta
  na resposta, não regra explícita adicional (ver D2).
- **R17** (P-08, RN-413) [decisão em aberto, não requisito]: se o certificado já foi
  emitido, a solicitação devolve o mesmo certificado (200) — mas a posição exata
  dessa consulta frente a todas as verificações gerais não está detalhada na
  entrevista (ver D1). Nenhuma ordem para esse caso pode ser cobrada até a decisão.

### Decisões em aberto (não viram requisito)

- **D1** (ressalva de P-08): posição da recuperação do certificado existente (200)
  em relação às verificações gerais. Em aberto: não confirmar nenhuma ordem.
- **D2** (ressalva de P-12): imutabilidade absoluta de todos os campos
  (`cargaHorariaMinutos`, `presencas`, `encontros`, `emitidoEm`) e política de
  correção, revogação ou atualização posterior. Em aberto: R16 vale como
  orientação de implementação (preservar os valores originais), sem força de
  requisito confirmado.

## 6. Critérios de aceite

1. (R2, R3, R4) Atividade de 4 encontros, inscrição confirmada, relógio no instante
   do fim do último encontro: com 3 presenças → 201; com 2 presenças → 422
   `PRESENCA_INSUFICIENTE` (3×4=12 ≥ 4×3=12 passa; 2×4=8 < 12 não passa, sem
   arredondamento). Relógio 1 segundo antes do fim → 422 `ATIVIDADE_NAO_ENCERRADA`.
   Presenças aceitas de qualquer origem (`qr`, `qr_offline`, `manual`) contam
   igualmente para o mínimo.
2. (R2, R14) `POST /atividades/:id/certificado`: atividade inexistente → 404
   `NAO_ENCONTRADO`; cancelada → 422 `ATIVIDADE_CANCELADA`; sem inscrição
   confirmada (sem inscrição, em espera, convocada, cancelada, expirada) → 403
   `NAO_INSCRITO`; não encerrada → 422 `ATIVIDADE_NAO_ENCERRADA`; encerrada sem
   mínimo → 422 `PRESENCA_INSUFICIENTE`, nesta ordem na primeira emissão.
3. (R5) Participante com 3 de 4 encontros (mínimo atingido) recebe `Certificado`
   com `cargaHorariaMinutos` igual à soma de todos os 4 encontros, `presencas: 3`,
   `encontros: 4`.
4. (R6) Emissão muito após o encerramento (relógio dias depois, sem regra de
   expiração) → 201/200 normal; nenhum cenário cobra prazo máximo.
5. (R7, R8, R9) Primeira emissão → 201 com `codigo` em `SA26-XXXX-XXXX` no alfabeto
   sem `0`/`O`/`1`/`I`; segunda chamada → 200 com o mesmo `codigo` e o mesmo
   `emitidoEm`. Dois participantes (ou duas atividades) nunca recebem o mesmo código.
6. (R10, R11) `GET /certificados/:codigo` sem `X-Usuario` → 200 com `codigo`,
   nome abreviado, atividade, carga e `emitidoEm`; com código em minúsculas → 200;
   com código inexistente → 404 `NAO_ENCONTRADO`. Abreviação verificável:
   "Elisa Fernandes da Rocha" → "Elisa F. da R."; nome com partícula "dos"
   ("Isadora Ribeiro dos Santos") → "Isadora R. dos S."; nome sem partículas
   ("Carla Mendes Souza") → "Carla M. S.".
7. (R12, R13) `GET /extrato` inclui atividade elegível ainda sem emissão (item com
   `codigo: null`) e, após emitir, com `codigo` preenchido. Cenário com teto:
   duas palestras válidas (1 encontro cada, 180 min + 120 min = 300 min) e um
   minicurso válido (5 encontros de 200 min = 1000 min) → `palestrasMinutos: 300`,
   `minicursosMinutos: 1000`, `totalMinutos: 1300`,
   `aproveitadoMinutos: min(240 + 1000, 1200) = 1200`. Cenário sem corte:
   uma palestra de 120 min (1 encontro) + um minicurso de 120 min (2 encontros
   de 60 min) → `palestrasMinutos: 120`, `minicursosMinutos: 120`,
   `totalMinutos: 240`, `aproveitadoMinutos: 240`. Totais maiores sempre montados
   com várias atividades válidas (palestra tem 1 encontro; cada encontro tem de
   60 a 240 minutos, spec M1).
8. (R15) Participante com frequência abaixo do mínimo → 422
   `PRESENCA_INSUFICIENTE`; após sincronizar presença offline válida (M3, até
   fim + 2h inclusive) atingindo o mínimo → nova solicitação emite (201/200).
   Com atividade encerrada e mínimo já atingido, emite sem esperar o fim da janela
   de sincronização.
9. (R16, D2) Segunda emissão devolve o mesmo `codigo` sem mudar `emitidoEm` —
   verificável já. A preservação de `cargaHorariaMinutos`/`presencas`/`encontros`
   segue como orientação, sem teste que congele snapshot até D2 ser decidida.

## 7. Como isto será verificado

Pela costura mais externa que já existe: **HTTP**, na API subida por `npm start`
dentro de `api/` (stack do `projeto.json`), com `MODO_TESTE=1`. Cada cenário começa
com `POST /_teste/reset`, usa `PUT /_teste/relogio` para fixar o tempo e
`X-Usuario` para autenticação. Toda regra que depende do tempo lê `agora()` de
`src/relogio.js` (nunca a hora do sistema). Os cenários preparam a base com
atividades (M1), inscrições confirmadas (M2) e presenças (M3) — semeando direto no
banco com helper quando preciso — e movem o relógio para antes/durante/depois dos
encontros. Os testes precisam afirmar status, códigos de erro, campos e valores
exigidos em cada rota — exercitar a rota sem essas afirmações não prova regra
nem contrato.

## 8. Fatias de entrega

Fatias verticais: cada uma se implementa e se verifica sozinha, por HTTP, com
`POST /_teste/reset` e `PUT /_teste/relogio`, em TDD (red → green → refactor).

1. **Envelope: rotas, papéis e listagem** (R1; Fatos do contrato): `POST`
   só-participante (organização → 403 `SOMENTE_PARTICIPANTE`), `GET /certificados`
   devolvendo só os do participante, pública sem `X-Usuario` respondendo sem 401.
   Independente de D1/D2 — pode seguir já.
2. **Emissão e ordem da primeira emissão** (R2, R3, R4, R5, R6, R14): condições
   cumulativas, encerrada inclusiva, fórmula inteira sem arredondamento, carga
   integral, sem prazo máximo e ordem de erros da primeira emissão. Independente
   de D1/D2 — pode seguir já.
3. **Reemissão e código único** (R7, R8, R9, R17/D1): 201 → 200 mesmo certificado,
   formato/alfabeto/unicidade. **Depende de D1**: a ordem da consulta de
   certificado existente frente às verificações gerais está em aberto, então os
   testes desta fatia que tocam nesse ponto ficam condicionais à decisão.
4. **Verificação pública** (R10, R11): sem `X-Usuario`, case-insensitive, 404
   inexistente, campos da `Verificacao` com o nome abreviado segundo R11,
   incluindo os exemplos com partículas. Independente de D1/D2 — pode seguir já.
5. **Extrato e tetos** (R12, R13): elegíveis com `codigo` null/preenchido,
   calculado na consulta; brutos e fórmula do aproveitado com os dois tetos.
   Independente de D1/D2 — pode seguir já.
6. **Nova tentativa após sincronização offline** (R15): recusada não bloqueia;
   sync até fim + 2h inclusive; emite sem esperar o prazo. Independente de D1/D2
   — pode seguir já.
7. **Snapshot do certificado emitido** (R16/D2): preservação de `cargaHorariaMinutos`,
   `presencas`, `encontros` e `emitidoEm` da primeira emissão. **Depende de D2**:
   vale como orientação proposta, sem teste que exija imutabilidade absoluta até
   a decisão sobre correção/revogação/atualização.
