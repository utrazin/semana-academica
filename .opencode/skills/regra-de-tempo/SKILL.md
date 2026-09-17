---
name: regra-de-tempo
description: Implementa e testa regra que depende de tempo lendo o relógio do modo de teste — `agora()` de `api/src/relogio.js` — sem usar `new Date()` nem `Date.now()` na regra e sem persistir estado derivado. Use quando a tarefa falar em "regra de tempo", "janela", "prazo", "expiração" ou "relógio do modo de teste".
---

# Regra de tempo lê o relógio; o teste prova a borda

Regra que depende de tempo não inventa relógio e não guarda o que o tempo faz com o dado.
Ela lê `agora()` de `api/src/relogio.js` e recalcula janela, validade e expiração na
leitura. O teste fixa o instante pelo modo de teste e prova a borda, não o meio.

## O relógio é a única fonte

A regra chama `agora()` de `api/src/relogio.js`. `new Date()` e `Date.now()` dentro de
regra são erro: em produção `agora()` devolve o relógio real, e a regra não percebe a
diferença; no modo de teste (`MODO_TESTE=1`) **o relógio fica parado** em
`2026-10-13T09:00:00-03:00` e **só muda por `PUT /_teste/relogio`**.

## Nada de tempo persistido

Janela, validade e expiração se **calculam na leitura**, nunca se gravam. É o que o M1
faz com `situacao` (segue o relógio, não é coluna) e o M2 com a expiração em cascata da
convocação (vencida se calcula ao ler, mesmo sem acesso prévio). No banco vai o fato —
quando aconteceu —, não a conclusão que o tempo tira dele.

## Todo teste de tempo começa igual

`POST /_teste/reset` e, **antes de cada chamada**, `PUT /_teste/relogio` fixando o
instante. Teste que depende da hora real do sistema não é teste: sem o `reset` o cenário
herda o estado do anterior; sem fixar o relógio, o resultado muda de madrugada.

## A borda se prova na borda

Regra com borda se prova no **instante exato que está dentro e um segundo fora, dos dois
lados**. Só o meio da janela não prova nada. Exemplo real: encontro das 19:00 às 22:00,
QR aceito de 18:45:00 a 19:30:00 — teste `18:45:00` → 201, `18:44:59` → 422, `19:30:00` →
201 (fim inclusivo) e `19:30:01` → 422. O `19:10` do meio passaria em qualquer
implementação.

## Empate do relógio parado

Com o relógio parado, campos gerados no mesmo instante **empatam**. Nunca ordene nem
afirme nada por `registradaEm` ou campo equivalente — o empate deixa a ordem indefinida e
o teste passa por sorte. Ordem se prova por campo explícito e determinístico, ou por
nome com desempate por `id`, como M3 faz com presenças.

## Data é instante, não texto

Datas em ISO 8601 com fuso. Compare **instante**, não texto: passe por `Date.parse` (ou
`getTime()`) e compare milissegundos. `2026-10-20T19:00:00-03:00` e
`2026-10-20T22:00:00Z` são o mesmo instante e não são a mesma string.

## Janela alinhada ao relógio

Período que começa no relógio se calcula **truncando para o começo do período**, não
somando a partir de um instante arbitrário. O código que troca a cada minuto às 19:03:20
tem `trocaEm` 19:04:00 e `validoAte` 19:05:00 — trunque o minuto, não some 60s à leitura.
Duas leituras no mesmo minuto dão o mesmo código e os mesmos limites.

## Fechamento

Terminada a regra, rode a suíte inteira uma vez e relate o número real da saída. Não
estime, não arredonde, não repita um número de outra rodada.
