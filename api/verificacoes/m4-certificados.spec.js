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

test('R1: sem X-Usuario valido, rotas restritas de M4 -> 401 USUARIO_DESCONHECIDO', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const casos = [
      { metodo: 'POST', rota: '/atividades/atv_inexistente/certificado' },
      { metodo: 'GET', rota: '/certificados' },
      { metodo: 'GET', rota: '/extrato' },
    ];

    for (const { metodo, rota } of casos) {
      const semCabecalho = await fetch(`${servidor.base}${rota}`, { method: metodo });
      assert.equal(semCabecalho.status, 401, `${metodo} ${rota} sem cabecalho`);
      assert.equal((await semCabecalho.json()).erro, 'USUARIO_DESCONHECIDO', `${metodo} ${rota} sem cabecalho`);

      const desconhecido = await fetch(`${servidor.base}${rota}`, {
        method: metodo,
        headers: { 'X-Usuario': 'nao-existe' },
      });
      assert.equal(desconhecido.status, 401, `${metodo} ${rota} usuario desconhecido`);
      assert.equal((await desconhecido.json()).erro, 'USUARIO_DESCONHECIDO', `${metodo} ${rota} usuario desconhecido`);
    }
  } finally {
    await servidor.fechar();
  }
});

test('R1: organizacao nas rotas restritas de M4 -> 403 SOMENTE_PARTICIPANTE, antes da existencia', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const casos = [
      { metodo: 'POST', rota: '/atividades/atv_inexistente/certificado' },
      { metodo: 'GET', rota: '/certificados' },
      { metodo: 'GET', rota: '/extrato' },
    ];

    for (const { metodo, rota } of casos) {
      const res = await fetch(`${servidor.base}${rota}`, {
        method: metodo,
        headers: { 'X-Usuario': 'org-ana' },
      });
      assert.equal(res.status, 403, `${metodo} ${rota} como organizacao`);
      assert.equal((await res.json()).erro, 'SOMENTE_PARTICIPANTE', `${metodo} ${rota} como organizacao`);
    }
  } finally {
    await servidor.fechar();
  }
});

test('R1: GET /certificados sem nada emitido -> 200 com lista vazia', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const res = await fetch(`${servidor.base}/certificados`, {
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), []);
  } finally {
    await servidor.fechar();
  }
});

function semearCertificado(banco, { codigo, atividadeId, participanteId, cargaHorariaMinutos, presencas, encontros, emitidoEm }) {
  banco
    .prepare(
      'INSERT INTO certificados (codigo, atividadeId, participanteId, cargaHorariaMinutos, presencas, encontros, emitidoEm) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(codigo, atividadeId, participanteId, cargaHorariaMinutos, presencas, encontros, emitidoEm);
}

test('R1: GET /certificados devolve so os certificados do participante', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    banco
      .prepare('INSERT INTO atividades (id, titulo, tipo, salaId, vagas, cancelada) VALUES (?, ?, ?, ?, ?, 0)')
      .run('atv_iso', 'Flutter do zero', 'minicurso', 'lab-3', 20);
    semearCertificado(banco, {
      codigo: 'SA26-AB2D-EF3H',
      atividadeId: 'atv_iso',
      participanteId: 'p-carla',
      cargaHorariaMinutos: 360,
      presencas: 2,
      encontros: 2,
      emitidoEm: '2026-10-21T10:00:00-03:00',
    });
    semearCertificado(banco, {
      codigo: 'SA26-ZZ9Y-XW8V',
      atividadeId: 'atv_iso',
      participanteId: 'p-diego',
      cargaHorariaMinutos: 360,
      presencas: 2,
      encontros: 2,
      emitidoEm: '2026-10-21T11:00:00-03:00',
    });

    const carla = await fetch(`${servidor.base}/certificados`, {
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(carla.status, 200);
    assert.deepEqual(await carla.json(), [
      {
        codigo: 'SA26-AB2D-EF3H',
        atividadeId: 'atv_iso',
        participanteId: 'p-carla',
        cargaHorariaMinutos: 360,
        presencas: 2,
        encontros: 2,
        emitidoEm: '2026-10-21T10:00:00-03:00',
      },
    ]);

    const diego = await fetch(`${servidor.base}/certificados`, {
      headers: { 'X-Usuario': 'p-diego' },
    });
    assert.equal(diego.status, 200);
    assert.deepEqual(await diego.json(), [
      {
        codigo: 'SA26-ZZ9Y-XW8V',
        atividadeId: 'atv_iso',
        participanteId: 'p-diego',
        cargaHorariaMinutos: 360,
        presencas: 2,
        encontros: 2,
        emitidoEm: '2026-10-21T11:00:00-03:00',
      },
    ]);
  } finally {
    await servidor.fechar();
  }
});

test('R1: GET /certificados/:codigo e publica, sem X-Usuario responde sem 401', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const semCabecalho = await fetch(`${servidor.base}/certificados/SA26-XXXX-YYYY`);
    assert.notEqual(semCabecalho.status, 401, 'rota publica nao exige identificacao');
    assert.equal(semCabecalho.status, 404);
    assert.equal((await semCabecalho.json()).erro, 'NAO_ENCONTRADO');
  } finally {
    await servidor.fechar();
  }
});

test('infra: POST /_teste/reset limpa a tabela certificados', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    banco
      .prepare('INSERT INTO atividades (id, titulo, tipo, salaId, vagas, cancelada) VALUES (?, ?, ?, ?, ?, 0)')
      .run('atv_reset', 'Atividade Reset', 'palestra', 'auditorio', 10);
    semearCertificado(banco, {
      codigo: 'SA26-RR11-RR22',
      atividadeId: 'atv_reset',
      participanteId: 'p-carla',
      cargaHorariaMinutos: 180,
      presencas: 1,
      encontros: 1,
      emitidoEm: '2026-10-21T10:00:00-03:00',
    });

    assert.equal(banco.prepare('SELECT COUNT(*) AS total FROM certificados').get().total, 1);

    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    assert.equal(banco.prepare('SELECT COUNT(*) AS total FROM certificados').get().total, 0);
  } finally {
    await servidor.fechar();
  }
});

// ---- Fatia 2: primeira emissão (R2, R3, R4, R5, R6, R14) ----

function semearAtividadeM4(banco, { id, titulo = 'Atividade M4', tipo = 'minicurso', salaId = 'lab-3', vagas = 20, cancelada = 0, encontros }) {
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

function semearInscricaoM4(banco, { id, atividadeId, participanteId, status, criadaEm = '2026-10-13T09:00:00-03:00' }) {
  banco
    .prepare(
      'INSERT INTO inscricoes (id, atividadeId, participanteId, status, posicaoNaEspera, convocadaAte, criadaEm) VALUES (?, ?, ?, ?, NULL, NULL, ?)',
    )
    .run(id, atividadeId, participanteId, status, criadaEm);
}

function semearPresencaM4(banco, { id, encontroId, participanteId, origem = 'qr' }) {
  banco
    .prepare(
      'INSERT INTO presencas (id, encontroId, participanteId, origem, lidoEm, registradaEm, justificativa) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(id, encontroId, participanteId, origem, '2026-10-20T19:00:00-03:00', '2026-10-20T19:00:00-03:00', origem === 'manual' ? 'justificativa manual longa' : null);
}

async function fixarRelogioM4(base, agora) {
  await fetch(`${base}/_teste/relogio`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agora }),
  });
}

test('R2/R14: atividade cancelada -> 422 ATIVIDADE_CANCELADA', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividadeM4(banco, {
      id: 'atv_f2_canc',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      cancelada: 1,
      encontros: [
        { id: 'enc_f2_canc', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    await fixarRelogioM4(servidor.base, '2026-10-20T22:00:00-03:00');
    const res = await fetch(`${servidor.base}/atividades/atv_f2_canc/certificado`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res.status, 422);
    assert.equal((await res.json()).erro, 'ATIVIDADE_CANCELADA');
  } finally {
    await servidor.fechar();
  }
});

test('R2/R14: sem inscricao confirmada (ausente, em_espera, convocada, cancelada, expirada) -> 403 NAO_INSCRITO', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividadeM4(banco, {
      id: 'atv_f2_insc',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_f2_insc', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    semearInscricaoM4(banco, { id: 'ins_f2_espera', atividadeId: 'atv_f2_insc', participanteId: 'p-diego', status: 'em_espera' });
    semearInscricaoM4(banco, { id: 'ins_f2_conv', atividadeId: 'atv_f2_insc', participanteId: 'p-elisa', status: 'convocada' });
    semearInscricaoM4(banco, { id: 'ins_f2_canc', atividadeId: 'atv_f2_insc', participanteId: 'p-fabio', status: 'cancelada' });
    semearInscricaoM4(banco, { id: 'ins_f2_exp', atividadeId: 'atv_f2_insc', participanteId: 'p-gabriela', status: 'expirada' });
    await fixarRelogioM4(servidor.base, '2026-10-20T22:00:00-03:00');
    const casos = [
      ['p-carla', 'sem inscricao'],
      ['p-diego', 'em_espera'],
      ['p-elisa', 'convocada'],
      ['p-fabio', 'cancelada'],
      ['p-gabriela', 'expirada'],
    ];
    for (const [usuario, status] of casos) {
      const res = await fetch(`${servidor.base}/atividades/atv_f2_insc/certificado`, {
        method: 'POST',
        headers: { 'X-Usuario': usuario },
      });
      assert.equal(res.status, 403, status);
      assert.equal((await res.json()).erro, 'NAO_INSCRITO', status);
    }
  } finally {
    await servidor.fechar();
  }
});

test('R2/R3/R14: 1 segundo antes do fim do ultimo encontro -> 422 ATIVIDADE_NAO_ENCERRADA', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividadeM4(banco, {
      id: 'atv_f2_aberta',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_f2_aberta', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    semearInscricaoM4(banco, { id: 'ins_f2_aberta', atividadeId: 'atv_f2_aberta', participanteId: 'p-carla', status: 'confirmada' });
    await fixarRelogioM4(servidor.base, '2026-10-20T21:59:59-03:00');
    const res = await fetch(`${servidor.base}/atividades/atv_f2_aberta/certificado`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res.status, 422);
    assert.equal((await res.json()).erro, 'ATIVIDADE_NAO_ENCERRADA');
  } finally {
    await servidor.fechar();
  }
});

test('R2/R3/R4/R5: 4 encontros, 3 presencas, relogio no instante exato do fim -> 201 com carga integral e codigo valido', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividadeM4(banco, {
      id: 'atv_f2_ok',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 20,
      encontros: [
        { id: 'enc_f2_ok1', inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' },
        { id: 'enc_f2_ok2', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
        { id: 'enc_f2_ok3', inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T22:00:00-03:00' },
        { id: 'enc_f2_ok4', inicio: '2026-10-22T19:00:00-03:00', fim: '2026-10-22T22:00:00-03:00' },
      ],
    });
    semearInscricaoM4(banco, { id: 'ins_f2_ok', atividadeId: 'atv_f2_ok', participanteId: 'p-carla', status: 'confirmada' });
    semearPresencaM4(banco, { id: 'pre_f2_ok1', encontroId: 'enc_f2_ok1', participanteId: 'p-carla', origem: 'qr' });
    semearPresencaM4(banco, { id: 'pre_f2_ok2', encontroId: 'enc_f2_ok2', participanteId: 'p-carla', origem: 'qr' });
    semearPresencaM4(banco, { id: 'pre_f2_ok3', encontroId: 'enc_f2_ok3', participanteId: 'p-carla', origem: 'qr' });
    await fixarRelogioM4(servidor.base, '2026-10-22T22:00:00-03:00');
    const res = await fetch(`${servidor.base}/atividades/atv_f2_ok/certificado`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res.status, 201);
    const corpo = await res.json();
    assert.match(corpo.codigo, /^SA26-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
    assert.equal(corpo.atividadeId, 'atv_f2_ok');
    assert.equal(corpo.participanteId, 'p-carla');
    assert.equal(corpo.cargaHorariaMinutos, 720);
    assert.equal(corpo.presencas, 3);
    assert.equal(corpo.encontros, 4);
    assert.equal(Date.parse(corpo.emitidoEm), Date.parse('2026-10-22T22:00:00-03:00'));
    assert.deepEqual(Object.keys(corpo).sort(), ['atividadeId', 'cargaHorariaMinutos', 'codigo', 'emitidoEm', 'encontros', 'participanteId', 'presencas']);
  } finally {
    await servidor.fechar();
  }
});

test('R4: 4 encontros, 2 presencas -> 422 PRESENCA_INSUFICIENTE (2x4=8 < 4x3=12, sem arredondamento)', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividadeM4(banco, {
      id: 'atv_f2_2de4',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 20,
      encontros: [
        { id: 'enc_f2_2de4_1', inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' },
        { id: 'enc_f2_2de4_2', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
        { id: 'enc_f2_2de4_3', inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T22:00:00-03:00' },
        { id: 'enc_f2_2de4_4', inicio: '2026-10-22T19:00:00-03:00', fim: '2026-10-22T22:00:00-03:00' },
      ],
    });
    semearInscricaoM4(banco, { id: 'ins_f2_2de4', atividadeId: 'atv_f2_2de4', participanteId: 'p-carla', status: 'confirmada' });
    semearPresencaM4(banco, { id: 'pre_f2_2de4_1', encontroId: 'enc_f2_2de4_1', participanteId: 'p-carla', origem: 'qr' });
    semearPresencaM4(banco, { id: 'pre_f2_2de4_2', encontroId: 'enc_f2_2de4_2', participanteId: 'p-carla', origem: 'qr' });
    await fixarRelogioM4(servidor.base, '2026-10-22T22:00:00-03:00');
    const res = await fetch(`${servidor.base}/atividades/atv_f2_2de4/certificado`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res.status, 422);
    assert.equal((await res.json()).erro, 'PRESENCA_INSUFICIENTE');
  } finally {
    await servidor.fechar();
  }
});

test('R4: frequencia nos limites — 1/1, 2/2, 3/3 e 4/5 passam; 1/2, 2/3 e 3/5 recusam', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    const casos = [
      { encontros: 1, presencas: 1, status: 201, erro: null },
      { encontros: 2, presencas: 1, status: 422, erro: 'PRESENCA_INSUFICIENTE' },
      { encontros: 2, presencas: 2, status: 201, erro: null },
      { encontros: 3, presencas: 2, status: 422, erro: 'PRESENCA_INSUFICIENTE' },
      { encontros: 3, presencas: 3, status: 201, erro: null },
      { encontros: 5, presencas: 3, status: 422, erro: 'PRESENCA_INSUFICIENTE' },
      { encontros: 5, presencas: 4, status: 201, erro: null },
    ];
    for (const [indice, caso] of casos.entries()) {
      const atividadeId = `atv_f2_f${indice}`;
      const encontros = [];
      for (let i = 1; i <= caso.encontros; i += 1) {
        const dia = 18 + i;
        encontros.push({
          id: `enc_f2_f${indice}_${i}`,
          inicio: `2026-10-${dia}T19:00:00-03:00`,
          fim: `2026-10-${dia}T20:00:00-03:00`,
        });
      }
      semearAtividadeM4(banco, {
        id: atividadeId,
        titulo: `Atividade F ${indice}`,
        tipo: caso.encontros === 1 ? 'palestra' : 'minicurso',
        salaId: 'auditorio',
        vagas: 20,
        encontros,
      });
      semearInscricaoM4(banco, { id: `ins_f2_f${indice}`, atividadeId, participanteId: 'p-carla', status: 'confirmada' });
      for (let p = 1; p <= caso.presencas; p += 1) {
        semearPresencaM4(banco, { id: `pre_f2_f${indice}_${p}`, encontroId: `enc_f2_f${indice}_${p}`, participanteId: 'p-carla', origem: 'qr' });
      }
    }
    await fixarRelogioM4(servidor.base, '2026-10-24T00:00:00-03:00');
    for (const [indice, caso] of casos.entries()) {
      const res = await fetch(`${servidor.base}/atividades/atv_f2_f${indice}/certificado`, {
        method: 'POST',
        headers: { 'X-Usuario': 'p-carla' },
      });
      assert.equal(res.status, caso.status, `${caso.presencas}/${caso.encontros}`);
      if (caso.erro) {
        assert.equal((await res.json()).erro, caso.erro, `${caso.presencas}/${caso.encontros}`);
      } else {
        const corpo = await res.json();
        assert.equal(corpo.presencas, caso.presencas, `${caso.presencas}/${caso.encontros}`);
        assert.equal(corpo.encontros, caso.encontros, `${caso.presencas}/${caso.encontros}`);
      }
    }
  } finally {
    await servidor.fechar();
  }
});

test('R4: presencas qr, qr_offline e manual contam igualmente para o minimo', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividadeM4(banco, {
      id: 'atv_f2_orig',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 20,
      encontros: [
        { id: 'enc_f2_orig1', inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' },
        { id: 'enc_f2_orig2', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
        { id: 'enc_f2_orig3', inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T22:00:00-03:00' },
        { id: 'enc_f2_orig4', inicio: '2026-10-22T19:00:00-03:00', fim: '2026-10-22T22:00:00-03:00' },
      ],
    });
    semearInscricaoM4(banco, { id: 'ins_f2_orig', atividadeId: 'atv_f2_orig', participanteId: 'p-carla', status: 'confirmada' });
    semearPresencaM4(banco, { id: 'pre_f2_orig1', encontroId: 'enc_f2_orig1', participanteId: 'p-carla', origem: 'qr' });
    semearPresencaM4(banco, { id: 'pre_f2_orig2', encontroId: 'enc_f2_orig2', participanteId: 'p-carla', origem: 'qr_offline' });
    semearPresencaM4(banco, { id: 'pre_f2_orig3', encontroId: 'enc_f2_orig3', participanteId: 'p-carla', origem: 'manual' });
    await fixarRelogioM4(servidor.base, '2026-10-22T22:00:00-03:00');
    const res = await fetch(`${servidor.base}/atividades/atv_f2_orig/certificado`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res.status, 201, '1 qr + 1 qr_offline + 1 manual = 3/4, atinge o minimo');
    assert.equal((await res.json()).presencas, 3);
  } finally {
    await servidor.fechar();
  }
});

test('R14: precedencia — inexistente, cancelada, nao inscrito, nao encerrada, presenca insuficiente', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividadeM4(banco, {
      id: 'atv_f2_pcancel',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      cancelada: 1,
      encontros: [
        { id: 'enc_f2_pcancel', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    semearAtividadeM4(banco, {
      id: 'atv_f2_paberta',
      tipo: 'palestra',
      salaId: 'sala-101',
      vagas: 10,
      encontros: [
        { id: 'enc_f2_paberta', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    semearAtividadeM4(banco, {
      id: 'atv_f2_penc',
      tipo: 'palestra',
      salaId: 'sala-102',
      vagas: 10,
      encontros: [
        { id: 'enc_f2_penc', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    semearInscricaoM4(banco, { id: 'ins_f2_paberta', atividadeId: 'atv_f2_paberta', participanteId: 'p-carla', status: 'confirmada' });
    semearInscricaoM4(banco, { id: 'ins_f2_penc', atividadeId: 'atv_f2_penc', participanteId: 'p-carla', status: 'confirmada' });

    const inexistente = await fetch(`${servidor.base}/atividades/atv_que_nao_existe/certificado`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(inexistente.status, 404);
    assert.equal((await inexistente.json()).erro, 'NAO_ENCONTRADO');

    await fixarRelogioM4(servidor.base, '2026-10-20T19:00:00-03:00');
    const canceladaSemInscricao = await fetch(`${servidor.base}/atividades/atv_f2_pcancel/certificado`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(canceladaSemInscricao.status, 422, 'cancelada vence inscricao ausente');
    assert.equal((await canceladaSemInscricao.json()).erro, 'ATIVIDADE_CANCELADA');

    const abertaSemInscricaoDeOutro = await fetch(`${servidor.base}/atividades/atv_f2_paberta/certificado`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });
    assert.equal(abertaSemInscricaoDeOutro.status, 403, 'nao inscrito vence nao encerrada');
    assert.equal((await abertaSemInscricaoDeOutro.json()).erro, 'NAO_INSCRITO');

    const abertaConfirmada = await fetch(`${servidor.base}/atividades/atv_f2_paberta/certificado`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(abertaConfirmada.status, 422, 'nao encerrada vence presenca insuficiente');
    assert.equal((await abertaConfirmada.json()).erro, 'ATIVIDADE_NAO_ENCERRADA');

    await fixarRelogioM4(servidor.base, '2026-10-20T22:00:00-03:00');
    const encerradaSemPresenca = await fetch(`${servidor.base}/atividades/atv_f2_penc/certificado`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(encerradaSemPresenca.status, 422);
    assert.equal((await encerradaSemPresenca.json()).erro, 'PRESENCA_INSUFICIENTE');
  } finally {
    await servidor.fechar();
  }
});

test('R6: emissao dias depois do encerramento sai normal, sem expiracao', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividadeM4(banco, {
      id: 'atv_f2_tardia',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_f2_tardia', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
      ],
    });
    semearInscricaoM4(banco, { id: 'ins_f2_tardia', atividadeId: 'atv_f2_tardia', participanteId: 'p-carla', status: 'confirmada' });
    semearPresencaM4(banco, { id: 'pre_f2_tardia', encontroId: 'enc_f2_tardia', participanteId: 'p-carla', origem: 'qr' });
    await fixarRelogioM4(servidor.base, '2026-11-15T10:00:00-03:00');
    const res = await fetch(`${servidor.base}/atividades/atv_f2_tardia/certificado`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res.status, 201);
    const corpo = await res.json();
    assert.equal(corpo.cargaHorariaMinutos, 60);
    assert.equal(corpo.presencas, 1);
    assert.equal(corpo.encontros, 1);
  } finally {
    await servidor.fechar();
  }
});

test('R2: certificado emitido aparece em GET /certificados com os mesmos sete campos', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividadeM4(banco, {
      id: 'atv_f2_pers',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_f2_pers', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
      ],
    });
    semearInscricaoM4(banco, { id: 'ins_f2_pers', atividadeId: 'atv_f2_pers', participanteId: 'p-carla', status: 'confirmada' });
    semearPresencaM4(banco, { id: 'pre_f2_pers', encontroId: 'enc_f2_pers', participanteId: 'p-carla', origem: 'qr' });
    await fixarRelogioM4(servidor.base, '2026-10-20T20:00:00-03:00');
    const emitido = await fetch(`${servidor.base}/atividades/atv_f2_pers/certificado`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(emitido.status, 201);
    const certificado = await emitido.json();

    const lista = await fetch(`${servidor.base}/certificados`, {
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(lista.status, 200);
    assert.deepEqual(await lista.json(), [certificado]);

    const deOutro = await fetch(`${servidor.base}/certificados`, {
      headers: { 'X-Usuario': 'p-diego' },
    });
    assert.equal(deOutro.status, 200);
    assert.deepEqual(await deOutro.json(), []);
  } finally {
    await servidor.fechar();
  }
});

// ---- Fatia 4: verificação pública (R10, R11) ----

test('R10/R11: GET /certificados/:codigo sem X-Usuario -> 200 com corpo exato da Verificacao', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividadeM4(banco, {
      id: 'atv_f4_ver',
      titulo: 'Flutter do zero',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 20,
      encontros: [
        { id: 'enc_f4_ver1', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
        { id: 'enc_f4_ver2', inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T22:00:00-03:00' },
      ],
    });
    semearCertificado(banco, {
      codigo: 'SA26-AB2D-EF3H',
      atividadeId: 'atv_f4_ver',
      participanteId: 'p-carla',
      cargaHorariaMinutos: 360,
      presencas: 2,
      encontros: 2,
      emitidoEm: '2026-10-21T22:00:00-03:00',
    });

    const res = await fetch(`${servidor.base}/certificados/SA26-AB2D-EF3H`);
    assert.equal(res.status, 200);
    const corpo = await res.json();
    assert.deepEqual(corpo, {
      codigo: 'SA26-AB2D-EF3H',
      participante: 'Carla M. S.',
      atividade: 'Flutter do zero',
      cargaHorariaMinutos: 360,
      emitidoEm: '2026-10-21T22:00:00-03:00',
    });
    assert.deepEqual(Object.keys(corpo).sort(), ['atividade', 'cargaHorariaMinutos', 'codigo', 'emitidoEm', 'participante']);
    assert.ok(!('participanteId' in corpo), 'nao expoe participanteId');
    assert.ok(!JSON.stringify(corpo).includes('Carla Mendes Souza'), 'nao expoe nome completo');
  } finally {
    await servidor.fechar();
  }
});

test('R10: codigo em minusculas encontra o mesmo certificado', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividadeM4(banco, {
      id: 'atv_f4_lower',
      titulo: 'Flutter do zero',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 20,
      encontros: [
        { id: 'enc_f4_lower1', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
        { id: 'enc_f4_lower2', inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T22:00:00-03:00' },
      ],
    });
    semearCertificado(banco, {
      codigo: 'SA26-AB2D-EF3H',
      atividadeId: 'atv_f4_lower',
      participanteId: 'p-carla',
      cargaHorariaMinutos: 360,
      presencas: 2,
      encontros: 2,
      emitidoEm: '2026-10-21T22:00:00-03:00',
    });

    const res = await fetch(`${servidor.base}/certificados/sa26-ab2d-ef3h`);
    assert.equal(res.status, 200);
    const corpo = await res.json();
    assert.deepEqual(corpo, {
      codigo: 'SA26-AB2D-EF3H',
      participante: 'Carla M. S.',
      atividade: 'Flutter do zero',
      cargaHorariaMinutos: 360,
      emitidoEm: '2026-10-21T22:00:00-03:00',
    });
  } finally {
    await servidor.fechar();
  }
});

test('R10: codigo inexistente -> 404 NAO_ENCONTRADO', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const res = await fetch(`${servidor.base}/certificados/SA26-ZZZZ-ZZZZ`);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).erro, 'NAO_ENCONTRADO');

    const minusculo = await fetch(`${servidor.base}/certificados/sa26-zzzz-zzzz`);
    assert.equal(minusculo.status, 404);
    assert.equal((await minusculo.json()).erro, 'NAO_ENCONTRADO');
  } finally {
    await servidor.fechar();
  }
});

test('R10: verificacao continua publica com X-Usuario desconhecido ou da organizacao', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividadeM4(banco, {
      id: 'atv_f4_pub',
      titulo: 'Flutter do zero',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 20,
      encontros: [
        { id: 'enc_f4_pub1', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
        { id: 'enc_f4_pub2', inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T22:00:00-03:00' },
      ],
    });
    semearCertificado(banco, {
      codigo: 'SA26-AB2D-EF3H',
      atividadeId: 'atv_f4_pub',
      participanteId: 'p-carla',
      cargaHorariaMinutos: 360,
      presencas: 2,
      encontros: 2,
      emitidoEm: '2026-10-21T22:00:00-03:00',
    });

    const desconhecido = await fetch(`${servidor.base}/certificados/SA26-AB2D-EF3H`, {
      headers: { 'X-Usuario': 'nao-existe' },
    });
    assert.equal(desconhecido.status, 200);
    assert.equal((await desconhecido.json()).codigo, 'SA26-AB2D-EF3H');

    const organizacao = await fetch(`${servidor.base}/certificados/SA26-AB2D-EF3H`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(organizacao.status, 200);
    assert.equal((await organizacao.json()).codigo, 'SA26-AB2D-EF3H');
  } finally {
    await servidor.fechar();
  }
});

test('R11: abreviacao com particula "da" — Elisa Fernandes da Rocha -> Elisa F. da R.', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividadeM4(banco, {
      id: 'atv_f4_da',
      titulo: 'Flutter do zero',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 20,
      encontros: [
        { id: 'enc_f4_da1', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
        { id: 'enc_f4_da2', inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T22:00:00-03:00' },
      ],
    });
    semearCertificado(banco, {
      codigo: 'SA26-DA11-DA22',
      atividadeId: 'atv_f4_da',
      participanteId: 'p-elisa',
      cargaHorariaMinutos: 360,
      presencas: 2,
      encontros: 2,
      emitidoEm: '2026-10-21T22:00:00-03:00',
    });

    const res = await fetch(`${servidor.base}/certificados/SA26-DA11-DA22`);
    assert.equal(res.status, 200);
    const corpo = await res.json();
    assert.equal(corpo.participante, 'Elisa F. da R.');
    assert.deepEqual(corpo, {
      codigo: 'SA26-DA11-DA22',
      participante: 'Elisa F. da R.',
      atividade: 'Flutter do zero',
      cargaHorariaMinutos: 360,
      emitidoEm: '2026-10-21T22:00:00-03:00',
    });
  } finally {
    await servidor.fechar();
  }
});

test('R11: abreviacao com particula "dos" — Isadora Ribeiro dos Santos -> Isadora R. dos S.', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividadeM4(banco, {
      id: 'atv_f4_dos',
      titulo: 'Flutter do zero',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 20,
      encontros: [
        { id: 'enc_f4_dos1', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
        { id: 'enc_f4_dos2', inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T22:00:00-03:00' },
      ],
    });
    semearCertificado(banco, {
      codigo: 'SA26-DS33-DS44',
      atividadeId: 'atv_f4_dos',
      participanteId: 'p-isadora',
      cargaHorariaMinutos: 360,
      presencas: 2,
      encontros: 2,
      emitidoEm: '2026-10-21T22:00:00-03:00',
    });

    const res = await fetch(`${servidor.base}/certificados/SA26-DS33-DS44`);
    assert.equal(res.status, 200);
    const corpo = await res.json();
    assert.equal(corpo.participante, 'Isadora R. dos S.');
  } finally {
    await servidor.fechar();
  }
});
