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

function semearAtividade(banco, { id, titulo = 'Atividade M4', tipo = 'minicurso', salaId = 'lab-3', vagas = 20, cancelada = 0, encontros }) {
  banco
    .prepare('INSERT INTO atividades (id, titulo, tipo, salaId, vagas, cancelada) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, titulo, tipo, salaId, vagas, cancelada);
  const inserirEncontro = banco.prepare(
    'INSERT INTO encontros (id, atividadeId, inicio, fim) VALUES (?, ?, ?, ?)',
  );
  for (const encontro of encontros) {
    inserirEncontro.run(encontro.id, id, encontro.inicio, encontro.fim);
  }
}

function semearInscricao(banco, { id, atividadeId, participanteId, status, criadaEm = '2026-10-13T09:00:00-03:00' }) {
  banco
    .prepare(
      'INSERT INTO inscricoes (id, atividadeId, participanteId, status, posicaoNaEspera, convocadaAte, criadaEm) VALUES (?, ?, ?, ?, NULL, NULL, ?)',
    )
    .run(id, atividadeId, participanteId, status, criadaEm);
}

function semearPresenca(banco, { id, encontroId, participanteId, origem = 'qr' }) {
  banco
    .prepare(
      'INSERT INTO presencas (id, encontroId, participanteId, origem, lidoEm, registradaEm, justificativa) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(id, encontroId, participanteId, origem, '2026-10-20T19:00:00-03:00', '2026-10-20T19:00:00-03:00', origem === 'manual' ? 'justificativa manual longa' : null);
}

async function fixarRelogio(base, agora) {
  await fetch(`${base}/_teste/relogio`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agora }),
  });
}

async function lerJson(res) {
  assert.equal(res.status, 200);
  return res.json();
}

test('R1: emissao do certificado nao altera atividade, inscricao nem presencas (relógio fixo)', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_preserv',
      titulo: 'Atividade Preservacao',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 20,
      encontros: [
        { id: 'enc_preserv1', inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' },
        { id: 'enc_preserv2', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    semearInscricao(banco, { id: 'ins_preserv', atividadeId: 'atv_preserv', participanteId: 'p-carla', status: 'confirmada' });
    semearPresenca(banco, { id: 'pre_preserv1', encontroId: 'enc_preserv1', participanteId: 'p-carla', origem: 'qr' });
    semearPresenca(banco, { id: 'pre_preserv2', encontroId: 'enc_preserv2', participanteId: 'p-carla', origem: 'qr' });

    const instante = '2026-10-20T22:00:00-03:00';
    await fixarRelogio(servidor.base, instante);

    const atividadeAntes = await lerJson(await fetch(`${servidor.base}/atividades/atv_preserv`, {
      headers: { 'X-Usuario': 'p-carla' },
    }));
    const inscricaoAntes = await lerJson(await fetch(`${servidor.base}/inscricoes/ins_preserv`, {
      headers: { 'X-Usuario': 'p-carla' },
    }));
    const presencasAntes1 = await lerJson(await fetch(`${servidor.base}/encontros/enc_preserv1/presencas`, {
      headers: { 'X-Usuario': 'org-ana' },
    }));
    const presencasAntes2 = await lerJson(await fetch(`${servidor.base}/encontros/enc_preserv2/presencas`, {
      headers: { 'X-Usuario': 'org-ana' },
    }));

    const emissao = await fetch(`${servidor.base}/atividades/atv_preserv/certificado`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(emissao.status, 201);
    await emissao.json();

    const relogio = await (await fetch(`${servidor.base}/_teste/relogio`)).json();
    assert.equal(Date.parse(relogio.agora), Date.parse(instante), 'relogio permanece fixo entre as leituras');

    const atividadeDepois = await lerJson(await fetch(`${servidor.base}/atividades/atv_preserv`, {
      headers: { 'X-Usuario': 'p-carla' },
    }));
    const inscricaoDepois = await lerJson(await fetch(`${servidor.base}/inscricoes/ins_preserv`, {
      headers: { 'X-Usuario': 'p-carla' },
    }));
    const presencasDepois1 = await lerJson(await fetch(`${servidor.base}/encontros/enc_preserv1/presencas`, {
      headers: { 'X-Usuario': 'org-ana' },
    }));
    const presencasDepois2 = await lerJson(await fetch(`${servidor.base}/encontros/enc_preserv2/presencas`, {
      headers: { 'X-Usuario': 'org-ana' },
    }));

    assert.deepEqual(atividadeDepois, atividadeAntes, 'atividade bit a bit apos a emissao');
    assert.deepEqual(inscricaoDepois, inscricaoAntes, 'inscricao bit a bit apos a emissao');
    assert.deepEqual(presencasDepois1, presencasAntes1, 'presencas do encontro 1 bit a bit apos a emissao');
    assert.deepEqual(presencasDepois2, presencasAntes2, 'presencas do encontro 2 bit a bit apos a emissao');
  } finally {
    await servidor.fechar();
  }
});
