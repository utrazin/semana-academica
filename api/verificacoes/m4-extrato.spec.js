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

test('R12/R13: extrato vazio — itens [] e todos os totais iguais a zero', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    const res = await fetch(`${servidor.base}/extrato`, {
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      itens: [],
      palestrasMinutos: 0,
      minicursosMinutos: 0,
      totalMinutos: 0,
      aproveitadoMinutos: 0,
    });
  } finally {
    await servidor.fechar();
  }
});

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

test('R12: exclui canceladas, nao encerradas, inscricao nao confirmada e frequencia insuficiente; so do participante', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    // elegível da carla (palestra 60 min)
    semearAtividade(banco, { id: 'atv_ok', titulo: 'OK', tipo: 'palestra', salaId: 'auditorio', vagas: 20, encontros: [{ id: 'enc_ok', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }] });
    semearInscricao(banco, { id: 'ins_ok', atividadeId: 'atv_ok', participanteId: 'p-carla', status: 'confirmada' });
    semearPresenca(banco, { id: 'pre_ok', encontroId: 'enc_ok', participanteId: 'p-carla' });
    // cancelada (mesmo elegível por presença/inscrição, deve sair)
    semearAtividade(banco, { id: 'atv_canc', titulo: 'Cancelada', tipo: 'palestra', salaId: 'sala-101', vagas: 20, cancelada: 1, encontros: [{ id: 'enc_canc', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }] });
    semearInscricao(banco, { id: 'ins_canc', atividadeId: 'atv_canc', participanteId: 'p-carla', status: 'confirmada' });
    semearPresenca(banco, { id: 'pre_canc', encontroId: 'enc_canc', participanteId: 'p-carla' });
    // não encerrada (termina 23/10 22h, relógio em 22/10 21h)
    semearAtividade(banco, { id: 'atv_aberta', titulo: 'Aberta', tipo: 'palestra', salaId: 'sala-102', vagas: 20, encontros: [{ id: 'enc_aberta', inicio: '2026-10-23T19:00:00-03:00', fim: '2026-10-23T22:00:00-03:00' }] });
    semearInscricao(banco, { id: 'ins_aberta', atividadeId: 'atv_aberta', participanteId: 'p-carla', status: 'confirmada' });
    semearPresenca(banco, { id: 'pre_aberta', encontroId: 'enc_aberta', participanteId: 'p-carla' });
    // inscrição não confirmada (em_espera) com presença mesmo assim
    semearAtividade(banco, { id: 'atv_espera', titulo: 'Espera', tipo: 'palestra', salaId: 'lab-3', vagas: 20, encontros: [{ id: 'enc_espera', inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T20:00:00-03:00' }] });
    semearInscricao(banco, { id: 'ins_espera', atividadeId: 'atv_espera', participanteId: 'p-carla', status: 'em_espera' });
    semearPresenca(banco, { id: 'pre_espera', encontroId: 'enc_espera', participanteId: 'p-carla' });
    // frequência insuficiente: minicurso 4 encontros de 60 min, só 2 presenças
    semearAtividade(banco, {
      id: 'atv_freq', titulo: 'Freq', tipo: 'minicurso', salaId: 'lab-3', vagas: 20,
      encontros: [
        { id: 'enc_freq1', inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T20:00:00-03:00' },
        { id: 'enc_freq2', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
        { id: 'enc_freq3', inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T20:00:00-03:00' },
        { id: 'enc_freq4', inicio: '2026-10-22T19:00:00-03:00', fim: '2026-10-22T20:00:00-03:00' },
      ],
    });
    semearInscricao(banco, { id: 'ins_freq', atividadeId: 'atv_freq', participanteId: 'p-carla', status: 'confirmada' });
    semearPresenca(banco, { id: 'pre_freq1', encontroId: 'enc_freq1', participanteId: 'p-carla' });
    semearPresenca(banco, { id: 'pre_freq2', encontroId: 'enc_freq2', participanteId: 'p-carla' });
    // elegível só do diego (não pode vazar para a carla)
    semearAtividade(banco, { id: 'atv_diego', titulo: 'Diego', tipo: 'palestra', salaId: 'auditorio', vagas: 20, encontros: [{ id: 'enc_diego', inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T11:00:00-03:00' }] });
    semearInscricao(banco, { id: 'ins_diego', atividadeId: 'atv_diego', participanteId: 'p-diego', status: 'confirmada' });
    semearPresenca(banco, { id: 'pre_diego', encontroId: 'enc_diego', participanteId: 'p-diego' });
    await fixarRelogio(servidor.base, '2026-10-22T21:00:00-03:00');
    const res = await fetch(`${servidor.base}/extrato`, { headers: { 'X-Usuario': 'p-carla' } });
    assert.equal(res.status, 200);
    const corpo = await res.json();
    assert.deepEqual(corpo.itens.map((i) => i.atividadeId).sort(), ['atv_ok']);
    assert.equal(corpo.palestrasMinutos, 60);
    assert.equal(corpo.minicursosMinutos, 0);
    // diego vê só a dele
    const diego = await fetch(`${servidor.base}/extrato`, { headers: { 'X-Usuario': 'p-diego' } });
    assert.deepEqual((await diego.json()).itens.map((i) => i.atividadeId).sort(), ['atv_diego']);
  } finally {
    await servidor.fechar();
  }
});

test('R13: usa carga integral com 3 de 4 presencas (4x180=720, nao 540)', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_int', titulo: 'Integral', tipo: 'minicurso', salaId: 'lab-3', vagas: 20,
      encontros: [
        { id: 'enc_int1', inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' },
        { id: 'enc_int2', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
        { id: 'enc_int3', inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T22:00:00-03:00' },
        { id: 'enc_int4', inicio: '2026-10-22T19:00:00-03:00', fim: '2026-10-22T22:00:00-03:00' },
      ],
    });
    semearInscricao(banco, { id: 'ins_int', atividadeId: 'atv_int', participanteId: 'p-carla', status: 'confirmada' });
    semearPresenca(banco, { id: 'pre_int1', encontroId: 'enc_int1', participanteId: 'p-carla' });
    semearPresenca(banco, { id: 'pre_int2', encontroId: 'enc_int2', participanteId: 'p-carla' });
    semearPresenca(banco, { id: 'pre_int3', encontroId: 'enc_int3', participanteId: 'p-carla' });
    await fixarRelogio(servidor.base, '2026-10-22T22:00:00-03:00');
    const res = await fetch(`${servidor.base}/extrato`, { headers: { 'X-Usuario': 'p-carla' } });
    assert.equal(res.status, 200);
    const corpo = await res.json();
    assert.equal(corpo.itens.length, 1);
    assert.equal(corpo.itens[0].cargaHorariaMinutos, 720);
    assert.equal(corpo.minicursosMinutos, 720);
    assert.equal(corpo.totalMinutos, 720);
  } finally {
    await servidor.fechar();
  }
});

test('R13: cenario com teto — 2 palestras (180+120=300) + minicurso 5x200=1000 => total 1300, aproveitado 1200', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, { id: 'atv_pal1', titulo: 'Pal 180', tipo: 'palestra', salaId: 'auditorio', vagas: 20, encontros: [{ id: 'enc_pal1', inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' }] });
    semearAtividade(banco, { id: 'atv_pal2', titulo: 'Pal 120', tipo: 'palestra', salaId: 'sala-101', vagas: 20, encontros: [{ id: 'enc_pal2', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T21:00:00-03:00' }] });
    semearAtividade(banco, {
      id: 'atv_mini', titulo: 'Mini 1000', tipo: 'minicurso', salaId: 'lab-3', vagas: 20,
      encontros: [
        { id: 'enc_mini1', inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T13:20:00-03:00' },
        { id: 'enc_mini2', inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T13:20:00-03:00' },
        { id: 'enc_mini3', inicio: '2026-10-21T10:00:00-03:00', fim: '2026-10-21T13:20:00-03:00' },
        { id: 'enc_mini4', inicio: '2026-10-22T10:00:00-03:00', fim: '2026-10-22T13:20:00-03:00' },
        { id: 'enc_mini5', inicio: '2026-10-23T10:00:00-03:00', fim: '2026-10-23T13:20:00-03:00' },
      ],
    });
    for (const [insId, atvId] of [['ins_pal1', 'atv_pal1'], ['ins_pal2', 'atv_pal2'], ['ins_mini', 'atv_mini']]) {
      semearInscricao(banco, { id: insId, atividadeId: atvId, participanteId: 'p-carla', status: 'confirmada' });
    }
    semearPresenca(banco, { id: 'pre_pal1', encontroId: 'enc_pal1', participanteId: 'p-carla' });
    semearPresenca(banco, { id: 'pre_pal2', encontroId: 'enc_pal2', participanteId: 'p-carla' });
    for (let i = 1; i <= 5; i += 1) semearPresenca(banco, { id: `pre_mini${i}`, encontroId: `enc_mini${i}`, participanteId: 'p-carla' });
    await fixarRelogio(servidor.base, '2026-10-23T13:20:00-03:00');
    const res = await fetch(`${servidor.base}/extrato`, { headers: { 'X-Usuario': 'p-carla' } });
    assert.equal(res.status, 200);
    const corpo = await res.json();
    assert.equal(corpo.palestrasMinutos, 300);
    assert.equal(corpo.minicursosMinutos, 1000);
    assert.equal(corpo.totalMinutos, 1300);
    assert.equal(corpo.aproveitadoMinutos, 1200);
  } finally {
    await servidor.fechar();
  }
});

test('R13: cenario sem corte — palestra 120 + minicurso 2x60=120 => 120/120/240/240', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, { id: 'atv_sc_pal', titulo: 'Pal 120', tipo: 'palestra', salaId: 'auditorio', vagas: 20, encontros: [{ id: 'enc_sc_pal', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T21:00:00-03:00' }] });
    semearAtividade(banco, {
      id: 'atv_sc_mini', titulo: 'Mini 120', tipo: 'minicurso', salaId: 'lab-3', vagas: 20,
      encontros: [
        { id: 'enc_sc_m1', inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T20:00:00-03:00' },
        { id: 'enc_sc_m2', inicio: '2026-10-22T19:00:00-03:00', fim: '2026-10-22T20:00:00-03:00' },
      ],
    });
    semearInscricao(banco, { id: 'ins_sc_pal', atividadeId: 'atv_sc_pal', participanteId: 'p-carla', status: 'confirmada' });
    semearInscricao(banco, { id: 'ins_sc_mini', atividadeId: 'atv_sc_mini', participanteId: 'p-carla', status: 'confirmada' });
    semearPresenca(banco, { id: 'pre_sc_pal', encontroId: 'enc_sc_pal', participanteId: 'p-carla' });
    semearPresenca(banco, { id: 'pre_sc_m1', encontroId: 'enc_sc_m1', participanteId: 'p-carla' });
    semearPresenca(banco, { id: 'pre_sc_m2', encontroId: 'enc_sc_m2', participanteId: 'p-carla' });
    await fixarRelogio(servidor.base, '2026-10-22T20:00:00-03:00');
    const res = await fetch(`${servidor.base}/extrato`, { headers: { 'X-Usuario': 'p-carla' } });
    assert.equal(res.status, 200);
    const corpo = await res.json();
    assert.deepEqual([...corpo.itens].sort((a, b) => a.atividadeId.localeCompare(b.atividadeId)), [
      { atividadeId: 'atv_sc_mini', titulo: 'Mini 120', tipo: 'minicurso', cargaHorariaMinutos: 120, codigo: null },
      { atividadeId: 'atv_sc_pal', titulo: 'Pal 120', tipo: 'palestra', cargaHorariaMinutos: 120, codigo: null },
    ]);
    assert.equal(corpo.palestrasMinutos, 120);
    assert.equal(corpo.minicursosMinutos, 120);
    assert.equal(corpo.totalMinutos, 240);
    assert.equal(corpo.aproveitadoMinutos, 240);
    assert.deepEqual(Object.keys(corpo).sort(), ['aproveitadoMinutos', 'itens', 'minicursosMinutos', 'palestrasMinutos', 'totalMinutos']);
  } finally {
    await servidor.fechar();
  }
});

test('R13: teto de palestras isolado — 300 min de palestras sem minicurso => aproveitado 240, brutos intactos', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, { id: 'atv_tp1', titulo: 'TP 180', tipo: 'palestra', salaId: 'auditorio', vagas: 20, encontros: [{ id: 'enc_tp1', inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' }] });
    semearAtividade(banco, { id: 'atv_tp2', titulo: 'TP 120', tipo: 'palestra', salaId: 'sala-101', vagas: 20, encontros: [{ id: 'enc_tp2', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T21:00:00-03:00' }] });
    semearInscricao(banco, { id: 'ins_tp1', atividadeId: 'atv_tp1', participanteId: 'p-carla', status: 'confirmada' });
    semearInscricao(banco, { id: 'ins_tp2', atividadeId: 'atv_tp2', participanteId: 'p-carla', status: 'confirmada' });
    semearPresenca(banco, { id: 'pre_tp1', encontroId: 'enc_tp1', participanteId: 'p-carla' });
    semearPresenca(banco, { id: 'pre_tp2', encontroId: 'enc_tp2', participanteId: 'p-carla' });
    await fixarRelogio(servidor.base, '2026-10-20T21:00:00-03:00');
    const res = await fetch(`${servidor.base}/extrato`, { headers: { 'X-Usuario': 'p-carla' } });
    const corpo = await res.json();
    assert.equal(corpo.palestrasMinutos, 300);
    assert.equal(corpo.minicursosMinutos, 0);
    assert.equal(corpo.totalMinutos, 300);
    assert.equal(corpo.aproveitadoMinutos, 240);
  } finally {
    await servidor.fechar();
  }
});

test('R13: teto geral isolado — palestra 120 + minicurso 5x240=1200 => total 1320, aproveitado 1200', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, { id: 'atv_tg_pal', titulo: 'TG Pal', tipo: 'palestra', salaId: 'auditorio', vagas: 20, encontros: [{ id: 'enc_tg_pal', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T21:00:00-03:00' }] });
    semearAtividade(banco, {
      id: 'atv_tg_mini', titulo: 'TG Mini', tipo: 'minicurso', salaId: 'lab-3', vagas: 20,
      encontros: [
        { id: 'enc_tg1', inicio: '2026-10-19T08:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' },
        { id: 'enc_tg2', inicio: '2026-10-20T08:00:00-03:00', fim: '2026-10-20T12:00:00-03:00' },
        { id: 'enc_tg3', inicio: '2026-10-21T08:00:00-03:00', fim: '2026-10-21T12:00:00-03:00' },
        { id: 'enc_tg4', inicio: '2026-10-22T08:00:00-03:00', fim: '2026-10-22T12:00:00-03:00' },
        { id: 'enc_tg5', inicio: '2026-10-23T08:00:00-03:00', fim: '2026-10-23T12:00:00-03:00' },
      ],
    });
    semearInscricao(banco, { id: 'ins_tg_pal', atividadeId: 'atv_tg_pal', participanteId: 'p-carla', status: 'confirmada' });
    semearInscricao(banco, { id: 'ins_tg_mini', atividadeId: 'atv_tg_mini', participanteId: 'p-carla', status: 'confirmada' });
    semearPresenca(banco, { id: 'pre_tg_pal', encontroId: 'enc_tg_pal', participanteId: 'p-carla' });
    for (let i = 1; i <= 5; i += 1) semearPresenca(banco, { id: `pre_tg${i}`, encontroId: `enc_tg${i}`, participanteId: 'p-carla' });
    await fixarRelogio(servidor.base, '2026-10-23T12:00:00-03:00');
    const corpo = await (await fetch(`${servidor.base}/extrato`, { headers: { 'X-Usuario': 'p-carla' } })).json();
    assert.equal(corpo.palestrasMinutos, 120);
    assert.equal(corpo.minicursosMinutos, 1200);
    assert.equal(corpo.totalMinutos, 1320);
    assert.equal(corpo.aproveitadoMinutos, 1200);
  } finally {
    await servidor.fechar();
  }
});

test('R12: recalcula na consulta apos avanco do relogio e apos presenca valida, sem emissao; corpo exato do contrato', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, { id: 'atv_rec', titulo: 'Recalcula', tipo: 'palestra', salaId: 'auditorio', vagas: 20, encontros: [{ id: 'enc_rec', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }] });
    semearInscricao(banco, { id: 'ins_rec', atividadeId: 'atv_rec', participanteId: 'p-carla', status: 'confirmada' });
    // fase 1: antes do fim -> fora do extrato
    await fixarRelogio(servidor.base, '2026-10-20T19:59:59-03:00');
    const antes = await (await fetch(`${servidor.base}/extrato`, { headers: { 'X-Usuario': 'p-carla' } })).json();
    assert.deepEqual(antes.itens, []);
    // fase 2: relógio avança para o instante exato do fim, ainda sem presença -> continua fora
    await fixarRelogio(servidor.base, '2026-10-20T20:00:00-03:00');
    const semPresenca = await (await fetch(`${servidor.base}/extrato`, { headers: { 'X-Usuario': 'p-carla' } })).json();
    assert.deepEqual(semPresenca.itens, []);
    // fase 3: presença válida registrada -> entra sem emitir
    semearPresenca(banco, { id: 'pre_rec', encontroId: 'enc_rec', participanteId: 'p-carla' });
    const depois = await fetch(`${servidor.base}/extrato`, { headers: { 'X-Usuario': 'p-carla' } });
    assert.equal(depois.status, 200);
    const corpo = await depois.json();
    assert.deepEqual(Object.keys(corpo).sort(), ['aproveitadoMinutos', 'itens', 'minicursosMinutos', 'palestrasMinutos', 'totalMinutos']);
    assert.equal(corpo.itens.length, 1);
    assert.deepEqual(Object.keys(corpo.itens[0]).sort(), ['atividadeId', 'cargaHorariaMinutos', 'codigo', 'tipo', 'titulo']);
    assert.deepEqual(corpo, {
      itens: [{ atividadeId: 'atv_rec', titulo: 'Recalcula', tipo: 'palestra', cargaHorariaMinutos: 60, codigo: null }],
      palestrasMinutos: 60,
      minicursosMinutos: 0,
      totalMinutos: 60,
      aproveitadoMinutos: 60,
    });
  } finally {
    await servidor.fechar();
  }
});

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

test('R12: apos emitir, o mesmo item aparece com o codigo do certificado', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_ext2',
      titulo: 'Palestra Codigo',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 20,
      encontros: [{ id: 'enc_ext2', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T21:00:00-03:00' }],
    });
    semearInscricao(banco, { id: 'ins_ext2', atividadeId: 'atv_ext2', participanteId: 'p-carla', status: 'confirmada' });
    semearPresenca(banco, { id: 'pre_ext2', encontroId: 'enc_ext2', participanteId: 'p-carla' });
    await fixarRelogio(servidor.base, '2026-10-20T21:00:00-03:00');
    const emitido = await fetch(`${servidor.base}/atividades/atv_ext2/certificado`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(emitido.status, 201);
    const certificado = await emitido.json();
    const res = await fetch(`${servidor.base}/extrato`, { headers: { 'X-Usuario': 'p-carla' } });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      itens: [{ atividadeId: 'atv_ext2', titulo: 'Palestra Codigo', tipo: 'palestra', cargaHorariaMinutos: 120, codigo: certificado.codigo }],
      palestrasMinutos: 120,
      minicursosMinutos: 0,
      totalMinutos: 120,
      aproveitadoMinutos: 120,
    });
  } finally {
    await servidor.fechar();
  }
});

test('R12: atividade elegivel sem emissao aparece com codigo null', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_ext1',
      titulo: 'Palestra Solo',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 20,
      encontros: [{ id: 'enc_ext1', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T21:00:00-03:00' }],
    });
    semearInscricao(banco, { id: 'ins_ext1', atividadeId: 'atv_ext1', participanteId: 'p-carla', status: 'confirmada' });
    semearPresenca(banco, { id: 'pre_ext1', encontroId: 'enc_ext1', participanteId: 'p-carla' });
    await fixarRelogio(servidor.base, '2026-10-20T21:00:00-03:00');
    const res = await fetch(`${servidor.base}/extrato`, { headers: { 'X-Usuario': 'p-carla' } });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      itens: [{ atividadeId: 'atv_ext1', titulo: 'Palestra Solo', tipo: 'palestra', cargaHorariaMinutos: 120, codigo: null }],
      palestrasMinutos: 120,
      minicursosMinutos: 0,
      totalMinutos: 120,
      aproveitadoMinutos: 120,
    });
  } finally {
    await servidor.fechar();
  }
});
