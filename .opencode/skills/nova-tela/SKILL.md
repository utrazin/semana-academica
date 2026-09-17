---
name: nova-tela
description: Implementa uma tela da interface a partir da spec do módulo e do contrato-api.md, com a API trocada por uma versão falsa nos testes. Use quando pedirem uma tela, uma página, um componente de interface, ou "faz a tela de X".
---

# Tela por trás da spec, API de mentira no teste

A regra de negócio já foi decidida — está na spec do módulo (`specs/Mx-*.md`) e no
`contrato-api.md`. Esta skill não inventa regra nova: traduz o que a API já responde em
tela. Se faltar uma decisão de layout ou texto que a spec não cobre, decida pelo mais
simples e siga — isso não é regra de negócio, não precisa de entrevista.

## Onde mora

- Componente: `web/src/paginas/<nome>/<Nome>.jsx`
- Teste ao lado: `web/src/paginas/<nome>/<Nome>.test.jsx`
- Cliente de API real: `web/src/api.js` — a única parte do app que chama `fetch`.

## A API de mentira

O teste **nunca** chama a API real. `web/src/api.js` exporta funções puras
(`listarAtividades()`, `criarAtividade(corpo)`, …); o componente recebe o cliente por
prop ou injeção, nunca importa `api.js` direto se o teste precisar trocá-lo.

No teste, troque por um objeto simples que devolve o mesmo formato que a API devolveria
— incluindo erro: `{ erro: 'CONFLITO_DE_SALA', mensagem: '...' }` com o status certo.
Não invente formato de erro diferente do contrato.

## O ciclo, por comportamento

Para cada comportamento da tela (estado vazio, estado com dado, erro devolvido pela API,
ação do usuário), nesta ordem:

1. Escreva **um** teste com a API falsa devolvendo o cenário exato.
2. Rode. Tem que falhar (o componente ainda não existe ou não trata esse caso).
3. Escreva o mínimo de JSX/lógica que faz passar.
4. Rode a suíte inteira. Verde? Próximo comportamento.

Um teste por comportamento, não um teste gigante que monta a tela inteira de uma vez.

## Erro da API aparece cru

Quando a tela precisa mostrar um erro (ex.: formulário de criação), mostre o `erro` e a
`mensagem` que a API mandou — não traduza para uma frase própria, não esconda o código.
É assim que o formulário prova, no teste, que está lendo a resposta real da API e não
uma mensagem inventada.

## O que não fazer

- Não decida regra de negócio na tela (limite, prazo, ordem) — se a tela precisar de uma
  regra que a spec não tem, é buraco na spec, não decisão de CSS.
- Não chame `fetch` dentro de um componente ou teste — sempre pelo cliente injetável.
- Não teste estilo/CSS. Teste o que aparece na tela e o que a ação dispara.

## Fechamento

Terminada a tela, rode a suíte inteira uma vez e relate o número real da saída.
