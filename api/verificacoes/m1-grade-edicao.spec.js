import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarServidor } from '../src/app.js';
import { novoBanco } from '../src/banco.js';
import { contarVagasOcupadas } from '../src/contagem.js';

process.env.MODO_TESTE = '1';

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

async function patchAtividade(servidor, id, corpo) {
  return fetch(`${servidor.base}/atividades/${id}`, {
    method: 'PATCH',
    headers: { 'X-Usuario': 'org-ana', 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
}

test('R15: PATCH recusa qualquer outro campo do contrato alem de titulo e vagas com 422 CAMPO_NAO_EDITAVEL', async () => {
  const servidor = await subirServidor();
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const criar = await postAtividade(servidor, {
      titulo: 'Flutter do zero',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 10,
      encontros: [
        { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T20:00:00-03:00' },
        { inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T20:00:00-03:00' },
      ],
    });
    assert.equal(criar.status, 201);
    const criada = await criar.json();

    for (const corpo of [{ salaId: 'sala-101' }, { tipo: 'palestra' }, { encontros: [] }]) {
      const resposta = await patchAtividade(servidor, criada.id, corpo);
      assert.equal(resposta.status, 422, `campo ${Object.keys(corpo)[0]}`);
      assert.equal((await resposta.json()).erro, 'CAMPO_NAO_EDITAVEL');
    }
  } finally {
    await servidor.fechar();
  }
});

test('R16: enviar campo nao editavel com valor identico ao atual tambem da 422 CAMPO_NAO_EDITAVEL', async () => {
  const servidor = await subirServidor();
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const criar = await postAtividade(servidor, {
      titulo: 'Flutter do zero',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 10,
      encontros: [
        { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T20:00:00-03:00' },
        { inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T20:00:00-03:00' },
      ],
    });
    assert.equal(criar.status, 201);
    const criada = await criar.json();

    const resposta = await patchAtividade(servidor, criada.id, {
      tipo: 'minicurso',
      salaId: 'lab-3',
    });
    assert.equal(resposta.status, 422);
    assert.equal((await resposta.json()).erro, 'CAMPO_NAO_EDITAVEL');
  } finally {
    await servidor.fechar();
  }
});

test('R17: corpo vazio da 422 DADOS_INVALIDOS e corpo so com campos nao editaveis da 422 CAMPO_NAO_EDITAVEL', async () => {
  const servidor = await subirServidor();
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const criar = await postAtividade(servidor, {
      titulo: 'Flutter do zero',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 10,
      encontros: [
        { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T20:00:00-03:00' },
        { inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T20:00:00-03:00' },
      ],
    });
    assert.equal(criar.status, 201);
    const criada = await criar.json();

    const vazio = await patchAtividade(servidor, criada.id, {});
    assert.equal(vazio.status, 422);
    assert.equal((await vazio.json()).erro, 'DADOS_INVALIDOS');

    const soNaoEditavel = await patchAtividade(servidor, criada.id, { tipo: 'minicurso' });
    assert.equal(soNaoEditavel.status, 422);
    assert.equal((await soNaoEditavel.json()).erro, 'CAMPO_NAO_EDITAVEL');
  } finally {
    await servidor.fechar();
  }
});

test('R18: PATCH com campo que nao existe no contrato da 422 DADOS_INVALIDOS (esquema estrito)', async () => {
  const servidor = await subirServidor();
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const criar = await postAtividade(servidor, {
      titulo: 'Flutter do zero',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 10,
      encontros: [
        { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T20:00:00-03:00' },
        { inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T20:00:00-03:00' },
      ],
    });
    assert.equal(criar.status, 201);
    const criada = await criar.json();

    const resposta = await patchAtividade(servidor, criada.id, { duracao: 60 });
    assert.equal(resposta.status, 422);
    assert.equal((await resposta.json()).erro, 'DADOS_INVALIDOS');
  } finally {
    await servidor.fechar();
  }
});

test('R18: POST com campo que nao existe no contrato da 422 DADOS_INVALIDOS (esquema estrito)', async () => {
  const servidor = await subirServidor();
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const resposta = await postAtividade(servidor, {
      titulo: 'Flutter do zero',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 10,
      encontros: [
        { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T20:00:00-03:00' },
        { inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T20:00:00-03:00' },
      ],
      duracao: 60,
    });
    assert.equal(resposta.status, 422);
    assert.equal((await resposta.json()).erro, 'DADOS_INVALIDOS');
  } finally {
    await servidor.fechar();
  }
});

async function levarRelogio(servidor, agora) {
  const resposta = await fetch(`${servidor.base}/_teste/relogio`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agora }),
  });
  assert.equal(resposta.status, 200);
}

test('R19: titulo e vagas sao editaveis em prevista, em_andamento e encerrada, devolvendo 200 com os novos valores', async () => {
  const servidor = await subirServidor();
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const criar = await postAtividade(servidor, {
      titulo: 'Flutter do zero',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 10,
      encontros: [
        { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T20:00:00-03:00' },
        { inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T20:00:00-03:00' },
      ],
    });
    assert.equal(criar.status, 201);
    const criada = await criar.json();

    for (const [agora, situacaoEsperada] of [
      ['2026-10-13T09:00:00-03:00', 'prevista'],
      ['2026-10-19T20:30:00-03:00', 'em_andamento'],
      ['2026-10-21T20:00:00-03:00', 'encerrada'],
    ]) {
      await levarRelogio(servidor, agora);
      const resposta = await patchAtividade(servidor, criada.id, {
        titulo: `Novo titulo ${situacaoEsperada}`,
        vagas: 7,
      });
      assert.equal(resposta.status, 200, `relogio em ${agora}`);
      const editada = await resposta.json();
      assert.equal(editada.titulo, `Novo titulo ${situacaoEsperada}`);
      assert.equal(editada.vagas, 7);
      assert.equal(editada.situacao, situacaoEsperada);
      assert.equal(editada.vagasRestantes, 7);
    }
  } finally {
    await servidor.fechar();
  }
});

test('R20: a contagem de vagas ocupadas soma apenas confirmadas + convocadas; a espera nao entra', () => {
  assert.equal(contarVagasOcupadas([]), 0);
  assert.equal(
    contarVagasOcupadas([
      { status: 'confirmada' },
      { status: 'convocada' },
      { status: 'em_espera' },
      { status: 'em_espera' },
      { status: 'cancelada' },
      { status: 'expirada' },
    ]),
    2,
  );
});

test('R21: PATCH em atividade cancelada da 422 ATIVIDADE_CANCELADA', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_00000001',
      titulo: 'Cancelada',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 10,
      cancelada: true,
      encontros: [
        { id: 'enc_00000001', inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T20:00:00-03:00' },
        { id: 'enc_00000002', inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T20:00:00-03:00' },
      ],
    });

    const resposta = await patchAtividade(servidor, 'atv_00000001', { titulo: 'Novo' });
    assert.equal(resposta.status, 422);
    assert.equal((await resposta.json()).erro, 'ATIVIDADE_CANCELADA');
  } finally {
    await servidor.fechar();
  }
});

test('R22: no PATCH vale a primeira recusa na ordem ATIVIDADE_CANCELADA, CAMPO_NAO_EDITAVEL, VAGAS_ACIMA_DA_CAPACIDADE', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_00000001',
      titulo: 'Ativa',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 10,
      encontros: [
        { id: 'enc_00000001', inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T20:00:00-03:00' },
        { id: 'enc_00000002', inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T20:00:00-03:00' },
      ],
    });
    semearAtividade(banco, {
      id: 'atv_00000002',
      titulo: 'Cancelada',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 10,
      cancelada: true,
      encontros: [
        { id: 'enc_00000003', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
        { id: 'enc_00000004', inicio: '2026-10-22T19:00:00-03:00', fim: '2026-10-22T20:00:00-03:00' },
      ],
    });

    const vagaNaoEditavel = await patchAtividade(servidor, 'atv_00000001', {
      tipo: 'palestra',
      vagas: 999,
    });
    assert.equal(vagaNaoEditavel.status, 422);
    assert.equal((await vagaNaoEditavel.json()).erro, 'CAMPO_NAO_EDITAVEL');

    const acimaDaCapacidade = await patchAtividade(servidor, 'atv_00000001', { vagas: 999 });
    assert.equal(acimaDaCapacidade.status, 422);
    assert.equal((await acimaDaCapacidade.json()).erro, 'VAGAS_ACIMA_DA_CAPACIDADE');

    const vagaForaDoDominio = await patchAtividade(servidor, 'atv_00000001', { vagas: 0 });
    assert.equal(vagaForaDoDominio.status, 422);
    assert.equal((await vagaForaDoDominio.json()).erro, 'DADOS_INVALIDOS');

    const canceladaComNaoEditavel = await patchAtividade(servidor, 'atv_00000002', {
      tipo: 'palestra',
      titulo: 'Novo',
    });
    assert.equal(canceladaComNaoEditavel.status, 422);
    assert.equal((await canceladaComNaoEditavel.json()).erro, 'ATIVIDADE_CANCELADA');
  } finally {
    await servidor.fechar();
  }
});