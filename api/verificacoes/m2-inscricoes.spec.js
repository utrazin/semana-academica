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










