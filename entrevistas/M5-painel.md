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

1. **Cálculo de `ocupacaoPercentual`**: Pendente — aguardar documento de requisitos.
2. **Frequência no `LinhaDoPainel`**: Pendente — aguardar documento de requisitos.
3. **`sem-chance`**: Pendente — aguardar documento de requisitos.
4. **`frequencia.csv`**: Pendente — aguardar documento de requisitos.
5. **Bloqueio**: Pendente — aguardar documento de requisitos.
6. **Ordem dos bloqueios**: Pendente — aguardar documento de requisitos.
7. **Janela de tempo**: Pendente — aguardar documento de requisitos.
8. **Participantes não inscritos**: Pendente — aguardar documento de requisitos.

## Registros de Decisão

- Todas as perguntas foram registradas como "consultar requisitos" — pendentes de consulta no documento de requisitos (rodada 2 da entrevista).
- Respostas serão inseridas após consulta ao documento de requisitos.