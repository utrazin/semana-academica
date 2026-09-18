# M4 — Tratamento dos achados da auditoria de 2026-09-17

Documento separado do parecer original (`auditorias/M4-2026-09-17.md`, inalterado).
Escopo desta rodada (M4-R1): somente o achado 1. Nenhum teste existente foi alterado;
nenhuma falha foi forçada.

## Achado 1 — prova de que a emissão não altera atividades, inscrições ou presenças

- Teste acrescentado: `api/verificacoes/m4-certificados-preservacao.spec.js`
  («R1: emissao do certificado nao altera atividade, inscricao nem presencas (relógio fixo)»),
  por HTTP contra `criarServidor()` em porta efêmera, nos moldes dos demais testes do M4.
- O teste semeia atividade (M1) + inscrição confirmada (M2) + presenças (M3), fixa o
  relógio com `PUT /_teste/relogio` no instante exato do fim do último encontro e captura,
  antes da emissão, pelos endpoints existentes e com os perfis apropriados:
  `GET /atividades/:id` (participante), `GET /inscricoes/:id` (participante, a própria
  inscrição) e `GET /encontros/:id/presencas` por encontro (organização).
- Emite com `POST /atividades/:id/certificado` (espera 201), confirma pelo
  `GET /_teste/relogio` que o relógio permanece fixo e consulta novamente os mesmos
  endpoints, comparando os dados completos antes/depois com `deepEqual` bit a bit.
- Resultado: o teste passou diretamente na primeira execução, sem ajuste de
  implementação — registrado como verificação adicional da cláusula de não-mutação
  de R1 (`specs/M4-certificados.md:82-85`), coerente com o handler só ler essas tabelas
  (`api/src/app.js:1020-1077`). Não era defeito; era lacuna de prova, agora coberta.
- Suíte da API após a adição: `# tests 134 / # pass 134 / # fail 0`
  (`node --test "verificacoes/*.spec.js"` com Node 22, conforme `projeto.json`;
  133 anteriores + 1 novo). Nota de ambiente: o Node padrão da máquina é 24 e o
  `better-sqlite3` instalado mira o Node 22 — a suíte foi rodada com Node 22.19.0
  portátil após `npm rebuild better-sqlite3`; nada no repositório foi alterado por isso.

## Achado 2 — observação de cobertura de ramo (gerador de código)

Sem mudança. A unicidade das saídas segue verificada
(`m4-certificados-reemissao.spec.js:166` e `:255`); o ramo de colisão dirigida
(`api/src/app.js:1006-1018`, `catch SQLITE_CONSTRAINT` em `:1056-1067`) continua sem
teste que o dispare, e nenhuma cobertura de colisão é alegada. R9 exige formato,
alfabeto e unicidade — o gerador permanece livre.

## Achado 3 — testes da interface com API falsa

Sem mudança. Os testes web do M4 atendem à exigência da interface (renderização e
chamadas aos métodos falsos); as regras de negócio R1–R16 seguem comprovadas na API,
onde os cenários da spec são exercitados de verdade.

## Achados 4 e 5 — D1/D2 permanecem abertas

Sem mudança. D1 (posição da consulta 200 frente às verificações gerais) e D2
(política de correção/revogação/atualização; preservação de
`cargaHorariaMinutos`/`presencas`/`encontros` além de código + `emitidoEm`) continuam
em aberto por definição. Testes com dados inalterados — inclusive o novo teste do
achado 1 — não decidem comportamento após alterações; nenhum teste congela ordem de
D1 nem imutabilidade absoluta de D2.

## Achado 6 — contrato

Sem divergência apontada no M4; a revisão de contrato ainda será executada
pelo revisor-de-contrato em rodada própria.
