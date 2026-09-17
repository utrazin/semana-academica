import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarServidor } from '../src/app.js';
import { novoBanco } from '../src/banco.js';

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

async function levarRelogio(servidor, agora) {
  const resposta = await fetch(`${servidor.base}/_teste/relogio`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agora }),
  });
  assert.equal(resposta.status, 200);
  return (await resposta.json()).agora;
}

test('R27: cargaHorariaMinutos e a soma das duracoes dos encontros e qualquer valor enviado no corpo e ignorado', async () => {
  const servidor = await subirServidor();
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const resposta = await postAtividade(servidor, {
      titulo: 'Minicurso de 6h',
      tipo: 'minicurso',
      salaId: 'sala-101',
      vagas: 20,
      encontros: [
        { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' },
        { inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T22:00:00-03:00' },
      ],
      cargaHorariaMinutos: 999,
    });

    assert.equal(resposta.status, 201);
    const criada = await resposta.json();
    assert.equal(criada.cargaHorariaMinutos, 360);
  } finally {
    await servidor.fechar();
  }
});

test('R28: situacao segue o relogio: prevista, em_andamento (inicio e entre encontros), encerrada e cancelada sobrepoe', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const criar = await postAtividade(servidor, {
      titulo: 'Minicurso da semana',
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
    const idCriada = criada.id;

    semearAtividade(banco, {
      id: 'atv_00000002',
      titulo: 'Cancelada mesmo com relogio no meio',
      tipo: 'palestra',
      salaId: 'sala-101',
      vagas: 5,
      cancelada: true,
      encontros: [
        { id: 'enc_00000002', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
      ],
    });

    for (const [agora, esperado] of [
      ['2026-10-19T18:00:00-03:00', 'prevista'],
      ['2026-10-19T19:00:00-03:00', 'em_andamento'],
      ['2026-10-20T12:00:00-03:00', 'em_andamento'],
      ['2026-10-21T20:00:00-03:00', 'encerrada'],
    ]) {
      await levarRelogio(servidor, agora);
      const resposta = await fetch(`${servidor.base}/atividades`, {
        headers: { 'X-Usuario': 'p-carla' },
      });
      assert.equal(resposta.status, 200);
      const atividades = await resposta.json();
      const normal = atividades.find((a) => a.id === idCriada);
      assert.equal(normal.situacao, esperado, `relogio em ${agora}`);
    }

    await levarRelogio(servidor, '2026-10-20T12:00:00-03:00');
    const resposta = await fetch(`${servidor.base}/atividades`, {
      headers: { 'X-Usuario': 'p-carla' },
    });
    const cancelada = (await resposta.json()).find((a) => a.id === 'atv_00000002');
    assert.equal(cancelada.situacao, 'cancelada');
  } finally {
    await servidor.fechar();
  }
});

test('R29: ocupadas e emEspera sao 0 e vagasRestantes iguala vagas em qualquer rota de leitura', async () => {
  const servidor = await subirServidor();
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const resposta = await postAtividade(servidor, {
      titulo: 'Palestra de derivados',
      tipo: 'palestra',
      salaId: 'lab-3',
      vagas: 10,
      encontros: [
        { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T20:00:00-03:00' },
      ],
    });
    assert.equal(resposta.status, 201);
    const criada = await resposta.json();
    assert.equal(criada.ocupadas, 0);
    assert.equal(criada.emEspera, 0);
    assert.equal(criada.vagasRestantes, criada.vagas);

    const listagem = await fetch(`${servidor.base}/atividades`, {
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(listagem.status, 200);
    const atividade = (await listagem.json()).find((a) => a.id === criada.id);
    assert.equal(atividade.ocupadas, 0);
    assert.equal(atividade.emEspera, 0);
    assert.equal(atividade.vagasRestantes, 10);
  } finally {
    await servidor.fechar();
  }
});