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

test('R1: sem X-Usuario valido, rotas restritas de M4 -> 401 USUARIO_DESCONHECIDO', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const casos = [
      { metodo: 'POST', rota: '/atividades/atv_inexistente/certificado' },
      { metodo: 'GET', rota: '/certificados' },
      { metodo: 'GET', rota: '/extrato' },
    ];

    for (const { metodo, rota } of casos) {
      const semCabecalho = await fetch(`${servidor.base}${rota}`, { method: metodo });
      assert.equal(semCabecalho.status, 401, `${metodo} ${rota} sem cabecalho`);
      assert.equal((await semCabecalho.json()).erro, 'USUARIO_DESCONHECIDO', `${metodo} ${rota} sem cabecalho`);

      const desconhecido = await fetch(`${servidor.base}${rota}`, {
        method: metodo,
        headers: { 'X-Usuario': 'nao-existe' },
      });
      assert.equal(desconhecido.status, 401, `${metodo} ${rota} usuario desconhecido`);
      assert.equal((await desconhecido.json()).erro, 'USUARIO_DESCONHECIDO', `${metodo} ${rota} usuario desconhecido`);
    }
  } finally {
    await servidor.fechar();
  }
});

test('R1: organizacao nas rotas restritas de M4 -> 403 SOMENTE_PARTICIPANTE, antes da existencia', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const casos = [
      { metodo: 'POST', rota: '/atividades/atv_inexistente/certificado' },
      { metodo: 'GET', rota: '/certificados' },
      { metodo: 'GET', rota: '/extrato' },
    ];

    for (const { metodo, rota } of casos) {
      const res = await fetch(`${servidor.base}${rota}`, {
        method: metodo,
        headers: { 'X-Usuario': 'org-ana' },
      });
      assert.equal(res.status, 403, `${metodo} ${rota} como organizacao`);
      assert.equal((await res.json()).erro, 'SOMENTE_PARTICIPANTE', `${metodo} ${rota} como organizacao`);
    }
  } finally {
    await servidor.fechar();
  }
});

test('R1: GET /certificados sem nada emitido -> 200 com lista vazia', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const res = await fetch(`${servidor.base}/certificados`, {
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), []);
  } finally {
    await servidor.fechar();
  }
});

function semearCertificado(banco, { codigo, atividadeId, participanteId, cargaHorariaMinutos, presencas, encontros, emitidoEm }) {
  banco
    .prepare(
      'INSERT INTO certificados (codigo, atividadeId, participanteId, cargaHorariaMinutos, presencas, encontros, emitidoEm) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(codigo, atividadeId, participanteId, cargaHorariaMinutos, presencas, encontros, emitidoEm);
}

test('R1: GET /certificados devolve so os certificados do participante', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    banco
      .prepare('INSERT INTO atividades (id, titulo, tipo, salaId, vagas, cancelada) VALUES (?, ?, ?, ?, ?, 0)')
      .run('atv_iso', 'Flutter do zero', 'minicurso', 'lab-3', 20);
    semearCertificado(banco, {
      codigo: 'SA26-AB2D-EF3H',
      atividadeId: 'atv_iso',
      participanteId: 'p-carla',
      cargaHorariaMinutos: 360,
      presencas: 2,
      encontros: 2,
      emitidoEm: '2026-10-21T10:00:00-03:00',
    });
    semearCertificado(banco, {
      codigo: 'SA26-ZZ9Y-XW8V',
      atividadeId: 'atv_iso',
      participanteId: 'p-diego',
      cargaHorariaMinutos: 360,
      presencas: 2,
      encontros: 2,
      emitidoEm: '2026-10-21T11:00:00-03:00',
    });

    const carla = await fetch(`${servidor.base}/certificados`, {
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(carla.status, 200);
    assert.deepEqual(await carla.json(), [
      {
        codigo: 'SA26-AB2D-EF3H',
        atividadeId: 'atv_iso',
        participanteId: 'p-carla',
        cargaHorariaMinutos: 360,
        presencas: 2,
        encontros: 2,
        emitidoEm: '2026-10-21T10:00:00-03:00',
      },
    ]);

    const diego = await fetch(`${servidor.base}/certificados`, {
      headers: { 'X-Usuario': 'p-diego' },
    });
    assert.equal(diego.status, 200);
    assert.deepEqual(await diego.json(), [
      {
        codigo: 'SA26-ZZ9Y-XW8V',
        atividadeId: 'atv_iso',
        participanteId: 'p-diego',
        cargaHorariaMinutos: 360,
        presencas: 2,
        encontros: 2,
        emitidoEm: '2026-10-21T11:00:00-03:00',
      },
    ]);
  } finally {
    await servidor.fechar();
  }
});

test('R1: GET /certificados/:codigo e publica, sem X-Usuario responde sem 401', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const semCabecalho = await fetch(`${servidor.base}/certificados/SA26-XXXX-YYYY`);
    assert.notEqual(semCabecalho.status, 401, 'rota publica nao exige identificacao');
    assert.equal(semCabecalho.status, 404);
    assert.equal((await semCabecalho.json()).erro, 'NAO_ENCONTRADO');
  } finally {
    await servidor.fechar();
  }
});

test('infra: POST /_teste/reset limpa a tabela certificados', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    banco
      .prepare('INSERT INTO atividades (id, titulo, tipo, salaId, vagas, cancelada) VALUES (?, ?, ?, ?, ?, 0)')
      .run('atv_reset', 'Atividade Reset', 'palestra', 'auditorio', 10);
    semearCertificado(banco, {
      codigo: 'SA26-RR11-RR22',
      atividadeId: 'atv_reset',
      participanteId: 'p-carla',
      cargaHorariaMinutos: 180,
      presencas: 1,
      encontros: 1,
      emitidoEm: '2026-10-21T10:00:00-03:00',
    });

    assert.equal(banco.prepare('SELECT COUNT(*) AS total FROM certificados').get().total, 1);

    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    assert.equal(banco.prepare('SELECT COUNT(*) AS total FROM certificados').get().total, 0);
  } finally {
    await servidor.fechar();
  }
});
