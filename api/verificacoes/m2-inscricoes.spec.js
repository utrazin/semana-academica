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
    assert.equal(carlaReinsc.status, 'em_espera');
  } finally {
    await servidor.fechar();
  }
});

test('R2: inscricoes fecham 30 minutos antes do 1o encontro (31 min = 201, 30 min ou menos = 422 INSCRICOES_ENCERRADAS)', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_prazo',
      titulo: 'Atividade Prazo',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_p1', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
      ],
    });

    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T18:29:00-03:00' }),
    });

    const res31 = await fetch(`${servidor.base}/atividades/atv_prazo/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res31.status, 201);

    semearAtividade(banco, {
      id: 'atv_prazo_30',
      titulo: 'Atividade Prazo 30',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_p2', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
      ],
    });

    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T18:30:00-03:00' }),
    });

    const res30 = await fetch(`${servidor.base}/atividades/atv_prazo_30/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res30.status, 422);
    assert.equal((await res30.json()).erro, 'INSCRICOES_ENCERRADAS');
  } finally {
    await servidor.fechar();
  }
});

test('R9: cancelar apos o inicio do 1o encontro da 422 ATIVIDADE_JA_INICIADA', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_canc',
      titulo: 'Atividade Cancelavel',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_c1', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
      ],
    });

    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T18:00:00-03:00' }),
    });

    const resIns = await fetch(`${servidor.base}/atividades/atv_canc/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(resIns.status, 201);
    const inscricao = await resIns.json();

    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T19:00:00-03:00' }),
    });

    const resCancel = await fetch(`${servidor.base}/inscricoes/${inscricao.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(resCancel.status, 422);
    assert.equal((await resCancel.json()).erro, 'ATIVIDADE_JA_INICIADA');
  } finally {
    await servidor.fechar();
  }
});

test('R9 & R10: cancelar inscricao ja cancelada da 422 INSCRICAO_INATIVA, verificada antes de ATIVIDADE_JA_INICIADA', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_inativa',
      titulo: 'Atividade Inativa Teste',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_i1', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
      ],
    });

    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T18:00:00-03:00' }),
    });

    const resIns = await fetch(`${servidor.base}/atividades/atv_inativa/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(resIns.status, 201);
    const inscricao = await resIns.json();

    const resCancel1 = await fetch(`${servidor.base}/inscricoes/${inscricao.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(resCancel1.status, 200);

    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T19:30:00-03:00' }),
    });

    const resCancel2 = await fetch(`${servidor.base}/inscricoes/${inscricao.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(resCancel2.status, 422);
    assert.equal((await resCancel2.json()).erro, 'INSCRICAO_INATIVA');
  } finally {
    await servidor.fechar();
  }
});

test('R6: participante com vaga ocupada tenta se inscrever em atividade com encontro sobreposto da 409 CONFLITO_DE_HORARIO', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_a',
      titulo: 'Atividade A',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_a1', inicio: '2026-10-20T14:00:00-03:00', fim: '2026-10-20T17:00:00-03:00' },
      ],
    });
    semearAtividade(banco, {
      id: 'atv_b',
      titulo: 'Atividade B',
      tipo: 'palestra',
      salaId: 'sala-101',
      vagas: 10,
      encontros: [
        { id: 'enc_b1', inicio: '2026-10-20T16:00:00-03:00', fim: '2026-10-20T19:00:00-03:00' },
      ],
    });

    const res1 = await fetch(`${servidor.base}/atividades/atv_a/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res1.status, 201);

    const res2 = await fetch(`${servidor.base}/atividades/atv_b/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res2.status, 409);
    assert.equal((await res2.json()).erro, 'CONFLITO_DE_HORARIO');
  } finally {
    await servidor.fechar();
  }
});

test('R6: encostar (fim = inicio) nao conflita -> 201', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_a1',
      titulo: 'Atividade A1',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_aa1', inicio: '2026-10-20T14:00:00-03:00', fim: '2026-10-20T17:00:00-03:00' },
      ],
    });
    semearAtividade(banco, {
      id: 'atv_a2',
      titulo: 'Atividade A2',
      tipo: 'palestra',
      salaId: 'sala-101',
      vagas: 10,
      encontros: [
        { id: 'enc_aa2', inicio: '2026-10-20T17:00:00-03:00', fim: '2026-10-20T19:00:00-03:00' },
      ],
    });

    const res1 = await fetch(`${servidor.base}/atividades/atv_a1/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res1.status, 201);

    const res2 = await fetch(`${servidor.base}/atividades/atv_a2/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res2.status, 201);
  } finally {
    await servidor.fechar();
  }
});

test('R6: quem esta so em_espera nao e verificado para conflito -> 201', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_lotada',
      titulo: 'Atividade Lotada',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 1,
      encontros: [
        { id: 'enc_l', inicio: '2026-10-20T14:00:00-03:00', fim: '2026-10-20T17:00:00-03:00' },
      ],
    });
    semearAtividade(banco, {
      id: 'atv_sobre',
      titulo: 'Atividade Sobreposta',
      tipo: 'palestra',
      salaId: 'sala-101',
      vagas: 10,
      encontros: [
        { id: 'enc_s', inicio: '2026-10-20T15:00:00-03:00', fim: '2026-10-20T18:00:00-03:00' },
      ],
    });

    // Carla takes the only vaga in atv_lotada
    const resCarla = await fetch(`${servidor.base}/atividades/atv_lotada/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(resCarla.status, 201);

    // Diego gets em_espera in atv_lotada
    const resDiegoEspera = await fetch(`${servidor.base}/atividades/atv_lotada/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });
    assert.equal(resDiegoEspera.status, 201);
    assert.equal((await resDiegoEspera.json()).status, 'em_espera');

    // Diego registers for atv_sobre (overlapping). Since Diego is only em_espera in atv_lotada, atv_sobre should succeed (201).
    const resDiegoSobre = await fetch(`${servidor.base}/atividades/atv_sobre/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });
    assert.equal(resDiegoSobre.status, 201);
  } finally {
    await servidor.fechar();
  }
});

test('R7: participante com 3 minicursos ocupando vaga tenta se inscrever num 4o minicurso -> 422 LIMITE_DE_MINICURSOS; palestras e espera nao contam', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    
    // Semear 3 minicursos (m1, m2, m3) em horários diferentes
    semearAtividade(banco, {
      id: 'm_1',
      titulo: 'Minicurso 1',
      tipo: 'minicurso',
      salaId: 'sala-101',
      vagas: 10,
      encontros: [
        { id: 'en_m1_1', inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T12:00:00-03:00' },
        { id: 'en_m1_2', inicio: '2026-10-21T10:00:00-03:00', fim: '2026-10-21T12:00:00-03:00' },
      ],
    });
    semearAtividade(banco, {
      id: 'm_2',
      titulo: 'Minicurso 2',
      tipo: 'minicurso',
      salaId: 'sala-101',
      vagas: 10,
      encontros: [
        { id: 'en_m2_1', inicio: '2026-10-20T14:00:00-03:00', fim: '2026-10-20T16:00:00-03:00' },
        { id: 'en_m2_2', inicio: '2026-10-21T14:00:00-03:00', fim: '2026-10-21T16:00:00-03:00' },
      ],
    });
    semearAtividade(banco, {
      id: 'm_3',
      titulo: 'Minicurso 3',
      tipo: 'minicurso',
      salaId: 'sala-101',
      vagas: 10,
      encontros: [
        { id: 'en_m3_1', inicio: '2026-10-22T10:00:00-03:00', fim: '2026-10-22T12:00:00-03:00' },
        { id: 'en_m3_2', inicio: '2026-10-23T10:00:00-03:00', fim: '2026-10-23T12:00:00-03:00' },
      ],
    });
    // Um 4o minicurso (m_4)
    semearAtividade(banco, {
      id: 'm_4',
      titulo: 'Minicurso 4',
      tipo: 'minicurso',
      salaId: 'sala-101',
      vagas: 10,
      encontros: [
        { id: 'en_m4_1', inicio: '2026-10-22T14:00:00-03:00', fim: '2026-10-22T16:00:00-03:00' },
        { id: 'en_m4_2', inicio: '2026-10-23T14:00:00-03:00', fim: '2026-10-23T16:00:00-03:00' },
      ],
    });
    // Uma palestra (palestra_1) no mesmo horário do 4o ou outro
    semearAtividade(banco, {
      id: 'p_1',
      titulo: 'Palestra 1',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'en_p1_1', inicio: '2026-10-24T10:00:00-03:00', fim: '2026-10-24T12:00:00-03:00' },
      ],
    });

    // Inscreve em m_1, m_2, m_3
    for (const id of ['m_1', 'm_2', 'm_3', 'p_1']) {
      const res = await fetch(`${servidor.base}/atividades/${id}/inscricoes`, {
        method: 'POST',
        headers: { 'X-Usuario': 'p-carla' },
      });
      assert.equal(res.status, 201);
    }

    // Tentar o 4o minicurso (m_4) -> 422 LIMITE_DE_MINICURSOS
    const resM4 = await fetch(`${servidor.base}/atividades/m_4/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(resM4.status, 422);
    assert.equal((await resM4.json()).erro, 'LIMITE_DE_MINICURSOS');
  } finally {
    await servidor.fechar();
  }
});

test('R8: ordem de precedencia - JA_INSCRITO vence CONFLITO_DE_HORARIO quando ambos se aplicam', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_ordem',
      titulo: 'Atividade Ordem',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_o1', inicio: '2026-10-20T14:00:00-03:00', fim: '2026-10-20T17:00:00-03:00' },
      ],
    });

    // Carla se inscreve em atv_ordem
    const res1 = await fetch(`${servidor.base}/atividades/atv_ordem/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res1.status, 201);

    // Carla tenta se inscrever de novo em atv_ordem (já está inscrita e tem conflito consigo mesma se contado)
    const res2 = await fetch(`${servidor.base}/atividades/atv_ordem/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res2.status, 409);
    assert.equal((await res2.json()).erro, 'JA_INSCRITO');
  } finally {
    await servidor.fechar();
  }
});

test('Cancelar confirmada convoca o 1o da espera com convocadaAte = liberacao + 2h', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_conv',
      titulo: 'Atividade Convocacao',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 1,
      encontros: [
        { id: 'enc_c1', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
      ],
    });

    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });

    // Carla gets confirmed
    const resCarla = await fetch(`${servidor.base}/atividades/atv_conv/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(resCarla.status, 201);
    const carlaIns = await resCarla.json();

    // Diego gets em_espera
    const resDiego = await fetch(`${servidor.base}/atividades/atv_conv/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });
    assert.equal(resDiego.status, 201);
    const diegoIns = await resDiego.json();
    assert.equal(diegoIns.status, 'em_espera');

    // Carla cancels at 10:30
    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T10:30:00-03:00' }),
    });

    const resCancel = await fetch(`${servidor.base}/inscricoes/${carlaIns.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(resCancel.status, 200);

    // Check Diego's subscription
    const resDiegoCheck = await fetch(`${servidor.base}/inscricoes/${diegoIns.id}`, {
      headers: { 'X-Usuario': 'p-diego' },
    });
    assert.equal(resDiegoCheck.status, 200);
    const diegoAtualizado = await resDiegoCheck.json();
    assert.equal(diegoAtualizado.status, 'convocada');
    assert.equal(diegoAtualizado.convocadaAte, '2026-10-20T12:30:00-03:00');
  } finally {
    await servidor.fechar();
  }
});

test('Prazo limitado ao fecho: liberacao perto do fecho -> convocadaAte = fecho, nao +2h', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_fecho',
      titulo: 'Atividade Fecho',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 1,
      encontros: [
        { id: 'enc_f1', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
      ],
    }); // fecho = 18:30:00-03:00

    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });

    const resCarla = await fetch(`${servidor.base}/atividades/atv_fecho/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    const carlaIns = await resCarla.json();

    const resDiego = await fetch(`${servidor.base}/atividades/atv_fecho/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });
    const diegoIns = await resDiego.json();

    // Cancel at 18:00 (liberacao 18:00 + 2h = 20:00, but fecho is 18:30)
    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T18:00:00-03:00' }),
    });

    await fetch(`${servidor.base}/inscricoes/${carlaIns.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });

    const resDiegoCheck = await fetch(`${servidor.base}/inscricoes/${diegoIns.id}`, {
      headers: { 'X-Usuario': 'p-diego' },
    });
    const diegoAtualizado = await resDiegoCheck.json();
    assert.equal(diegoAtualizado.status, 'convocada');
    assert.equal(diegoAtualizado.convocadaAte, '2026-10-20T18:30:00-03:00');
  } finally {
    await servidor.fechar();
  }
});

test('Vaga liberada apos o fecho -> ninguem convocado', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_posfecho',
      titulo: 'Atividade Pos Fecho',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 1,
      encontros: [
        { id: 'enc_pf1', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
      ],
    }); // fecho = 18:30:00-03:00

    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });

    const resCarla = await fetch(`${servidor.base}/atividades/atv_posfecho/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    const carlaIns = await resCarla.json();

    const resDiego = await fetch(`${servidor.base}/atividades/atv_posfecho/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });
    const diegoIns = await resDiego.json();

    // Cancel at 18:35 (after fecho 18:30)
    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T18:35:00-03:00' }),
    });

    await fetch(`${servidor.base}/inscricoes/${carlaIns.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });

    const resDiegoCheck = await fetch(`${servidor.base}/inscricoes/${diegoIns.id}`, {
      headers: { 'X-Usuario': 'p-diego' },
    });
    const diegoAtualizado = await resDiegoCheck.json();
    assert.equal(diegoAtualizado.status, 'em_espera');
    assert.equal(diegoAtualizado.convocadaAte, null);
  } finally {
    await servidor.fechar();
  }
});

test('Cascata com relogio pulando: atividade com 1 vaga, Carla confirmada, fila Diego, Elisa, Fabio; fecho distante. Carla cancela as 10:00 -> Diego convocado ate 12:00. O relogio pula direto para 15:00 sem nenhum acesso. Numa leitura em 15:00: Diego expirada (venceu 12:00), Elisa convocada 12:00 e expirada 14:00, Fabio convocado ate 16:00. Verifique os status e o convocadaAte de Fabio', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_cascata',
      titulo: 'Atividade Cascata',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 1,
      encontros: [
        { id: 'enc_casc1', inicio: '2026-10-25T19:00:00-03:00', fim: '2026-10-25T20:00:00-03:00' },
      ],
    }); // fecho distant

    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T09:00:00-03:00' }),
    });

    const carlaRes = await fetch(`${servidor.base}/atividades/atv_cascata/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    const carlaIns = await carlaRes.json();

    const diegoRes = await fetch(`${servidor.base}/atividades/atv_cascata/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });
    const diegoIns = await diegoRes.json();

    const elisaRes = await fetch(`${servidor.base}/atividades/atv_cascata/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-elisa' },
    });
    const elisaIns = await elisaRes.json();

    const fabioRes = await fetch(`${servidor.base}/atividades/atv_cascata/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-fabio' },
    });
    const fabioIns = await fabioRes.json();

    // Carla cancels at 10:00
    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });

    await fetch(`${servidor.base}/inscricoes/${carlaIns.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });

    // Clock jumps straight to 15:00 without access
    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T15:00:00-03:00' }),
    });

    // Read at 15:00 (via GET /inscricoes as organization 'org-ana')
    const listRes = await fetch(`${servidor.base}/inscricoes?atividadeId=atv_cascata`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(listRes.status, 200);
    const list = await listRes.json();

    const diego = list.find(i => i.id === diegoIns.id);
    const elisa = list.find(i => i.id === elisaIns.id);
    const fabio = list.find(i => i.id === fabioIns.id);

    assert.equal(diego.status, 'expirada');
    assert.equal(elisa.status, 'expirada');
    assert.equal(fabio.status, 'convocada');
    assert.equal(fabio.convocadaAte, '2026-10-20T16:00:00-03:00');
  } finally {
    await servidor.fechar();
  }
});

test('1. Convocada confirma no prazo -> 200 confirmada, convocadaAte null', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_conf1',
      titulo: 'Atividade Conf 1',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 1,
      encontros: [
        { id: 'enc_cf1', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
      ],
    });

    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });

    const resCarla = await fetch(`${servidor.base}/atividades/atv_conf1/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    const carlaIns = await resCarla.json();

    const resDiego = await fetch(`${servidor.base}/atividades/atv_conf1/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });
    const diegoIns = await resDiego.json();

    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T10:30:00-03:00' }),
    });

    await fetch(`${servidor.base}/inscricoes/${carlaIns.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });

    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T11:00:00-03:00' }),
    });

    const resConf = await fetch(`${servidor.base}/inscricoes/${diegoIns.id}/confirmacao`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });

    assert.equal(resConf.status, 200);
    const confIns = await resConf.json();
    assert.equal(confIns.status, 'confirmada');
    assert.equal(confIns.convocadaAte, null);
  } finally {
    await servidor.fechar();
  }
});

test('2. Confirmar inscricao nao convocada -> 422 SEM_CONVOCACAO', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_conf2',
      titulo: 'Atividade Conf 2',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 1,
      encontros: [
        { id: 'enc_cf2', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
      ],
    });

    const resCarla = await fetch(`${servidor.base}/atividades/atv_conf2/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    const carlaIns = await resCarla.json();
    assert.equal(carlaIns.status, 'confirmada');

    const resConf = await fetch(`${servidor.base}/inscricoes/${carlaIns.id}/confirmacao`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });

    assert.equal(resConf.status, 422);
    assert.equal((await resConf.json()).erro, 'SEM_CONVOCACAO');
  } finally {
    await servidor.fechar();
  }
});

test('3. Confirmar apos o prazo -> 422 CONVOCACAO_EXPIRADA', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_conf3',
      titulo: 'Atividade Conf 3',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 1,
      encontros: [
        { id: 'enc_cf3', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
      ],
    });

    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });

    const resCarla = await fetch(`${servidor.base}/atividades/atv_conf3/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    const carlaIns = await resCarla.json();

    const resDiego = await fetch(`${servidor.base}/atividades/atv_conf3/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });
    const diegoIns = await resDiego.json();

    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T10:30:00-03:00' }),
    });

    await fetch(`${servidor.base}/inscricoes/${carlaIns.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });

    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T12:35:00-03:00' }),
    });

    const resConf = await fetch(`${servidor.base}/inscricoes/${diegoIns.id}/confirmacao`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });

    assert.equal(resConf.status, 422);
    assert.equal((await resConf.json()).erro, 'CONVOCACAO_EXPIRADA');
  } finally {
    await servidor.fechar();
  }
});

test('4. Confirmacao com limite de minicursos estourado -> 422 LIMITE_DE_MINICURSOS, e a inscricao continua convocada; apos liberar espaco, confirma com sucesso', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    semearAtividade(banco, {
      id: 'm_a',
      titulo: 'Minicurso A',
      tipo: 'minicurso',
      salaId: 'sala-101',
      vagas: 10,
      encontros: [
        { id: 'enc_ma1', inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T12:00:00-03:00' },
        { id: 'enc_ma2', inicio: '2026-10-21T10:00:00-03:00', fim: '2026-10-21T12:00:00-03:00' },
      ],
    });
    semearAtividade(banco, {
      id: 'm_b',
      titulo: 'Minicurso B',
      tipo: 'minicurso',
      salaId: 'sala-101',
      vagas: 10,
      encontros: [
        { id: 'enc_mb1', inicio: '2026-10-20T14:00:00-03:00', fim: '2026-10-20T16:00:00-03:00' },
        { id: 'enc_mb2', inicio: '2026-10-21T14:00:00-03:00', fim: '2026-10-21T16:00:00-03:00' },
      ],
    });
    semearAtividade(banco, {
      id: 'm_c',
      titulo: 'Minicurso C',
      tipo: 'minicurso',
      salaId: 'sala-101',
      vagas: 10,
      encontros: [
        { id: 'enc_mc1', inicio: '2026-10-22T10:00:00-03:00', fim: '2026-10-22T12:00:00-03:00' },
        { id: 'enc_mc2', inicio: '2026-10-23T10:00:00-03:00', fim: '2026-10-23T12:00:00-03:00' },
      ],
    });
    semearAtividade(banco, {
      id: 'm_d',
      titulo: 'Minicurso D',
      tipo: 'minicurso',
      salaId: 'sala-101',
      vagas: 1,
      encontros: [
        { id: 'enc_md1', inicio: '2026-10-22T14:00:00-03:00', fim: '2026-10-22T16:00:00-03:00' },
        { id: 'enc_md2', inicio: '2026-10-23T14:00:00-03:00', fim: '2026-10-23T16:00:00-03:00' },
      ],
    });

    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T08:00:00-03:00' }),
    });

    const resDiegoMd = await fetch(`${servidor.base}/atividades/m_d/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });
    assert.equal(resDiegoMd.status, 201);

    const resCarlaMd = await fetch(`${servidor.base}/atividades/m_d/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    const carlaMdIns = await resCarlaMd.json();
    assert.equal(carlaMdIns.status, 'em_espera');

    for (const id of ['m_a', 'm_b', 'm_c']) {
      const res = await fetch(`${servidor.base}/atividades/${id}/inscricoes`, {
        method: 'POST',
        headers: { 'X-Usuario': 'p-carla' },
      });
      assert.equal(res.status, 201);
    }

    const resCancelDiego = await fetch(`${servidor.base}/inscricoes/${(await (await fetch(`${servidor.base}/inscricoes?atividadeId=m_d`, { headers: { 'X-Usuario': 'org-ana' } })).json()).find(i => i.participanteId === 'p-diego').id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });
    assert.equal(resCancelDiego.status, 200);

    const resCarlaMdCheck = await fetch(`${servidor.base}/inscricoes/${carlaMdIns.id}`, {
      headers: { 'X-Usuario': 'p-carla' },
    });
    const carlaMdAtualizada = await resCarlaMdCheck.json();
    assert.equal(carlaMdAtualizada.status, 'convocada');

    const resConfLimit = await fetch(`${servidor.base}/inscricoes/${carlaMdIns.id}/confirmacao`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(resConfLimit.status, 422);
    assert.equal((await resConfLimit.json()).erro, 'LIMITE_DE_MINICURSOS');

    const resCheckAgain = await fetch(`${servidor.base}/inscricoes/${carlaMdIns.id}`, {
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal((await resCheckAgain.json()).status, 'convocada');

    const carlaList = await (await fetch(`${servidor.base}/inscricoes`, { headers: { 'X-Usuario': 'p-carla' } })).json();
    const maIns = carlaList.find(i => i.atividadeId === 'm_a');
    const resCancelMa = await fetch(`${servidor.base}/inscricoes/${maIns.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(resCancelMa.status, 200);

    const resConfSuccess = await fetch(`${servidor.base}/inscricoes/${carlaMdIns.id}/confirmacao`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(resConfSuccess.status, 200);
    const finalIns = await resConfSuccess.json();
    assert.equal(finalIns.status, 'confirmada');
    assert.equal(finalIns.convocadaAte, null);
  } finally {
    await servidor.fechar();
  }
});

test('1. Atividade com inscricoes confirmada, em_espera e convocada e cancelada pela organizacao -> todas passam a cancelada', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r11_1',
      titulo: 'Atividade R11 1',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 1,
      encontros: [
        { id: 'enc_r11_1', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
      ],
    });

    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });

    const resCarla = await fetch(`${servidor.base}/atividades/atv_r11_1/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    const carlaIns = await resCarla.json();
    assert.equal(carlaIns.status, 'confirmada');

    const resDiego = await fetch(`${servidor.base}/atividades/atv_r11_1/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });
    const diegoIns = await resDiego.json();
    assert.equal(diegoIns.status, 'em_espera');

    const resElisa = await fetch(`${servidor.base}/atividades/atv_r11_1/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-elisa' },
    });
    const elisaIns = await resElisa.json();
    assert.equal(elisaIns.status, 'em_espera');

    await fetch(`${servidor.base}/inscricoes/${carlaIns.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    const diegoCheck = await (await fetch(`${servidor.base}/inscricoes/${diegoIns.id}`, { headers: { 'X-Usuario': 'p-diego' } })).json();
    assert.equal(diegoCheck.status, 'convocada');

    const resCancAtv = await fetch(`${servidor.base}/atividades/atv_r11_1/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(resCancAtv.status, 200);

    const listRes = await fetch(`${servidor.base}/inscricoes?atividadeId=atv_r11_1`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(listRes.status, 200);
    const inscricoes = await listRes.json();

    const carla = inscricoes.find(i => i.id === carlaIns.id);
    const diego = inscricoes.find(i => i.id === diegoIns.id);
    const elisa = inscricoes.find(i => i.id === elisaIns.id);

    assert.equal(carla.status, 'cancelada');
    assert.equal(diego.status, 'cancelada');
    assert.equal(elisa.status, 'cancelada');
  } finally {
    await servidor.fechar();
  }
});

test('2. Uma inscricao que ja estava cancelada antes do cancelamento da atividade permanece cancelada (nao gera erro nem efeito duplicado)', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r11_2',
      titulo: 'Atividade R11 2',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_r11_2', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
      ],
    });

    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });

    const resCarla = await fetch(`${servidor.base}/atividades/atv_r11_2/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    const carlaIns = await resCarla.json();
    assert.equal(carlaIns.status, 'confirmada');

    const resCancel = await fetch(`${servidor.base}/inscricoes/${carlaIns.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(resCancel.status, 200);
    const carlaCancelled = await resCancel.json();
    assert.equal(carlaCancelled.status, 'cancelada');

    const resCancAtv = await fetch(`${servidor.base}/atividades/atv_r11_2/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(resCancAtv.status, 200);

    const resCheck = await fetch(`${servidor.base}/inscricoes/${carlaIns.id}`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(resCheck.status, 200);
    const carlaFinal = await resCheck.json();
    assert.equal(carlaFinal.status, 'cancelada');
  } finally {
    await servidor.fechar();
  }
});

test('R8: atividade inexistente -> 404 NAO_ENCONTRADO', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    const res = await fetch(`${servidor.base}/atividades/atv_inexistente/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res.status, 404);
    assert.equal((await res.json()).erro, 'NAO_ENCONTRADO');
  } finally {
    await servidor.fechar();
  }
});

test('R8: atividade cancelada -> 422 ATIVIDADE_CANCELADA vence INSCRICOES_ENCERRADAS', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_canc_vence',
      titulo: 'Atividade Cancelada Vence',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_cv1', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
      ],
    });

    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });

    await fetch(`${servidor.base}/atividades/atv_canc_vence/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'org-ana' },
    });

    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T18:40:00-03:00' }),
    });

    const res = await fetch(`${servidor.base}/atividades/atv_canc_vence/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res.status, 422);
    assert.equal((await res.json()).erro, 'ATIVIDADE_CANCELADA');
  } finally {
    await servidor.fechar();
  }
});

test('R8: inscricoes encerradas -> 422 INSCRICOES_ENCERRADAS vence JA_INSCRITO e CONFLITO_DE_HORARIO', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_fechada',
      titulo: 'Atividade Fechada',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_fc1', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
      ],
    });
    semearAtividade(banco, {
      id: 'atv_conflito',
      titulo: 'Atividade Conflito',
      tipo: 'palestra',
      salaId: 'sala-101',
      vagas: 10,
      encontros: [
        { id: 'enc_cf1', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
      ],
    });

    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });

    const resIns = await fetch(`${servidor.base}/atividades/atv_fechada/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(resIns.status, 201);

    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T18:40:00-03:00' }),
    });

    const resJaInscrito = await fetch(`${servidor.base}/atividades/atv_fechada/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(resJaInscrito.status, 422);
    assert.equal((await resJaInscrito.json()).erro, 'INSCRICOES_ENCERRADAS');

    const resConflito = await fetch(`${servidor.base}/atividades/atv_conflito/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(resConflito.status, 422);
    assert.equal((await resConflito.json()).erro, 'INSCRICOES_ENCERRADAS');
  } finally {
    await servidor.fechar();
  }
});

test('R12: POST /inscricoes/:id/cancelamento de inscricao de outro participante -> 404 NAO_ENCONTRADO', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r12_canc',
      titulo: 'Atividade R12 Canc',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_r12c1', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
      ],
    });

    const resCarla = await fetch(`${servidor.base}/atividades/atv_r12_canc/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    const carlaIns = await resCarla.json();

    const resDiego = await fetch(`${servidor.base}/inscricoes/${carlaIns.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });
    assert.equal(resDiego.status, 404);
    assert.equal((await resDiego.json()).erro, 'NAO_ENCONTRADO');
  } finally {
    await servidor.fechar();
  }
});

test('R12: POST /inscricoes/:id/confirmacao de inscricao de outro participante -> 404 NAO_ENCONTRADO', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r12_conf',
      titulo: 'Atividade R12 Conf',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 1,
      encontros: [
        { id: 'enc_r12f1', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
      ],
    });

    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });

    const resCarla = await fetch(`${servidor.base}/atividades/atv_r12_conf/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    const carlaIns = await resCarla.json();

    const resDiegoIns = await fetch(`${servidor.base}/atividades/atv_r12_conf/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });
    const diegoIns = await resDiegoIns.json();

    await fetch(`${servidor.base}/inscricoes/${carlaIns.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });

    const resElisa = await fetch(`${servidor.base}/inscricoes/${diegoIns.id}/confirmacao`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-elisa' },
    });
    assert.equal(resElisa.status, 404);
    assert.equal((await resElisa.json()).erro, 'NAO_ENCONTRADO');
  } finally {
    await servidor.fechar();
  }
});

test('R13: organizacao tentando POST /inscricoes/:id/cancelamento -> 403 SOMENTE_PARTICIPANTE', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r13_canc',
      titulo: 'Atividade R13 Canc',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_r13c1', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
      ],
    });

    const resCarla = await fetch(`${servidor.base}/atividades/atv_r13_canc/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    const carlaIns = await resCarla.json();

    const resOrg = await fetch(`${servidor.base}/inscricoes/${carlaIns.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(resOrg.status, 403);
    assert.equal((await resOrg.json()).erro, 'SOMENTE_PARTICIPANTE');
  } finally {
    await servidor.fechar();
  }
});

test('R13: organizacao tentando POST /inscricoes/:id/confirmacao -> 403 SOMENTE_PARTICIPANTE', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r13_conf',
      titulo: 'Atividade R13 Conf',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 1,
      encontros: [
        { id: 'enc_r13f1', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
      ],
    });

    await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });

    const resCarla = await fetch(`${servidor.base}/atividades/atv_r13_conf/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    const carlaIns = await resCarla.json();

    const resDiegoIns = await fetch(`${servidor.base}/atividades/atv_r13_conf/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });
    const diegoIns = await resDiegoIns.json();

    await fetch(`${servidor.base}/inscricoes/${carlaIns.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });

    const resOrg = await fetch(`${servidor.base}/inscricoes/${diegoIns.id}/confirmacao`, {
      method: 'POST',
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(resOrg.status, 403);
    assert.equal((await resOrg.json()).erro, 'SOMENTE_PARTICIPANTE');
  } finally {
    await servidor.fechar();
  }
});










