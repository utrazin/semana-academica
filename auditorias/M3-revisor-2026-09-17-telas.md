# Revisão de contrato — M3 (Presença por QR)

## 1. Tabela rota por rota (API)

| Rota | Método | Veredito |
|---|---|---|
| `/encontros/:id/codigo` | GET | CONFORME |
| `/encontros/:id/presencas` | POST | CONFORME |
| `/encontros/:id/presencas/manual` | POST | CONFORME |
| `/encontros/:id/presencas` | GET | CONFORME |

## 2. Pontos de interface (`web/`) conferidos

| Arquivo | O que confere | Veredito |
|---|---|---|
| `web/src/api.js:104-106` | `obterCodigoDoEncontro` → `GET /encontros/:id/codigo` | CONFORME |
| `web/src/api.js:108-113` | `registrarPresenca` → `POST /encontros/:id/presencas` com corpo `{ codigo, lidoEm }` | CONFORME |
| `web/src/api.js:115-120` | `registrarPresencaManual` → `POST /encontros/:id/presencas/manual` com corpo `{ participanteId, justificativa }` | CONFORME |
| `web/src/api.js:122-124` | `listarPresencas` → `GET /encontros/:id/presencas` | CONFORME |
| `web/src/App.jsx:30-33, 69-80` | Navegação para as telas M3 conforme o papel do usuário | CONFORME |
| `web/src/paginas/presenca-participante/PresencaParticipante.jsx:52-55, 83, 89, 126` | Presença por QR/offline: chama só `registrarPresenca`, com `{ codigo }` online e `{ codigo, lidoEm }` na fila offline; lê apenas `presenca.origem` da resposta | CONFORME |
| `web/src/paginas/presenca-organizacao/PresencaOrganizacao.jsx:15, 19, 22` | Código por QR: chama só `obterCodigoDoEncontro`; lê `codigo` e `trocaEm` | CONFORME |
| `web/src/api.test.js:189-253` e testes das duas telas (7 arquivos, 51 testes) | Todos passaram (`npm --prefix web test`) | CONFORME |

## 3. O que verifiquei em execução

Subi a API real com `MODO_TESTE=1` e `PORT=3000` (`npm start` em `api/`) e chamei com `curl.exe`:

- `POST /_teste/reset` → 204.
- `POST /atividades` (org-ana) → 201 com `id: atv_3663cfda`, `encontros[0].id: enc_54a276c4` — id `prefixo + 8 hex` OK.
- `GET /encontros/enc_54a276c4/codigo` (org-ana) → 200 `{"encontroId":"enc_54a276c4","codigo":"HLTS29","trocaEm":"2026-10-20T19:04:00-03:00","validoAte":"2026-10-20T19:05:00-03:00"}` — exatamente os 4 campos da seção 5 (`contrato-api.md:162-168`), código de 6 caracteres, datas ISO 8601 com fuso.
- Papel trocado nas 4 rotas → 403 `SOMENTE_ORGANIZACAO`/`SOMENTE_PARTICIPANTE` antes da existência; sem `X-Usuario` → 401 `USUARIO_DESCONHECIDO`; `enc_00000000` → 404 `NAO_ENCONTRADO` (ordem 401→403→404→422 da `contrato-api.md:17`).
- **Corpo não-JSON** nas duas POST (`{ nao e json` com `Content-Type: application/json`) → 422 `{"erro":"DADOS_INVALIDOS","mensagem":"O corpo precisa ser um JSON válido."}` — JSON, não `400 text/html`. (Achado 1 da revisão anterior está corrigido: `api/src/app.js:23-31` registra o middleware de erro do `express.json`.)
- **Tipo errado**: `codigo: 123` → 422 `DADOS_INVALIDOS`; `lidoEm: 123` → 422 `DADOS_INVALIDOS`; `participanteId: 7` → 422 `DADOS_INVALIDOS`; `justificativa: 123` → 422 `DADOS_INVALIDOS` (Achado 2 da revisão anterior está corrigido: `api/src/app.js:890-895` agora devolve `DADOS_INVALIDOS` para tipo errado; ausente continua `JUSTIFICATIVA_OBRIGATORIA`, `api/src/app.js:884-889`).
- QR com código válido → 201 `{"id":"pre_08150c7b","encontroId":"enc_54a276c4","participanteId":"p-carla","origem":"qr","lidoEm":"2026-10-20T19:03:10-03:00","registradaEm":…,"justificativa":null}` — exatamente os 7 campos da `Presenca` (`contrato-api.md:176-185`), `pre_` + 8 hex, datas com fuso. Repetição → 200 com a mesma presença (`contrato-api.md:157`).
- QR offline com `lidoEm` → 201 `origem: "qr_offline"`; manual válida → 201 `origem: "manual"` com justificativa; manual repetida → 200.
- `GET /encontros/:id/presencas` (org-ana) → 200 `[Presenca]` (com as duas presenças); como p-carla → 403 `SOMENTE_ORGANIZACAO`.

Suítes: `npm --prefix api test` → 93/93 passando (32 do spec M3, `api/verificacoes/m3-presenca.spec.js`, incluindo os testes R25 corpo não-JSON em `:147-188` e tipo errado de justificativa em `:1240-1287`); `npm --prefix web test` → 51/51 passando.

## 4. Achados

**Nenhuma divergência de casca encontrada.** Registro abaixo os pontos que confirmei e uma observação que não é divergência:

1. `api/src/app.js:23-31` — middleware de erro do `express.json` devolve `422 DADOS_INVALIDOS` para corpo não-JSON; verificado em execução nas duas POST do M3. Contrariava `contrato-api.md:16`/`:266` na revisão anterior; agora está conforme (teste `api/verificacoes/m3-presenca.spec.js:147-188`).
2. `api/src/app.js:890-895` — `justificativa` de tipo errado devolve `422 DADOS_INVALIDOS`, e `contrato-api.md:174` continua `JUSTIFICATIVA_OBRIGATORIA` só para ausente (teste `api/verificacoes/m3-presenca.spec.js:1240-1287`).
3. Observação (não divergência) — `web/src/api.js:122-124` expõe `listarPresencas` e `api.test.js:245-253` prova a chamada, mas nenhuma tela em `web/src/` consome essa função (grep por `listarPresencas` só acha `api.js` e o teste): a listagem de presenças não tem consumidor na interface, sem chamar rota inexistente nem ler campo fora do contrato.

## 5. Veredito final

A casca do M3 (API e interface) bate com o contrato: as 4 rotas, os formatos `CodigoDoEncontro` e `Presenca`, os códigos de retorno (incluindo corpo não-JSON e tipo errado → `422 DADOS_INVALIDOS`) e o consumo na `web/` estão conformes — as duas divergências apontadas em `auditorias/M3-revisor-2026-09-17.md` já foram corrigidas no código atual.