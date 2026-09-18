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

function semearAtividade(banco, { id, titulo = 'Atividade R15', tipo = 'minicurso', salaId = 'lab-3', vagas = 20, encontros }) {
  banco
    .prepare('INSERT INTO atividades (id, titulo, tipo, salaId, vagas, cancelada) VALUES (?, ?, ?, ?, ?, 0)')
    .run(id, titulo, tipo, salaId, vagas);
  const inserir = banco.prepare('INSERT INTO encontros (id, atividadeId, inicio, fim) VALUES (?, ?, ?, ?)');
  for (const e of encontros) inserir.run(e.id, id, e.inicio, e.fim);
}

function semearInscricao(banco, { id, atividadeId, participanteId }) {
  banco
    .prepare(
      'INSERT INTO inscricoes (id, atividadeId, participanteId, status, posicaoNaEspera, convocadaAte, criadaEm) VALUES (?, ?, ?, ?, NULL, NULL, ?)',
    )
    .run(id, atividadeId, participanteId, 'confirmada', '2026-10-13T09:00:00-03:00');
}

function semearPresenca(banco, { id, encontroId, participanteId, lidoEm }) {
  banco
    .prepare(
      'INSERT INTO presencas (id, encontroId, participanteId, origem, lidoEm, registradaEm, justificativa) VALUES (?, ?, ?, ?, ?, ?, NULL)',
    )
    .run(id, encontroId, participanteId, 'qr', lidoEm, lidoEm);
}

async function fixarRelogio(base, agora) {
  const res = await fetch(`${base}/_teste/relogio`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agora }),
  });
  assert.equal(res.status, 200);
}

function encontros4() {
  return [
    { id: 'enc_f6_1', inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' },
    { id: 'enc_f6_2', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
    { id: 'enc_f6_3', inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T22:00:00-03:00' },
    { id: 'enc_f6_4', inicio: '2026-10-22T19:00:00-03:00', fim: '2026-10-22T22:00:00-03:00' },
  ];
}

test('R15: recusada por frequencia emite apos sincronizacao offline via M3 no limite fim + 2h, e extrato reflete', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, { id: 'atv_f6_sync', encontros: encontros4() });
    semearInscricao(banco, { id: 'ins_f6_sync', atividadeId: 'atv_f6_sync', participanteId: 'p-carla' });
    semearPresenca(banco, { id: 'pre_f6_1', encontroId: 'enc_f6_1', participanteId: 'p-carla', lidoEm: '2026-10-19T19:05:00-03:00' });
    semearPresenca(banco, { id: 'pre_f6_2', encontroId: 'enc_f6_2', participanteId: 'p-carla', lidoEm: '2026-10-20T19:05:00-03:00' });

    // 2. Código válido obtido pelo endpoint M3 durante a janela de leitura do último encontro.
    await fixarRelogio(servidor.base, '2026-10-22T19:05:00-03:00');
    const codigoRes = await fetch(`${servidor.base}/encontros/enc_f6_4/codigo`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(codigoRes.status, 200);
    const { codigo } = await codigoRes.json();
    assert.match(codigo, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    const lidoEm = '2026-10-22T19:05:00-03:00';

    // 3./4. Relógio depois do encerramento, frequência ainda insuficiente (2/4).
    await fixarRelogio(servidor.base, '2026-10-22T22:00:01-03:00');
    const recusada = await fetch(`${servidor.base}/atividades/atv_f6_sync/certificado`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(recusada.status, 422);
    assert.equal((await recusada.json()).erro, 'PRESENCA_INSUFICIENTE');

    const extratoAntes = await fetch(`${servidor.base}/extrato`, {
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(extratoAntes.status, 200);
    assert.deepEqual((await extratoAntes.json()).itens, []);

    // 5. Sincronização offline pelo endpoint real do M3 no instante limite fim + 2h (inclusive).
    await fixarRelogio(servidor.base, '2026-10-23T00:00:00-03:00');
    const sync = await fetch(`${servidor.base}/encontros/enc_f6_4/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla', 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo, lidoEm }),
    });
    assert.equal(sync.status, 201);
    const presenca = await sync.json();
    assert.equal(presenca.encontroId, 'enc_f6_4');
    assert.equal(presenca.participanteId, 'p-carla');
    assert.equal(presenca.origem, 'qr_offline');
    assert.equal(presenca.lidoEm, '2026-10-22T19:05:00-03:00');

    // 6. Nova solicitação emite com carga integral e presença contabilizada.
    const emitido = await fetch(`${servidor.base}/atividades/atv_f6_sync/certificado`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(emitido.status, 201);
    const certificado = await emitido.json();
    assert.match(certificado.codigo, /^SA26-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
    assert.equal(certificado.atividadeId, 'atv_f6_sync');
    assert.equal(certificado.participanteId, 'p-carla');
    assert.equal(certificado.cargaHorariaMinutos, 720);
    assert.equal(certificado.presencas, 3);
    assert.equal(certificado.encontros, 4);

    // 7. Extrato reflete a nova elegibilidade, com o código preenchido.
    const extrato = await fetch(`${servidor.base}/extrato`, {
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(extrato.status, 200);
    assert.deepEqual(await extrato.json(), {
      itens: [
        {
          atividadeId: 'atv_f6_sync',
          titulo: 'Atividade R15',
          tipo: 'minicurso',
          cargaHorariaMinutos: 720,
          codigo: certificado.codigo,
        },
      ],
      palestrasMinutos: 0,
      minicursosMinutos: 720,
      totalMinutos: 720,
      aproveitadoMinutos: 720,
    });
  } finally {
    await servidor.fechar();
  }
});

test('R15: com minimo ja atingido, emite logo no encerramento sem esperar o prazo de sincronizacao', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_f6_pronta',
      encontros: [
        { id: 'enc_f6p_1', inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' },
        { id: 'enc_f6p_2', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
        { id: 'enc_f6p_3', inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T22:00:00-03:00' },
        { id: 'enc_f6p_4', inicio: '2026-10-22T19:00:00-03:00', fim: '2026-10-22T22:00:00-03:00' },
      ],
    });
    semearInscricao(banco, { id: 'ins_f6_pronta', atividadeId: 'atv_f6_pronta', participanteId: 'p-carla' });
    semearPresenca(banco, { id: 'pre_f6p_1', encontroId: 'enc_f6p_1', participanteId: 'p-carla', lidoEm: '2026-10-19T19:05:00-03:00' });
    semearPresenca(banco, { id: 'pre_f6p_2', encontroId: 'enc_f6p_2', participanteId: 'p-carla', lidoEm: '2026-10-20T19:05:00-03:00' });
    semearPresenca(banco, { id: 'pre_f6p_3', encontroId: 'enc_f6p_3', participanteId: 'p-carla', lidoEm: '2026-10-21T19:05:00-03:00' });

    // Relógio no instante exato do fim: já encerrada, janela de sincronização ainda aberta, emite direto.
    await fixarRelogio(servidor.base, '2026-10-22T22:00:00-03:00');
    const res = await fetch(`${servidor.base}/atividades/atv_f6_pronta/certificado`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res.status, 201);
    const corpo = await res.json();
    assert.equal(corpo.cargaHorariaMinutos, 720);
    assert.equal(corpo.presencas, 3);
    assert.equal(corpo.encontros, 4);
  } finally {
    await servidor.fechar();
  }
});
