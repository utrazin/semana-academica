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

test('R3: GET /salas devolve as 4 salas dos dados iniciais em ordem de nome', async () => {
  const servidor = await subirServidor();
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const resposta = await fetch(`${servidor.base}/salas`, {
      headers: { 'X-Usuario': 'p-carla' },
    });

    assert.equal(resposta.status, 200);
    assert.deepEqual(await resposta.json(), [
      { id: 'auditorio', nome: 'Auditório Central', capacidade: 200 },
      { id: 'lab-3', nome: 'Laboratório 3', capacidade: 20 },
      { id: 'sala-101', nome: 'Sala 101', capacidade: 40 },
      { id: 'sala-102', nome: 'Sala 102', capacidade: 40 },
    ]);
  } finally {
    await servidor.fechar();
  }
});

function semearAtividade(banco, { id, titulo, tipo, salaId, vagas, cancelada = false, encontros }) {
  banco
    .prepare('INSERT INTO atividades (id, titulo, tipo, salaId, vagas, cancelada) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, titulo, tipo, salaId, vagas, cancelada ? 1 : 0);
  const inserirEncontro = banco.prepare(
    'INSERT INTO encontros (id, atividadeId, inicio, fim) VALUES (?, ?, ?, ?)',
  );
  for (const encontro of encontros) {
    inserirEncontro.run(encontro.id, id, encontro.inicio, encontro.fim);
  }
}

function semearGradeDeTeste(banco) {
  semearAtividade(banco, {
    id: 'atv_00000001',
    titulo: 'Zeta de manhã',
    tipo: 'palestra',
    salaId: 'auditorio',
    vagas: 10,
    encontros: [
      { id: 'enc_00000001', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
    ],
  });
  semearAtividade(banco, {
    id: 'atv_00000002',
    titulo: 'Alfa primeiro',
    tipo: 'minicurso',
    salaId: 'sala-101',
    vagas: 20,
    encontros: [
      { id: 'enc_00000002', inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' },
      { id: 'enc_00000003', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
    ],
  });
  semearAtividade(banco, {
    id: 'atv_00000003',
    titulo: 'Bravo empatado',
    tipo: 'palestra',
    salaId: 'lab-3',
    vagas: 5,
    cancelada: true,
    encontros: [
      { id: 'enc_00000004', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
    ],
  });
}

test('R1: GET /atividades devolve todas as atividades, inclusive a cancelada', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearGradeDeTeste(banco);

    const resposta = await fetch(`${servidor.base}/atividades`, {
      headers: { 'X-Usuario': 'p-carla' },
    });

    assert.equal(resposta.status, 200);
    const atividades = await resposta.json();
    assert.deepEqual(
      atividades.map((a) => a.id).sort(),
      ['atv_00000001', 'atv_00000002', 'atv_00000003'],
    );
    const cancelada = atividades.find((a) => a.id === 'atv_00000003');
    assert.equal(cancelada.situacao, 'cancelada');
    assert.equal(cancelada.ocupadas, 0);
    assert.equal(cancelada.emEspera, 0);
    assert.equal(cancelada.vagasRestantes, cancelada.vagas);
  } finally {
    await servidor.fechar();
  }
});

test('R4: ?dia= filtra pelo dia de Brasília do instante, e não pelo texto nem pelo dia em UTC', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearGradeDeTeste(banco);
    semearAtividade(banco, {
      id: 'atv_00000004',
      titulo: 'Depois do expediente',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_00000005', inicio: '2026-10-20T21:00:00-03:00', fim: '2026-10-20T23:00:00-03:00' },
      ],
    });

    const idsDoDia = async (dia) => {
      const resposta = await fetch(`${servidor.base}/atividades?dia=${dia}`, {
        headers: { 'X-Usuario': 'p-carla' },
      });
      assert.equal(resposta.status, 200);
      return (await resposta.json()).map((a) => a.id).sort();
    };

    assert.deepEqual(
      await idsDoDia('2026-10-20'),
      ['atv_00000001', 'atv_00000002', 'atv_00000003', 'atv_00000004'],
    );
    assert.deepEqual(await idsDoDia('2026-10-19'), ['atv_00000002']);
    assert.deepEqual(await idsDoDia('2026-10-21'), []);
  } finally {
    await servidor.fechar();
  }
});

test('R5: ?tipo= diferente de palestra ou minicurso devolve 422 DADOS_INVALIDOS', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearGradeDeTeste(banco);

    const resposta = await fetch(`${servidor.base}/atividades?tipo=oficina`, {
      headers: { 'X-Usuario': 'p-carla' },
    });

    assert.equal(resposta.status, 422);
    const corpo = await resposta.json();
    assert.equal(corpo.erro, 'DADOS_INVALIDOS');
  } finally {
    await servidor.fechar();
  }
});

test('R6: ?dia= e ?tipo= combinam (AND) e canceladas entram no resultado filtrado', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearGradeDeTeste(banco);

    const idsComFiltros = async (query) => {
      const resposta = await fetch(`${servidor.base}/atividades?${query}`, {
        headers: { 'X-Usuario': 'p-carla' },
      });
      assert.equal(resposta.status, 200);
      return (await resposta.json()).map((a) => a.id).sort();
    };

    assert.deepEqual(
      await idsComFiltros('dia=2026-10-20&tipo=palestra'),
      ['atv_00000001', 'atv_00000003'],
    );
    assert.deepEqual(await idsComFiltros('dia=2026-10-20&tipo=minicurso'), ['atv_00000002']);
    assert.deepEqual(await idsComFiltros('dia=2026-10-19&tipo=minicurso'), ['atv_00000002']);
    assert.deepEqual(await idsComFiltros('dia=2026-10-19&tipo=palestra'), []);
  } finally {
    await servidor.fechar();
  }
});

test('R2: GET /atividades ordena pelo início do 1º encontro, empate por título', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearGradeDeTeste(banco);

    const resposta = await fetch(`${servidor.base}/atividades`, {
      headers: { 'X-Usuario': 'p-carla' },
    });

    assert.equal(resposta.status, 200);
    const atividades = await resposta.json();
    assert.deepEqual(
      atividades.map((a) => a.id),
      ['atv_00000002', 'atv_00000003', 'atv_00000001'],
    );
    const encontrosDaAtividade2 = atividades.find((a) => a.id === 'atv_00000002').encontros.map((e) => e.id);
    assert.deepEqual(encontrosDaAtividade2, ['enc_00000002', 'enc_00000003']);
  } finally {
    await servidor.fechar();
  }
});