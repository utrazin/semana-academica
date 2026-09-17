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

async function postAtividade(servidor, corpo) {
  return fetch(`${servidor.base}/atividades`, {
    method: 'POST',
    headers: { 'X-Usuario': 'org-ana', 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
}

async function cancelarAtividade(servidor, id) {
  return fetch(`${servidor.base}/atividades/${id}/cancelamento`, {
    method: 'POST',
    headers: { 'X-Usuario': 'org-ana' },
  });
}

async function patchAtividade(servidor, id, corpo) {
  return fetch(`${servidor.base}/atividades/${id}`, {
    method: 'PATCH',
    headers: { 'X-Usuario': 'org-ana', 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
}

async function listarAtividades(servidor) {
  const resposta = await fetch(`${servidor.base}/atividades`, {
    headers: { 'X-Usuario': 'p-carla' },
  });
  assert.equal(resposta.status, 200);
  return resposta.json();
}

async function levarRelogio(servidor, agora) {
  const resposta = await fetch(`${servidor.base}/_teste/relogio`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agora }),
  });
  assert.equal(resposta.status, 200);
}

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

async function criarMinicurso(servidor, inicioPrimeiro) {
  const resposta = await postAtividade(servidor, {
    titulo: 'Minicurso cancelavel',
    tipo: 'minicurso',
    salaId: 'lab-3',
    vagas: 10,
    encontros: [
      { inicio: inicioPrimeiro, fim: '2026-10-20T20:00:00-03:00' },
      { inicio: '2026-10-22T19:00:00-03:00', fim: '2026-10-22T20:00:00-03:00' },
    ],
  });
  assert.equal(resposta.status, 201);
  return resposta.json();
}

test('R23: cancela antes do inicio do 1o encontro e recusa com ATIVIDADE_JA_INICIADA do inicio em diante, mesmo com encontro futuro', async () => {
  const servidor = await subirServidor();
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    await levarRelogio(servidor, '2026-10-20T18:59:00-03:00');
    const antes = await criarMinicurso(servidor, '2026-10-20T19:00:00-03:00');
    const cancelamento = await cancelarAtividade(servidor, antes.id);
    assert.equal(cancelamento.status, 200);
    const cancelada = await cancelamento.json();
    assert.equal(cancelada.id, antes.id);
    assert.equal(cancelada.situacao, 'cancelada');
    assert.equal(cancelada.ocupadas, 0);
    assert.equal(cancelada.vagasRestantes, 10);
    assert.equal(cancelada.emEspera, 0);

    await levarRelogio(servidor, '2026-10-20T19:00:00-03:00');
    const noInicio = await criarMinicurso(servidor, '2026-10-20T19:00:00-03:00');
    const recusa = await cancelarAtividade(servidor, noInicio.id);
    assert.equal(recusa.status, 422);
    assert.equal((await recusa.json()).erro, 'ATIVIDADE_JA_INICIADA');
  } finally {
    await servidor.fechar();
  }
});

test('R24: cancelamento e definitivo e irreversivel, sem rota que restaure a atividade', async () => {
  const servidor = await subirServidor();
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    await levarRelogio(servidor, '2026-10-20T18:59:00-03:00');
    const atividade = await criarMinicurso(servidor, '2026-10-20T19:00:00-03:00');
    const cancelamento = await cancelarAtividade(servidor, atividade.id);
    assert.equal(cancelamento.status, 200);
    assert.equal((await cancelamento.json()).situacao, 'cancelada');

    const tentativa = await patchAtividade(servidor, atividade.id, { titulo: 'Tentativa de reverter' });
    assert.equal(tentativa.status, 422);
    assert.equal((await tentativa.json()).erro, 'ATIVIDADE_CANCELADA');

    const relida = (await listarAtividades(servidor)).find((a) => a.id === atividade.id);
    assert.equal(relida.situacao, 'cancelada');
    assert.equal(relida.titulo, 'Minicurso cancelavel');
  } finally {
    await servidor.fechar();
  }
});

test('R25: cancelar uma atividade ja cancelada devolve 422 ATIVIDADE_CANCELADA', async () => {
  const servidor = await subirServidor();
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    await levarRelogio(servidor, '2026-10-20T18:59:00-03:00');
    const atividade = await criarMinicurso(servidor, '2026-10-20T19:00:00-03:00');
    const primeiro = await cancelarAtividade(servidor, atividade.id);
    assert.equal(primeiro.status, 200);
    assert.equal((await primeiro.json()).situacao, 'cancelada');

    const segundo = await cancelarAtividade(servidor, atividade.id);
    assert.equal(segundo.status, 422);
    assert.equal((await segundo.json()).erro, 'ATIVIDADE_CANCELADA');
  } finally {
    await servidor.fechar();
  }
});

test('R26: no cancelamento, ATIVIDADE_CANCELADA e verificada antes de ATIVIDADE_JA_INICIADA', async () => {
  const servidor = await subirServidor();
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    await levarRelogio(servidor, '2026-10-20T18:59:00-03:00');
    const atividade = await criarMinicurso(servidor, '2026-10-20T19:00:00-03:00');
    assert.equal((await cancelarAtividade(servidor, atividade.id)).status, 200);

    await levarRelogio(servidor, '2026-10-21T12:00:00-03:00');
    const recusa = await cancelarAtividade(servidor, atividade.id);
    assert.equal(recusa.status, 422);
    assert.equal((await recusa.json()).erro, 'ATIVIDADE_CANCELADA');
  } finally {
    await servidor.fechar();
  }
});

test('GET /atividades/:id devolve a resposta completa em ordem de inicio e 404 para inexistente', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_00000001',
      titulo: 'Grade completa',
      tipo: 'minicurso',
      salaId: 'sala-101',
      vagas: 20,
      encontros: [
        { id: 'enc_00000002', inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T22:00:00-03:00' },
        { id: 'enc_00000001', inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' },
      ],
    });

    const resposta = await fetch(`${servidor.base}/atividades/atv_00000001`, {
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(resposta.status, 200);
    assert.deepEqual(await resposta.json(), {
      id: 'atv_00000001',
      titulo: 'Grade completa',
      tipo: 'minicurso',
      salaId: 'sala-101',
      vagas: 20,
      encontros: [
        { id: 'enc_00000001', inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' },
        { id: 'enc_00000002', inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T22:00:00-03:00' },
      ],
      cargaHorariaMinutos: 360,
      situacao: 'prevista',
      ocupadas: 0,
      vagasRestantes: 20,
      emEspera: 0,
    });

    const inexistente = await fetch(`${servidor.base}/atividades/atv_nao_existe`, {
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(inexistente.status, 404);
    assert.equal((await inexistente.json()).erro, 'NAO_ENCONTRADO');
  } finally {
    await servidor.fechar();
  }
});
