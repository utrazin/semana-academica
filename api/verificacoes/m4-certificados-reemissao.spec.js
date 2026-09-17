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

function semearAtividade(banco, { id, titulo = 'Atividade', tipo = 'palestra', salaId = 'auditorio', vagas = 20, cancelada = 0, encontros }) {
  banco
    .prepare('INSERT INTO atividades (id, titulo, tipo, salaId, vagas, cancelada) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, titulo, tipo, salaId, vagas, cancelada);
  const inserir = banco.prepare('INSERT INTO encontros (id, atividadeId, inicio, fim) VALUES (?, ?, ?, ?)');
  for (const e of encontros) inserir.run(e.id, id, e.inicio, e.fim);
}

function semearInscricao(banco, { id, atividadeId, participanteId, status }) {
  banco
    .prepare('INSERT INTO inscricoes (id, atividadeId, participanteId, status, posicaoNaEspera, convocadaAte, criadaEm) VALUES (?, ?, ?, ?, NULL, NULL, ?)')
    .run(id, atividadeId, participanteId, status, '2026-10-13T09:00:00-03:00');
}

function semearPresenca(banco, { id, encontroId, participanteId, origem = 'qr' }) {
  banco
    .prepare('INSERT INTO presencas (id, encontroId, participanteId, origem, lidoEm, registradaEm, justificativa) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, encontroId, participanteId, origem, '2026-10-20T19:00:00-03:00', '2026-10-20T19:00:00-03:00', origem === 'manual' ? 'justificativa manual longa' : null);
}

async function fixarRelogio(base, agora) {
  await fetch(`${base}/_teste/relogio`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agora }),
  });
}

test('R7: primeira emissao 201, repeticao 200 com o mesmo objeto completo', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r7_rep',
      titulo: 'Palestra R7',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 20,
      encontros: [{ id: 'enc_r7_rep', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }],
    });
    semearInscricao(banco, { id: 'ins_r7_rep', atividadeId: 'atv_r7_rep', participanteId: 'p-carla', status: 'confirmada' });
    semearPresenca(banco, { id: 'pre_r7_rep', encontroId: 'enc_r7_rep', participanteId: 'p-carla' });
    await fixarRelogio(servidor.base, '2026-10-20T20:00:00-03:00');

    const primeira = await fetch(`${servidor.base}/atividades/atv_r7_rep/certificado`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(primeira.status, 201);
    const corpo1 = await primeira.json();
    assert.deepEqual(Object.keys(corpo1).sort(), ['atividadeId', 'cargaHorariaMinutos', 'codigo', 'emitidoEm', 'encontros', 'participanteId', 'presencas']);

    const segunda = await fetch(`${servidor.base}/atividades/atv_r7_rep/certificado`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(segunda.status, 200);
    const corpo2 = await segunda.json();
    assert.deepEqual(corpo2, corpo1);
  } finally {
    await servidor.fechar();
  }
});

test('R7: avancar o relogio entre solicitacoes nao muda codigo nem emitidoEm', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r7_rel',
      titulo: 'Palestra R7 Relogio',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 20,
      encontros: [{ id: 'enc_r7_rel', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }],
    });
    semearInscricao(banco, { id: 'ins_r7_rel', atividadeId: 'atv_r7_rel', participanteId: 'p-carla', status: 'confirmada' });
    semearPresenca(banco, { id: 'pre_r7_rel', encontroId: 'enc_r7_rel', participanteId: 'p-carla' });
    await fixarRelogio(servidor.base, '2026-10-20T20:00:00-03:00');

    const primeira = await fetch(`${servidor.base}/atividades/atv_r7_rel/certificado`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(primeira.status, 201);
    const corpo1 = await primeira.json();

    await fixarRelogio(servidor.base, '2026-10-25T10:00:00-03:00');

    const segunda = await fetch(`${servidor.base}/atividades/atv_r7_rel/certificado`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(segunda.status, 200);
    const corpo2 = await segunda.json();
    assert.deepEqual(corpo2, corpo1);
    assert.equal(corpo2.codigo, corpo1.codigo);
    assert.equal(Date.parse(corpo2.emitidoEm), Date.parse('2026-10-20T20:00:00-03:00'));
  } finally {
    await servidor.fechar();
  }
});

test('R7: repeticoes nao acrescentam certificados a listagem', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r7_list',
      titulo: 'Palestra R7 Lista',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 20,
      encontros: [{ id: 'enc_r7_list', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }],
    });
    semearInscricao(banco, { id: 'ins_r7_list', atividadeId: 'atv_r7_list', participanteId: 'p-carla', status: 'confirmada' });
    semearPresenca(banco, { id: 'pre_r7_list', encontroId: 'enc_r7_list', participanteId: 'p-carla' });
    await fixarRelogio(servidor.base, '2026-10-20T20:00:00-03:00');

    const primeira = await fetch(`${servidor.base}/atividades/atv_r7_list/certificado`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(primeira.status, 201);
    const corpo1 = await primeira.json();

    for (let i = 0; i < 2; i += 1) {
      const repeticao = await fetch(`${servidor.base}/atividades/atv_r7_list/certificado`, {
        method: 'POST',
        headers: { 'X-Usuario': 'p-carla' },
      });
      assert.equal(repeticao.status, 200);
      assert.deepEqual(await repeticao.json(), corpo1);
    }

    const lista = await fetch(`${servidor.base}/certificados`, {
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(lista.status, 200);
    assert.deepEqual(await lista.json(), [corpo1]);
  } finally {
    await servidor.fechar();
  }
});

test('R8/R9: participantes diferentes e atividades diferentes recebem codigos distintos', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r8_a',
      titulo: 'Palestra A',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 20,
      encontros: [{ id: 'enc_r8_a', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }],
    });
    semearAtividade(banco, {
      id: 'atv_r8_b',
      titulo: 'Palestra B',
      tipo: 'palestra',
      salaId: 'sala-101',
      vagas: 20,
      encontros: [{ id: 'enc_r8_b', inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T20:00:00-03:00' }],
    });
    semearInscricao(banco, { id: 'ins_r8_a_carla', atividadeId: 'atv_r8_a', participanteId: 'p-carla', status: 'confirmada' });
    semearInscricao(banco, { id: 'ins_r8_a_diego', atividadeId: 'atv_r8_a', participanteId: 'p-diego', status: 'confirmada' });
    semearInscricao(banco, { id: 'ins_r8_b_carla', atividadeId: 'atv_r8_b', participanteId: 'p-carla', status: 'confirmada' });
    semearPresenca(banco, { id: 'pre_r8_a_carla', encontroId: 'enc_r8_a', participanteId: 'p-carla' });
    semearPresenca(banco, { id: 'pre_r8_a_diego', encontroId: 'enc_r8_a', participanteId: 'p-diego' });
    semearPresenca(banco, { id: 'pre_r8_b_carla', encontroId: 'enc_r8_b', participanteId: 'p-carla' });
    await fixarRelogio(servidor.base, '2026-10-21T20:00:00-03:00');

    const carlaA = await (await fetch(`${servidor.base}/atividades/atv_r8_a/certificado`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    })).json();
    const diegoA = await (await fetch(`${servidor.base}/atividades/atv_r8_a/certificado`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    })).json();
    const carlaB = await (await fetch(`${servidor.base}/atividades/atv_r8_b/certificado`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    })).json();

    assert.notEqual(carlaA.codigo, diegoA.codigo, 'participantes diferentes nao compartilham codigo');
    assert.notEqual(carlaA.codigo, carlaB.codigo, 'atividades diferentes nao compartilham codigo');
    assert.notEqual(diegoA.codigo, carlaB.codigo);
    assert.equal(new Set([carlaA.codigo, diegoA.codigo, carlaB.codigo]).size, 3);
  } finally {
    await servidor.fechar();
  }
});

test('R8: todos os codigos cumprem exatamente formato e alfabeto contratados', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r8_fmt',
      titulo: 'Palestra Formato',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 20,
      encontros: [{ id: 'enc_r8_fmt', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }],
    });
    semearInscricao(banco, { id: 'ins_r8_fmt_carla', atividadeId: 'atv_r8_fmt', participanteId: 'p-carla', status: 'confirmada' });
    semearInscricao(banco, { id: 'ins_r8_fmt_diego', atividadeId: 'atv_r8_fmt', participanteId: 'p-diego', status: 'confirmada' });
    semearPresenca(banco, { id: 'pre_r8_fmt_carla', encontroId: 'enc_r8_fmt', participanteId: 'p-carla' });
    semearPresenca(banco, { id: 'pre_r8_fmt_diego', encontroId: 'enc_r8_fmt', participanteId: 'p-diego' });
    await fixarRelogio(servidor.base, '2026-10-20T20:00:00-03:00');

    const codigos = [];
    for (const usuario of ['p-carla', 'p-diego']) {
      const res = await fetch(`${servidor.base}/atividades/atv_r8_fmt/certificado`, {
        method: 'POST',
        headers: { 'X-Usuario': usuario },
      });
      assert.equal(res.status, 201);
      const corpo = await res.json();
      codigos.push(corpo.codigo);
      assert.match(corpo.codigo, /^SA26-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
      assert.ok(!/[01OI]/.test(corpo.codigo.slice(5)), 'alfabeto sem 0, O, 1, I na parte variavel');
      assert.equal(corpo.codigo.length, 14);
    }
    assert.notEqual(codigos[0], codigos[1]);
  } finally {
    await servidor.fechar();
  }
});

test('R7/R9: solicitacoes simultaneas para o mesmo participante e atividade resultam em uma unica emissao', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r7_conc',
      titulo: 'Palestra Concorrencia',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 20,
      encontros: [{ id: 'enc_r7_conc', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }],
    });
    semearInscricao(banco, { id: 'ins_r7_conc', atividadeId: 'atv_r7_conc', participanteId: 'p-carla', status: 'confirmada' });
    semearPresenca(banco, { id: 'pre_r7_conc', encontroId: 'enc_r7_conc', participanteId: 'p-carla' });
    await fixarRelogio(servidor.base, '2026-10-20T20:00:00-03:00');

    const respostas = await Promise.all(
      Array.from({ length: 5 }, () => fetch(`${servidor.base}/atividades/atv_r7_conc/certificado`, {
        method: 'POST',
        headers: { 'X-Usuario': 'p-carla' },
      })),
    );
    const status = respostas.map((r) => r.status);
    const corpos = await Promise.all(respostas.map((r) => r.json()));

    assert.equal(status.filter((s) => s === 201).length, 1, `esperava exatamente um 201, obteve ${JSON.stringify(status)}`);
    assert.equal(status.filter((s) => s === 200).length, 4, `esperava quatro 200, obteve ${JSON.stringify(status)}`);
    for (const corpo of corpos) {
      assert.deepEqual(corpo, corpos[0]);
    }

    const lista = await fetch(`${servidor.base}/certificados`, {
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(lista.status, 200);
    assert.deepEqual(await lista.json(), [corpos[0]]);
  } finally {
    await servidor.fechar();
  }
});
