# Spec — M5: Painel da Organização

## 1. Objetivo

Painel da organização para visualizar atividades, inscrições, frequência e bloqueios. Acesso restrito a usuários com papel `organizacao`.

## 2. Fora de escopo

M5 **não** faz:
- Cálculo de notas escolares ou conceito final do aluno.
- Geração de boletos ou pagamentos.
- Gestão de usuários ou atividades (vêm dos dados iniciais ou M1).

## 3. Modelo

### LinhaDoPainel
```jsonc
{
  "atividadeId": "atv_1a2b3c4d",
  "titulo": "Flutter do zero",
  "vagas": 20,
  "ocupadas": 12,
  "emEspera": 3,
  "ocupacaoPercentual": 60.0,
  "frequenciaPercentual": null
}
```

### SemChance
```jsonc
{ "participanteId": "p-heitor", "nome": "Heitor Campos", "faltas": 2, "faltasPermitidas": 1 }
```

### Bloqueio
```jsonc
{ "participanteId": "p-heitor", "nome": "Heitor Campos",
  "atividades": ["atv_1a2b3c4d", "atv_7e8f9a0b"], "bloqueadoDesde": "…" }
```

## 4. Endpoints

| Método | Rota | Descrição | Retorno |
|---|---|---|---|
| GET | `/painel/atividades` | Lista todas as atividades com dados do painel | 200 `[LinhaDoPainel]` |
| GET | `/painel/atividades/:id/sem-chance` | Participantes com faltas acima do permitido | 200 `[SemChance]` |
| GET | `/painel/atividades/:id/frequencia.csv` | Exporta frequência em CSV | 200 `text/csv` |
| GET | `/painel/bloqueios` | Lista todos os bloqueios | 200 `[Bloqueio]` |
| DELETE | `/painel/bloqueios/:participanteId` | Remove bloqueio de um participante | 204 / 404 |

## 5. Regras

Cada regra cita a pergunta da entrevista (`P-xx`) que a originou e, quando existir, a regra do documento de requisitos (`RN-xxx`). Sem RN, a fonte é decisão do grupo ou contrato.

- **R1** (P1, RN-503): Cálculo de `ocupacaoPercentual` é feito dividindo inscrições ocupadas (confirmadas + convocadas) pelas vagas e multiplicando por 100, arredondando com uma casa decimal e meio para cima.
- **R2** (P2, RN-504): Frequência no `LinhaDoPainel` é a média dos encontros já encerrados; se não houver nenhum encerrado, fica `null`.
- **R3** (P3, RN-505): Lista `sem-chance` contém participantes confirmados que, contando apenas os encontros com prazo de registro vencido (fim do encontro + 2 h), já faltaram mais do que a RN-404 permite, aparecendo na lista mesmo antes da atividade encerrar.
- **R4** (P4, RN-506): Exporta `frequencia.csv` usando separador ponto e vírgula, codificação UTF-8 com BOM, uma linha por confirmado em ordem de nome, com colunas nome;E1;...;En;frequencia;certificado. As marcas são P (presente), F (prazo vencido sem presença) e hífen (prazo aberto). A frequência usa vírgula e uma casa decimal e o certificado sim ou não.
- **R5** (P5, RN-507): Participante confirmado em 2 atividades encerradas com zero presença fica bloqueado de se inscrever em qualquer outra atividade do evento, incluindo a lista de espera. As inscrições que ele já possui continuam válidas.
- **R6** (P6, RN-508 e RN-509): A organização vê os bloqueados com as atividades que causaram o bloqueio e pode desbloquear. Após o desbloqueio, apenas atividades encerradas após ele contam para um novo bloqueio.
- **R7** (P7, RN-502): Atividades canceladas ficam fora do painel da organização, exibindo apenas as atividades válidas durante o período do evento.
- **R8** (P8, RN-501): Todo o painel é de uso e acesso exclusivo da organização.

## 6. Critérios de aceite

1. (R1) `ocupacaoPercentual` é calculado como (ocupadas / vagas) * 100, arredondado com uma casa decimal e meio para cima.
2. (R2) Frequência da atividade é null quando não há encontros encerrados; caso contrário, é a média dos encontros encerrados.
3. (R3) Rota `GET /painel/atividades/:id/sem-chance` retorna participantes que atendem ao critério de faltas vencidas.
4. (R4) CSV de frequência usa separador ponto e vírgula, codificação UTF-8 com BOM, colunas na ordem especificada e marcas P/F/hífen corretas.
5. (R5) Participante com 2 faltas em atividades encerradas aparece na lista de bloqueados.
6. (R6) Após desbloqueio, apenas atividades encerradas posteriormente contam para um novo bloqueio.
7. (R7) Atividades canceladas não aparecem no painel; apenas atividades válidas são exibidas.
8. (R8) Acesso ao painel por usuário sem papel `organizacao` é rejeitado.

## 7. Como isto será verificado

Pela costura mais externa que já existe: **HTTP**, na API subida por `npm start` dentro de `api/` (stack do `projeto.json`), com `MODO_TESTE=1`. Cada cenário começa com `POST /_teste/reset`, usa `PUT /_teste/relogio` para fixar o tempo e `X-Usuario` para autenticação. O juiz do contrato confere status, `erro` e corpo nas mesmas rotas, então o teste que exercita a rota real cobre automaticamente regra e contrato.

## 8. Fatias de entrega

1. **Dados básicos e ocupação**: Rota `GET /painel/atividades` com `LinhaDoPainel` e cálculo de `ocupacaoPercentual` (R1, R7).
2. **Frequência e sem-chance**: Rotas `GET /painel/atividades/:id/sem-chance` e `GET /painel/atividades/:id/frequencia.csv` (R2, R3, R4).
3. **Bloqueios**: Rota `GET /painel/bloqueios` e `DELETE /painel/bloqueios/:participanteId` com lógica de bloqueio e desbloqueio (R5, R6).
4. **Acesso organizacional**: Verificação de papel `organizacao` em todas as rotas do painel (R8).