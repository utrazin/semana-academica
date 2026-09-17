import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarServidor } from '../src/app.js';
import { novoBanco } from '../src/banco.js';

process.env.MODO_TESTE = '1';

async function subirServidor(opcoes) {
  const app = criarServidor(opcoes);
  const srv = app.listen(0);
  await new Promise((resolve) => srv.once('listening', resolve));
  return {
    base: `http://127.0.0.1:${srv.address().port}`,
    fechar: () => new Promise((resolve) => srv.close(resolve)),
  };
}

const ROTAS_M3 = [
  { metodo: 'GET', rota: '/encontros/enc_inexistente/codigo' },
  { metodo: 'POST', rota: '/encontros/enc_inexistente/presencas' },
  { metodo: 'POST', rota: '/encontros/enc_inexistente/presencas/manual' },
  { metodo: 'GET', rota: '/encontros/enc_inexistente/presencas' },
];

test('R2: nas quatro rotas de M3, sem X-Usuario valido -> 401 USUARIO_DESCONHECIDO', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    for (const { metodo, rota } of ROTAS_M3) {
      const semCabecalho = await fetch(`${servidor.base}${rota}`, { method: metodo });
      assert.equal(semCabecalho.status, 401, `${metodo} ${rota} sem cabecalho`);
      assert.equal((await semCabecalho.json()).erro, 'USUARIO_DESCONHECIDO', `${metodo} ${rota} sem cabecalho`);

      const usuarioDesconhecido = await fetch(`${servidor.base}${rota}`, {
        method: metodo,
        headers: { 'X-Usuario': 'nao-existe' },
      });
      assert.equal(usuarioDesconhecido.status, 401, `${metodo} ${rota} usuario desconhecido`);
      assert.equal(
        (await usuarioDesconhecido.json()).erro,
        'USUARIO_DESCONHECIDO',
        `${metodo} ${rota} usuario desconhecido`,
      );
    }
  } finally {
    await servidor.fechar();
  }
});

test('R2: perfil trocado nas quatro rotas de M3 -> 403 com o erro do papel, antes da existencia', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const casos = [
      { metodo: 'GET', rota: '/encontros/enc_inexistente/codigo', usuario: 'p-carla', erro: 'SOMENTE_ORGANIZACAO' },
      { metodo: 'POST', rota: '/encontros/enc_inexistente/presencas', usuario: 'org-ana', erro: 'SOMENTE_PARTICIPANTE' },
      { metodo: 'POST', rota: '/encontros/enc_inexistente/presencas/manual', usuario: 'p-carla', erro: 'SOMENTE_ORGANIZACAO' },
      { metodo: 'GET', rota: '/encontros/enc_inexistente/presencas', usuario: 'p-carla', erro: 'SOMENTE_ORGANIZACAO' },
    ];

    for (const { metodo, rota, usuario, erro } of casos) {
      const res = await fetch(`${servidor.base}${rota}`, {
        method: metodo,
        headers: { 'X-Usuario': usuario },
      });
      assert.equal(res.status, 403, `${metodo} ${rota} como ${usuario}`);
      assert.equal((await res.json()).erro, erro, `${metodo} ${rota} como ${usuario}`);
    }
  } finally {
    await servidor.fechar();
  }
});

test('R3: nas quatro rotas de M3, encontro inexistente -> 404 NAO_ENCONTRADO', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const casos = [
      { metodo: 'GET', rota: '/encontros/enc_inexistente/codigo', usuario: 'org-ana' },
      { metodo: 'POST', rota: '/encontros/enc_inexistente/presencas', usuario: 'p-carla' },
      { metodo: 'POST', rota: '/encontros/enc_inexistente/presencas/manual', usuario: 'org-ana' },
      { metodo: 'GET', rota: '/encontros/enc_inexistente/presencas', usuario: 'org-ana' },
    ];

    for (const { metodo, rota, usuario } of casos) {
      const res = await fetch(`${servidor.base}${rota}`, {
        method: metodo,
        headers: { 'X-Usuario': usuario },
      });
      assert.equal(res.status, 404, `${metodo} ${rota}`);
      assert.equal((await res.json()).erro, 'NAO_ENCONTRADO', `${metodo} ${rota}`);
    }
  } finally {
    await servidor.fechar();
  }
});
