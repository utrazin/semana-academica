# Entrevista M4 — Certificados

- Dono: Tarik Almeida Kassem (k100-dev)
- Início: 2026-09-17
- Fonte do que a API responde: `contrato-api.md` seção M4 (fixo, não se negocia)
- Fonte do **quando** cada regra vale: documento de requisitos.
- Dependências: atividades e encontros de M1 (`specs/M1-grade.md`), inscrições de M2 (`specs/M2-inscricoes.md`), presenças de M3 (`specs/M3-presenca.md`).
- Regra: toda pergunta de negócio respondida como "consultar requisitos" entra na lista de **pendentes** e é resolvida só na rodada seguinte.

---

## Fatos já resolvidos (contrato, não se negocia)

- **Rotas e permissões:**
  - `POST /atividades/:id/certificado` — participante — 201 `Certificado` (primeira vez); 200 `Certificado` (repetição).
  - `GET /certificados` — participante — 200 `[Certificado]` (lista dos já emitidos pelo participante).
  - `GET /certificados/:codigo` — público, sem `X-Usuario` — 200 `Verificacao`.
  - `GET /extrato` — participante — 200 `Extrato`.
- **Modelos de dados:**
  - `Certificado`: `{ codigo, atividadeId, participanteId, cargaHorariaMinutos, presencas, encontros, emitidoEm }`.
  - `Verificacao`: `{ codigo, participante, atividade, cargaHorariaMinutos, emitidoEm }`.
  - `Extrato`: `{ itens: [{ atividadeId, titulo, tipo, cargaHorariaMinutos, codigo }], palestrasMinutos, minicursosMinutos, totalMinutos, aproveitadoMinutos }`.
- **Códigos de erro do M4:** `USUARIO_DESCONHECIDO` (401), `SOMENTE_PARTICIPANTE` (403), `NAO_INSCRITO` (403), `NAO_ENCONTRADO` (404), `DADOS_INVALIDOS` (422), `ATIVIDADE_CANCELADA` (422), `ATIVIDADE_NAO_ENCERRADA` (422), `PRESENCA_INSUFICIENTE` (422).
- **Ordem geral do contrato:** identificação (401) → perfil (403) → existência (404) → corpo (422) → regras do recurso.

---

## Rodada 1 — Perguntas de Regra de Negócio

| # | Pergunta | Resposta | Fonte |
|---|---|---|---|
| P-01 | **Fronteira do escopo:** O que o M4 faz e o que NÃO faz? | M4 faz emissão e listagem dos meus certificados, verificação pública pelo código e extrato de horas complementares. Lê os dados dos módulos M1, M2 e M3, sem alterar atividades, inscrições ou presenças. Não inclui o painel M5. | definição do módulo e contrato-api.md |
| P-02 | **Requisitos para emissão de certificado:** Quais as condições para um participante emitir o certificado de uma atividade em `POST /atividades/:id/certificado`? Qual a presença mínima exigida e qual o estado necessário da atividade? | Para emitir, o participante precisa ter inscrição confirmada em uma atividade não cancelada, que já tenha terminado, e presença em pelo menos 75% dos encontros. A atividade é considerada encerrada a partir do instante do fim do último encontro, inclusive. A frequência mínima não pode ser arredondada para favorecer o participante. A comparação deve ser feita assim: presencas × 4 ≥ encontros × 3. | RN-401 a RN-405 |
| P-03 | **Reemissão de certificado:** O que acontece ao chamar `POST /atividades/:id/certificado` para uma atividade que já possui certificado emitido previamente para aquele participante? | A primeira solicitação que atende às condições cria o certificado e retorna status 201. Nas solicitações seguintes, o sistema retorna o mesmo certificado com status 200, sem gerar outro código ou uma nova emissão. | RN-407, RN-413 e contrato-api.md |
| P-04 | **Geração e formato do código:** Como o `codigo` do certificado deve ser gerado e formatado? Qual o padrão e escopo de unicidade? | O código deve seguir o formato SA26-XXXX-XXXX. Os oito caracteres variáveis devem usar o alfabeto ABCDEFGHJKLMNPQRSTUVWXYZ23456789, sem os caracteres 0, O, 1 e I. Cada código precisa ser único entre os certificados do sistema. Ele é criado na primeira emissão e nunca muda. Não há um algoritmo específico de geração definido; a implementação deve garantir o formato e impedir códigos duplicados. | RN-407 e RN-305 |
| P-05 | **Verificação pública e formatação do nome:** Na rota pública `GET /certificados/:codigo`, como funciona a verificação de código inexistente e qual a regra para formatação/abreviação do nome do participante? | Qualquer pessoa pode consultar um certificado pelo código, sem informar X-Usuario. A consulta aceita letras minúsculas. Se o código não existir, deve retornar status 404 com NAO_ENCONTRADO. A resposta apresenta o código, o nome abreviado do participante, a atividade, a carga horária e a data de emissão. | RN-408, RN-409 e contrato-api.md para recurso inexistente |
| P-06 | **Itens do extrato:** Quais atividades entram no `GET /extrato` de um participante e quando o campo `codigo` de cada item vem preenchido? | O extrato deve incluir todas as atividades para as quais o participante já pode receber certificado, mesmo que ainda não tenha solicitado a emissão. Isso significa que a atividade precisa estar encerrada, não pode estar cancelada, a inscrição deve estar confirmada e a frequência deve atingir o mínimo exigido. Quando o certificado já foi emitido, o campo codigo vem preenchido. Quando ainda não foi emitido, vem como null. O extrato é calculado no momento da consulta. | RN-410 e RN-401 a RN-405 |
| P-07 | **Cálculo dos totais e aproveitamento de horas no extrato:** Como são calculados os totais `palestrasMinutos`, `minicursosMinutos`, `totalMinutos` e `aproveitadoMinutos` no extrato? Existe teto de aproveitamento de horas? | palestrasMinutos é a soma das cargas horárias das palestras elegíveis. minicursosMinutos é a soma das cargas horárias dos minicursos elegíveis. totalMinutos é a soma desses dois valores, sem aplicar os tetos. Para calcular aproveitadoMinutos, primeiro considero no máximo 240 minutos de palestras. Depois somo os minutos de minicursos e aplico o limite total de 1200 minutos. A fórmula fica: aproveitadoMinutos = min(min(palestrasMinutos, 240) + minicursosMinutos, 1200) Esses tetos afetam somente o aproveitamento das horas complementares. Não reduzem a carga horária dos certificados nem os totais brutos do extrato. | RN-406 e RN-410 a RN-412 |
| P-08 | **Ordem de precedência de erros na emissão:** Quando a emissão do certificado (`POST /atividades/:id/certificado`) viola múltiplas regras ao mesmo tempo, qual a ordem de precedência das checagens? | Primeiro são feitas as verificações gerais: identificação do usuário, perfil de participante, existência da atividade e validação do corpo, quando aplicável. Para a primeira emissão, a ordem dos impedimentos é: Atividade inexistente: NAO_ENCONTRADO, status 404. Atividade cancelada: ATIVIDADE_CANCELADA, status 422. Inscrição não confirmada: NAO_INSCRITO, status 403. Atividade ainda não encerrada: ATIVIDADE_NAO_ENCERRADA, status 422. Frequência abaixo do mínimo: PRESENCA_INSUFICIENTE, status 422. Se o certificado já tiver sido emitido para aquele participante e atividade, a solicitação deve devolver o mesmo certificado com status 200. A posição exata dessa consulta em relação a todas as verificações gerais não está detalhada. | RN-413 e convenções do contrato-api.md |
| P-09 | **Limites de tempo para emissão de certificado:** Existe algum prazo limite de tempo (após o encerramento do encontro ou do evento) para que o participante possa solicitar a emissão do certificado? | A emissão fica disponível a partir do instante do fim do último encontro. Não há prazo máximo definido para solicitar, então não deve ser acrescentada uma data de expiração. | RN-401; prazo máximo não especificado |
| P-10 | **Sincronização posterior de presenças offline (M3):** Se um participante tenta emitir o certificado antes de sincronizar presenças offline registradas no M3 e falha (recebendo `PRESENCA_INSUFICIENTE`), ele pode emitir o certificado normalmente após a sincronização ser concluída dentro do prazo do M3? | Sim. Uma tentativa recusada por frequência insuficiente não impede uma nova solicitação. Se as presenças offline forem aceitas e o participante atingir a frequência mínima, ele poderá emitir normalmente. A sincronização pode ser feita até duas horas após o fim do encontro, incluindo o instante limite, desde que cumpra as demais condições de validação. Não precisa esperar esse prazo terminar para emitir. Se a atividade já acabou e o participante já atende às condições, pode solicitar o certificado. | RN-405, RN-404 e RN-310; nova tentativa é consequência dessas regras |
| P-11 | **Cálculo da carga horaria e presenças:** Como é calculada a `cargaHorariaMinutos` do certificado? É sempre a soma total da duração dos encontros da atividade (M1) ou depende dos encontros com presença registrada? | O certificado deve informar a carga horária integral da atividade, calculada pela soma da duração de todos os encontros, em minutos. A frequência determina se o participante tem direito ao certificado, mas não reduz a carga horária. Por exemplo, quem comparece a três dos quatro encontros e atende ao mínimo recebe a carga horária total da atividade. | RN-406 e RN-109 |
| P-12 | **Estabilidade e imutabilidade de certificado já emitido:** Um certificado já emitido (com `codigo`, `cargaHorariaMinutos`, `presencas`, `encontros`, `emitidoEm`) torna-se imutável, permanecendo inalterado mesmo se houver alterações posteriores nas presenças ou nos dados da atividade? | O código nunca muda, e uma nova solicitação deve devolver o mesmo certificado, sem criar outra emissão ou mudar a data original. Minha interpretação é preservar também a carga horária e as quantidades de presenças e encontros registradas na primeira emissão. Porém, não está definida uma política completa de correção, revogação ou atualização posterior. Por isso, considero a preservação dos valores originais a orientação para implementação, mas a imutabilidade absoluta de todos os campos ainda precisa de confirmação. | RN-407 e RN-413; preservação dos demais valores é interpretação indicada na resposta, não uma regra explícita adicional |

---

## Questões Técnicas e Análise de Repositório

### Fatos comprovados no repositório / Contrato
- **Autenticação e Perfis:** A API exige o cabeçalho `X-Usuario` em todas as rotas de M4 exceto em `GET /certificados/:codigo` (pública). Sem cabeçalho válido → 401 `USUARIO_DESCONHECIDO`. Acesso por usuário da organização em rotas restritas a participantes responde 403 `SOMENTE_PARTICIPANTE`.
- **Relógio do modo de teste:** Qualquer regra ou atributo que dependa do tempo atual deve ler `agora()` de `src/relogio.js` (nunca `new Date()` ou `Date.now()`).
- **Exemplos do contrato não são prova de regra:** Os valores exibidos na seção 5 de `contrato-api.md` (como `"Carla M. S."` ou `"SA26-7K2M-9QXA"`) são apenas ilustrações de formato das respostas de exemplo e não comprovam algoritmos específicos nem regras de negócio sem a consulta formal de requisitos.

### Propostas de implementação (Ainda NÃO existentes no código)
- **Tabela `certificados`:** A persistência de certificados em banco de dados SQLite é uma proposta de arquitetura para a API e não existe na base de dados atual.
- **Validação de Inscrição:** A exigência de inscrição `confirmada` para emissão do certificado é uma regra de negócio que depende da confirmação formal dos requisitos nas próximas rodadas.
