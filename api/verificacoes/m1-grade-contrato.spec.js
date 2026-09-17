import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarServidor } from '../src/app.js';
import { novoBanco } from '../src/banco.js';

process.env.MODO_TESTE = '1';

export async function subirServidor(opcoes) {
  const app = criarServidor(opcoes);
  const srv = app.listen(0);
  await new Promise((resolve) => srv.once('listening', resolve));
  return {
    base: `http://127.0.0.1:${srv.address().port}`,
    fechar: () => new Promise((resolve) => srv.close(resolve)),
  };
}

test('contrato: chamada sem X-Usuario ou com X-Usuario inexistente devolve 401 USUARIO_DESCONHECIDO', async () => {
  const servidor = await subirServidor();
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const semCabecalho = await fetch(`${servidor.base}/atividades`);
    assert.equal(semCabecalho.status, 401);
    assert.equal((await semCabecalho.json()).erro, 'USUARIO_DESCONHECIDO');

    const desconhecido = await fetch(`${servidor.base}/atividades`, {
      headers: { 'X-Usuario': 'p-ninguem' },
    });
    assert.equal(desconhecido.status, 401);
    assert.equal((await desconhecido.json()).erro, 'USUARIO_DESCONHECIDO');
  } finally {
    await servidor.fechar();
  }
});

test('contrato: participante tentando POST /atividades devolve 403 SOMENTE_ORGANIZACAO', async () => {
  const servidor = await subirServidor();
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const resposta = await fetch(`${servidor.base}/atividades`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Flutter do zero',
        tipo: 'minicurso',
        salaId: 'lab-3',
        vagas: 10,
        encontros: [
          { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T20:00:00-03:00' },
          { inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T20:00:00-03:00' },
        ],
      }),
    });

    assert.equal(resposta.status, 403);
    assert.equal((await resposta.json()).erro, 'SOMENTE_ORGANIZACAO');
  } finally {
    await servidor.fechar();
  }
});