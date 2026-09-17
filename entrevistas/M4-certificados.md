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
| P-02 | **Requisitos para emissão de certificado:** Quais as condições para um participante emitir o certificado de uma atividade em `POST /atividades/:id/certificado`? Qual a presença mínima exigida e qual o estado necessário da atividade? | PENDENTE | consultar requisitos |
| P-03 | **Reemissão de certificado:** O que acontece ao chamar `POST /atividades/:id/certificado` para uma atividade que já possui certificado emitido previamente para aquele participante? | PENDENTE | consultar requisitos |
| P-04 | **Geração e formato do código:** Como o `codigo` do certificado deve ser gerado e formatado? Qual o padrão e escopo de unicidade? | PENDENTE | consultar requisitos |
| P-05 | **Verificação pública e formatação do nome:** Na rota pública `GET /certificados/:codigo`, como funciona a verificação de código inexistente e qual a regra para formatação/abreviação do nome do participante? | PENDENTE | consultar requisitos |
| P-06 | **Itens do extrato:** Quais atividades entram no `GET /extrato` de um participante e quando o campo `codigo` de cada item vem preenchido? | PENDENTE | consultar requisitos |
| P-07 | **Cálculo dos totais e aproveitamento de horas no extrato:** Como são calculados os totais `palestrasMinutos`, `minicursosMinutos`, `totalMinutos` e `aproveitadoMinutos` no extrato? Existe teto de aproveitamento de horas? | PENDENTE | consultar requisitos |
| P-08 | **Ordem de precedência de erros na emissão:** Quando a emissão do certificado (`POST /atividades/:id/certificado`) viola múltiplas regras ao mesmo tempo, qual a ordem de precedência das checagens? | PENDENTE | consultar requisitos |
| P-09 | **Limites de tempo para emissão de certificado:** Existe algum prazo limite de tempo (após o encerramento do encontro ou do evento) para que o participante possa solicitar a emissão do certificado? | PENDENTE | consultar requisitos |
| P-10 | **Sincronização posterior de presenças offline (M3):** Se um participante tenta emitir o certificado antes de sincronizar presenças offline registradas no M3 e falha (recebendo `PRESENCA_INSUFICIENTE`), ele pode emitir o certificado normalmente após a sincronização ser concluída dentro do prazo do M3? | PENDENTE | consultar requisitos |
| P-11 | **Cálculo da carga horaria e presenças:** Como é calculada a `cargaHorariaMinutos` do certificado? É sempre a soma total da duração dos encontros da atividade (M1) ou depende dos encontros com presença registrada? | PENDENTE | consultar requisitos |
| P-12 | **Estabilidade e imutabilidade de certificado já emitido:** Um certificado já emitido (com `codigo`, `cargaHorariaMinutos`, `presencas`, `encontros`, `emitidoEm`) torna-se imutável, permanecendo inalterado mesmo se houver alterações posteriores nas presenças ou nos dados da atividade? | PENDENTE | consultar requisitos |

---

## Questões Técnicas e Análise de Repositório

### Fatos comprovados no repositório / Contrato
- **Autenticação e Perfis:** A API exige o cabeçalho `X-Usuario` em todas as rotas de M4 exceto em `GET /certificados/:codigo` (pública). Sem cabeçalho válido → 401 `USUARIO_DESCONHECIDO`. Acesso por usuário da organização em rotas restritas a participantes responde 403 `SOMENTE_PARTICIPANTE`.
- **Relógio do modo de teste:** Qualquer regra ou atributo que dependa do tempo atual deve ler `agora()` de `src/relogio.js` (nunca `new Date()` ou `Date.now()`).
- **Exemplos do contrato não são prova de regra:** Os valores exibidos na seção 5 de `contrato-api.md` (como `"Carla M. S."` ou `"SA26-7K2M-9QXA"`) são apenas ilustrações de formato das respostas de exemplo e não comprovam algoritmos específicos nem regras de negócio sem a consulta formal de requisitos.

### Propostas de implementação (Ainda NÃO existentes no código)
- **Tabela `certificados`:** A persistência de certificados em banco de dados SQLite é uma proposta de arquitetura para a API e não existe na base de dados atual.
- **Validação de Inscrição:** A exigência de inscrição `confirmada` para emissão do certificado é uma regra de negócio que depende da confirmação formal dos requisitos nas próximas rodadas.
