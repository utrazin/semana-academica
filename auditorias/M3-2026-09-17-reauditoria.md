## Matriz de rastreabilidade

| Regra | Origem | Teste que comprova | Veredito |
|---|---|---|---|
| R1 | P1 | `api/verificacoes/m3-presenca.spec.js:825` «R1: registrar presenca por QR nao altera a inscricao deixada pelo M2» | COMPROVADA |
| R2 | P1 (contrato) | `m3-presenca.spec.js:68` «R2: … 401 USUARIO_DESCONHECIDO» e `:95` «R2: perfil trocado … 403» | COMPROVADA |
| R3 | P18 (contrato) | `m3-presenca.spec.js:121` «R3: encontro inexistente → 404 NAO_ENCONTRADO» | COMPROVADA |
| R4 | P12 (contrato, seção 1) | `m3-presenca.spec.js:875` «R4: lidoEm não-string ou não-data → 422 DADOS_INVALIDOS» | COMPROVADA |
| R5 | P7 | `m3-presenca.spec.js:553` «R5: codigo ausente/não-string → DADOS_INVALIDOS; curto/outro encontro → CODIGO_INVALIDO» | COMPROVADA |
| R6 | P8 | `m3-presenca.spec.js:417` «R6: só confirmada registra por QR» e `:1247` «R6 na manual» | COMPROVADA |
| R7 | P2 | `m3-presenca.spec.js:241` «R7: janela do obter codigo, bordas incluídas» | COMPROVADA |
| R8 | P16 | `m3-presenca.spec.js:281` «R8: ATIVIDADE_CANCELADA antes de FORA_DA_JANELA» e `:316` «R8 parte 2: QR e manual → NAO_INSCRITO» | COMPROVADA |
| R9 | P3 | `m3-presenca.spec.js:495` «R9: janela do QR, bordas incluídas» | COMPROVADA |
| R10 | P4 | `m3-presenca.spec.js:1195` «R10: janela da manual até fim + 2h» | COMPROVADA |
| R11 | P5 | `m3-presenca.spec.js:147` «R11: código estável no minuto; muda no minuto seguinte» | COMPROVADA |
| R12 | P6 | `m3-presenca.spec.js:192` «R12: trocaEm/validoAte com sobreposição» e `:619` «R12: aceita corrente e anterior; recusa em validoAte» | COMPROVADA |
| R13 | P14 | `m3-presenca.spec.js:675` «R13: normaliza caixa e espaços; fora do alfabeto → CODIGO_INVALIDO» | COMPROVADA |
| R14 | P11 | `m3-presenca.spec.js:922` «R14: lidoEm guia janela e validade; sem lidoEm vale o envio» | COMPROVADA |
| R15 | P12 | `m3-presenca.spec.js:976` «R15 e R24: lidoEm adiantado não é erro» | COMPROVADA |
| R16 | P13 | `m3-presenca.spec.js:1024` «R16: aceito até fim + 2h; depois SINCRONIZACAO_TARDIA» | COMPROVADA |
| R17 | P9, P10 | `m3-presenca.spec.js:728` «R17 e R24: 201 → 200 com a mesma presença» e `:1517` «R17: cruzamento manual × QR preserva» | COMPROVADA |
| R18 | P15 | `m3-presenca.spec.js:1142` «R18: justificativa ≥ 10 caracteres» | COMPROVADA |
| R19 | P17 | `m3-presenca.spec.js:1366` «R19: teto 10% arredondado p/ cima (5→1, 20→2, 21→3)» | COMPROVADA |
| R20 | P18 | `m3-presenca.spec.js:1080` «R20: ordem da rota QR» | COMPROVADA |
| R21 | P19 | `m3-presenca.spec.js:1436` «R21: ordem da rota manual» | COMPROVADA |
| R22 | P20 | `m3-presenca.spec.js:1591` «R22: listagem ordenada por nome, desempate por participanteId» | COMPROVADA |
| R23 | P21 | `m3-presenca.spec.js:783` «R23: código vencido recusado sem rotação buscada» | COMPROVADA |
| R24 | P22 | `m3-presenca.spec.js:728` (qr), `:976` (qr_offline adiantado), `:922` (qr_offline com lidoEm), `:1316` (manual) | COMPROVADA |

Todas as 24 regras citam P-xx que existe na entrevista e tem resposta (nenhuma `PENDENTE`). Todas têm teste que executa o cenário e confere status **e** valor/`erro` — não só o nome. Todas têm implementação em `api/src/app.js` (rotas em `:761`, `:786`, `:866`, `:948`).

## Suíte

`npm --prefix api test` (raiz) → `# tests 91 / # pass 91 / # fail 0` (TAP, 91 subtests ok, incluindo os 30 de M3).
`npm --prefix web test` (raiz) → `Test Files 5 passed (5) / Tests 32 passed (32)`.

## Achados

1. **[CONTRATO — cite de passagem]** `api/src/app.js:874-880`: justificativa não-string (número, objeto) cai em `JUSTIFICATIVA_OBRIGATORIA`, porque a condição é `typeof justificativa !== 'string' || justificativa.length < 10`. O contrato (seção 1) manda `DADOS_INVALIDOS` para "campo obrigatório ausente ou de tipo errado"; a spec R18 só cobre ausente/vazia/<10 caracteres. Não há teste para justificativa não-string. Assunto do revisor-de-contrato; não bloqueia M3.
2. **[OBSERVAÇÃO — teste sem regra]** `m3-presenca.spec.js:378` «infra: POST /_teste/reset limpa a tabela presencas» não corresponde a nenhuma regra da spec — é teste de infraestrutura do modo de teste. Inofensivo.
3. **[OBSERVAÇÃO — cobertura literal do critério 11]** O teste R11 (`m3-presenca.spec.js:147`) não assere explicitamente que `trocaEm`/`validoAte` são iguais entre dois GETs no mesmo minuto (cláusula do critério de aceite 11). A regra está comprovada mesmo assim: o R12 (`:192`) verifica os valores exatos calculados (`trocaEm` 19:04:00, `validoAte` 19:05:00) e o R23 (`:783`) prova que nada é guardado. Não é prova fraca.
4. **[OBSERVAÇÃO — interface]** A `web/` não tem tela nem teste de M3 (não há página de presença/código em `web/src/paginas/`, e `web/src/api.js` não expõe as rotas de M3). A spec não exige interface para M3 — a seção 7 manda verificar por HTTP na API — então não é defeito.

## Veredito

Módulo M3 aceito: as 24 regras da spec têm origem na entrevista, teste que comprova o cenário e implementação correspondente; as duas suítes passam (91/91 na API, 32/32 na web). Único ponto a encaminhar é a divergência de contrato na justificativa não-string (achado 1), que fica para o revisor-de-contrato.