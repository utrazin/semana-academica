# AGENTS.md — web

- O componente recebe o cliente de API por prop e nunca importa `api.js` direto, para o teste poder trocar por uma versão falsa.
- Erro da API aparece cru na tela, com o código e a mensagem que ela mandou.
- Campo opcional de corpo vai ausente, nunca `null`: `lidoEm: null` é `DADOS_INVALIDOS` na API, e `JSON.stringify` já descarta `undefined`.
- Erro falso no teste precisa ter `status` quando representa recusa da API — sem `status` o app trata como queda de rede.
- `setTimeout` com atraso maior que 2.147.483.647 ms estoura o inteiro de 32 bits e dispara em 1 ms; limite o atraso antes de agendar (aconteceu na tela do código).
- Limpe o `localStorage` entre os testes.