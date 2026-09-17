# AGENTS.md — api

- Regra que depende de tempo lê `agora()` de `src/relogio.js`; `new Date()` e `Date.now()` dentro de regra quebram o modo de teste, onde o relógio fica parado.
- Nada de estado derivado do tempo guardado no banco: janela, validade e expiração são calculadas na leitura.
- Tabela nova precisa entrar em `resetarBanco()` antes das tabelas de que ela depende, por causa das foreign keys — se não entrar, os testes passam com banco `:memory:` e o juiz quebra com `POST /_teste/reset`.
- Teste fala por HTTP com `criarServidor()` em porta efêmera e semeia o cenário no banco com helper; nunca importa serviço nem repositório direto.
- Declare `const` antes de usar dentro do handler: um uso antes da declaração vira 500 silencioso em vez de erro de regra (aconteceu na fatia 4 do M3).