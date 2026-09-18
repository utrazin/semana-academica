# M5 — Painel da Organização

## Contexto
Módulo de painel para a organização visualizar atividades, inscrições, frequência e bloqueios. Acesso restrito a usuários com papel `organizacao`.

## Rotas da API (do contrato)

| Método | Rota | Descrição | Retorno |
|---|---|---|---|
| GET | `/painel/atividades` | Lista todas as atividades com dados do painel | 200 `[LinhaDoPainel]` |
| GET | `/painel/atividades/:id/sem-chance` | Participantes com faltas acima do permitido | 200 `[SemChance]` |
| GET | `/painel/atividades/:id/frequencia.csv` | Exporta frequência em CSV | 200 `text/csv` |
| GET | `/painel/bloqueios` | Lista todos os bloqueios | 200 `[Bloqueio]` |
| DELETE | `/painel/bloqueios/:participanteId` | Remove bloqueio de um participante | 204 / 404 |

## Dados do Contrato

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

## Perguntas Pendentes (a consultar na rodada 2 de requisitos)

1. **Cálculo de `ocupacaoPercentual`**: Fonte — RN-503: Segundo a RN-503, a ocupação é calculada dividindo as inscrições ocupadas (confirmadas + convocadas) pelas vagas e multiplicando por 100, arredondando com uma casa decimal e meio para cima.
2. **Frequência no `LinhaDoPainel`**: Fonte — RN-504: Segundo a RN-504, a frequência do encontro é presenças divididas pelas inscrições confirmadas. A frequência da atividade é a média dos encontros já encerrados; se não houver nenhum encerrado, fica null.
3. **`sem-chance`**: Fonte — RN-505: Segundo a RN-505, é o participante confirmado que, contando apenas os encontros com prazo de registro vencido (fim do encontro + 2 h), já faltou mais do que a RN-404 permite, aparecendo na lista mesmo antes da atividade encerrar.
4. **`frequencia.csv`**: Fonte — RN-506: Segundo a RN-506, o CSV deve usar separador ponto e vírgula, codificação UTF-8 com BOM, uma linha por confirmado em ordem de nome, com colunas nome;E1;...;En;frequencia;certificado. As marcas são P (presente), F (prazo vencido sem presença) e hífen (prazo aberto). A frequência usa vírgula e uma casa decimal e o certificado sim ou nao.
5. **Bloqueio**: Fonte — RN-507: Segundo a RN-507, o participante confirmado em 2 atividades encerradas com zero presença fica bloqueado de se inscrever em qualquer outra atividade do evento, incluindo a lista de espera. As inscrições que ele já possui continuam válidas.
6. **Ordem dos bloqueios**: Fonte — RN-508 e RN-509: Segundo a RN-508 e RN-509, a organização vê os bloqueados com as atividades que causaram o bloqueio e pode desbloquear. Após o desbloqueio, apenas atividades encerradas após ele contam para um novo bloqueio.
7. **Janela de tempo**: Fonte — RN-502: Segundo a RN-502, atividades canceladas ficam fora do painel da organização, exibindo apenas as atividades válidas durante o período do evento.
8. **Participantes não inscritos**: Fonte — RN-501: Segundo a RN-501, todo o painel é de uso e acesso exclusivo da organização.

## Registros de Decisão

- Todas as perguntas foram registradas como "consultar requisitos" — pendentes de consulta no documento de requisitos (rodada 2 da entrevista).
- Respostas serão inseridas após consulta ao documento de requisitos.