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

function semearAtividade(banco, { id, titulo, tipo, salaId, vagas, encontros }) {
  banco
    .prepare('INSERT INTO atividades (id, titulo, tipo, salaId, vagas, cancelada) VALUES (?, ?, ?, ?, ?, 0)')
    .run(id, titulo, tipo, salaId, vagas);
  const inserirEncontro = banco.prepare(
    'INSERT INTO encontros (id, atividadeId, inicio, fim) VALUES (?, ?, ?, ?)',
  );
  for (const encontro of encontros) {
    inserirEncontro.run(encontro.id, id, encontro.inicio, encontro.fim);
  }
}

test('Participante se inscreve em atividade com vagas disponíveis e nasce confirmada', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_00000001',
      titulo: 'Palestra de Abertura',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_00000001', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
      ],
    });

    const resposta = await fetch(`${servidor.base}/atividades/atv_00000001/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });

    assert.equal(resposta.status, 201);
    const inscricao = await resposta.json();
    assert.equal(inscricao.atividadeId, 'atv_00000001');
    assert.equal(inscricao.participanteId, 'p-carla');
    assert.equal(inscricao.status, 'confirmada');
    assert.equal(inscricao.posicaoNaEspera, null);
    assert.ok(inscricao.id.startsWith('ins_'));
    assert.ok(inscricao.criadaEm);
  } finally {
    await servidor.fechar();
  }
});

test('Participante se inscreve em atividade lotada e nasce em_espera com posicaoNaEspera', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_lota',
      titulo: 'Minicurso Lotado',
      tipo: 'minicurso',
      salaId: 'sala-101',
      vagas: 1,
      encontros: [
        { id: 'enc_l1', inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' },
        { id: 'enc_l2', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });

    // Carla gets the 1st (and only) vaga
    const res1 = await fetch(`${servidor.base}/atividades/atv_lota/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res1.status, 201);
    const ins1 = await res1.json();
    assert.equal(ins1.status, 'confirmada');
    assert.equal(ins1.posicaoNaEspera, null);

    // Diego gets em_espera, posicaoNaEspera: 1
    const res2 = await fetch(`${servidor.base}/atividades/atv_lota/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });
    assert.equal(res2.status, 201);
    const ins2 = await res2.json();
    assert.equal(ins2.status, 'em_espera');
    assert.equal(ins2.posicaoNaEspera, 1);

    // Elisa gets em_espera, posicaoNaEspera: 2
    const res3 = await fetch(`${servidor.base}/atividades/atv_lota/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-elisa' },
    });
    assert.equal(res3.status, 201);
    const ins3 = await res3.json();
    assert.equal(ins3.status, 'em_espera');
    assert.equal(ins3.posicaoNaEspera, 2);
  } finally {
    await servidor.fechar();
  }
});

test('GET /inscricoes, privacidade, papeis, JA_INSCRITO e reinscricao pelo fim da fila', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_test',
      titulo: 'Atividade Teste',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 1,
      encontros: [
        { id: 'enc_t1', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
      ],
    });

    // R13: Organização tentando se inscrever responde 403 SOMENTE_PARTICIPANTE
    const orgRes = await fetch(`${servidor.base}/atividades/atv_test/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(orgRes.status, 403);
    assert.equal((await orgRes.json()).erro, 'SOMENTE_PARTICIPANTE');

    // Carla se inscreve (confirmada)
    const carlaRes = await fetch(`${servidor.base}/atividades/atv_test/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(carlaRes.status, 201);
    const carlaIns = await carlaRes.json();
    assert.equal(carlaIns.status, 'confirmada');

    // R14: Tentar se inscrever de novo na mesma atividade ativa dá 409 JA_INSCRITO
    const carlaDuadaRes = await fetch(`${servidor.base}/atividades/atv_test/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(carlaDuadaRes.status, 409);
    assert.equal((await carlaDuadaRes.json()).erro, 'JA_INSCRITO');

    // Diego se inscreve (lotado -> em_espera, posicaoNaEspera: 1)
    const diegoRes = await fetch(`${servidor.base}/atividades/atv_test/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });
    assert.equal(diegoRes.status, 201);
    const diegoIns = await diegoRes.json();
    assert.equal(diegoIns.status, 'em_espera');
    assert.equal(diegoIns.posicaoNaEspera, 1);

    // R12 & R13: GET /inscricoes por participante (Carla vê só a própria)
    const carlaListRes = await fetch(`${servidor.base}/inscricoes`, {
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(carlaListRes.status, 200);
    const carlaList = await carlaListRes.json();
    assert.equal(carlaList.length, 1);
    assert.equal(carlaList[0].participanteId, 'p-carla');

    // GET /inscricoes por organização (Ana vê todas)
    const orgListRes = await fetch(`${servidor.base}/inscricoes`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(orgListRes.status, 200);
    const orgList = await orgListRes.json();
    assert.equal(orgList.length, 2);

    // R12: GET /inscricoes/:id com privacidade (Diego tentando ver a de Carla -> 404)
    const privRes = await fetch(`${servidor.base}/inscricoes/${carlaIns.id}`, {
      headers: { 'X-Usuario': 'p-diego' },
    });
    assert.equal(privRes.status, 404);

    // Carla cancela sua inscrição
    const cancelRes = await fetch(`${servidor.base}/inscricoes/${carlaIns.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(cancelRes.status, 200);

    // Carla se inscreve novamente (reinscrição pelo fim da fila / confirmada já que vaga abriu)
    const carlaReinscricaoRes = await fetch(`${servidor.base}/atividades/atv_test/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(carlaReinscricaoRes.status, 201);
    const carlaReinsc = await carlaReinscricaoRes.json();
    assert.equal(carlaReinsc.status, 'confirmada');
  } finally {
    await servidor.fechar();
  }
});


