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

function semearAtividade(banco, { id, titulo, tipo, salaId, vagas, cancelada = 0, encontros }) {
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

function semearInscricao(
  banco,
  {
    id,
    atividadeId,
    participanteId,
    status,
    posicaoNaEspera = null,
    convocadaAte = null,
    criadaEm = '2026-10-13T09:00:00-03:00',
  },
) {
  banco
    .prepare(
      'INSERT INTO inscricoes (id, atividadeId, participanteId, status, posicaoNaEspera, convocadaAte, criadaEm) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(id, atividadeId, participanteId, status, posicaoNaEspera, convocadaAte, criadaEm);
}

function semearUsuario(banco, id, nome, papel) {
  banco.prepare('INSERT INTO usuarios (id, nome, papel) VALUES (?, ?, ?)').run(id, nome, papel);
}

async function fixarRelogio(base, agora) {
  await fetch(`${base}/_teste/relogio`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agora }),
  });
}

const ROTAS_M3 = [
  { metodo: 'GET', rota: '/encontros/enc_inexistente/codigo' },
  { metodo: 'POST', rota: '/encontros/enc_inexistente/presencas' },
  { metodo: 'POST', rota: '/encontros/enc_inexistente/presencas/manual' },
  { metodo: 'GET', rota: '/encontros/enc_inexistente/presencas' },
];

test('R2: nas quatro rotas de M3, sem X-Usuario valido -> 401 USUARIO_DESCONHECIDO', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    for (const { metodo, rota } of ROTAS_M3) {
      const semCabecalho = await fetch(`${servidor.base}${rota}`, { method: metodo });
      assert.equal(semCabecalho.status, 401, `${metodo} ${rota} sem cabecalho`);
      assert.equal((await semCabecalho.json()).erro, 'USUARIO_DESCONHECIDO', `${metodo} ${rota} sem cabecalho`);

      const usuarioDesconhecido = await fetch(`${servidor.base}${rota}`, {
        method: metodo,
        headers: { 'X-Usuario': 'nao-existe' },
      });
      assert.equal(usuarioDesconhecido.status, 401, `${metodo} ${rota} usuario desconhecido`);
      assert.equal(
        (await usuarioDesconhecido.json()).erro,
        'USUARIO_DESCONHECIDO',
        `${metodo} ${rota} usuario desconhecido`,
      );
    }
  } finally {
    await servidor.fechar();
  }
});

test('R2: perfil trocado nas quatro rotas de M3 -> 403 com o erro do papel, antes da existencia', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const casos = [
      { metodo: 'GET', rota: '/encontros/enc_inexistente/codigo', usuario: 'p-carla', erro: 'SOMENTE_ORGANIZACAO' },
      { metodo: 'POST', rota: '/encontros/enc_inexistente/presencas', usuario: 'org-ana', erro: 'SOMENTE_PARTICIPANTE' },
      { metodo: 'POST', rota: '/encontros/enc_inexistente/presencas/manual', usuario: 'p-carla', erro: 'SOMENTE_ORGANIZACAO' },
      { metodo: 'GET', rota: '/encontros/enc_inexistente/presencas', usuario: 'p-carla', erro: 'SOMENTE_ORGANIZACAO' },
    ];

    for (const { metodo, rota, usuario, erro } of casos) {
      const res = await fetch(`${servidor.base}${rota}`, {
        method: metodo,
        headers: { 'X-Usuario': usuario },
      });
      assert.equal(res.status, 403, `${metodo} ${rota} como ${usuario}`);
      assert.equal((await res.json()).erro, erro, `${metodo} ${rota} como ${usuario}`);
    }
  } finally {
    await servidor.fechar();
  }
});

test('R3: nas quatro rotas de M3, encontro inexistente -> 404 NAO_ENCONTRADO', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const casos = [
      { metodo: 'GET', rota: '/encontros/enc_inexistente/codigo', usuario: 'org-ana' },
      { metodo: 'POST', rota: '/encontros/enc_inexistente/presencas', usuario: 'p-carla' },
      { metodo: 'POST', rota: '/encontros/enc_inexistente/presencas/manual', usuario: 'org-ana' },
      { metodo: 'GET', rota: '/encontros/enc_inexistente/presencas', usuario: 'org-ana' },
    ];

    for (const { metodo, rota, usuario } of casos) {
      const res = await fetch(`${servidor.base}${rota}`, {
        method: metodo,
        headers: { 'X-Usuario': usuario },
      });
      assert.equal(res.status, 404, `${metodo} ${rota}`);
      assert.equal((await res.json()).erro, 'NAO_ENCONTRADO', `${metodo} ${rota}`);
    }
  } finally {
    await servidor.fechar();
  }
});

test('R25: corpo que nao e JSON nas duas POST do M3 -> 422 DADOS_INVALIDOS com {"erro", "mensagem"}, nunca 400 text/html', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r25',
      titulo: 'Atividade R25',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_r25', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });

    const casos = [
      { rota: '/encontros/enc_r25/presencas', usuario: 'p-carla', descricao: 'POST presencas QR' },
      { rota: '/encontros/enc_r25/presencas/manual', usuario: 'org-ana', descricao: 'POST presencas manual' },
    ];

    for (const { rota, usuario, descricao } of casos) {
      const res = await fetch(`${servidor.base}${rota}`, {
        method: 'POST',
        headers: { 'X-Usuario': usuario, 'Content-Type': 'application/json' },
        body: '{ nao e json',
      });
      assert.equal(res.status, 422, `${descricao}: corpo nao-JSON`);
      assert.match(
        res.headers.get('content-type') || '',
        /application\/json/,
        `${descricao}: resposta e JSON, nao text/html`,
      );
      const corpo = await res.json();
      assert.equal(corpo.erro, 'DADOS_INVALIDOS', `${descricao}: erro do contrato`);
      assert.equal(typeof corpo.mensagem, 'string', `${descricao}: mensagem presente`);
      assert.ok(corpo.mensagem.length > 0, `${descricao}: mensagem nao vazia`);
    }
  } finally {
    await servidor.fechar();
  }
});

test('R11: no mesmo minuto o codigo e estavel; um minuto depois ele muda', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r11',
      titulo: 'Atividade R11',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_r11', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });

    await fixarRelogio(servidor.base, '2026-10-20T19:03:10-03:00');
    const primeira = await fetch(`${servidor.base}/encontros/enc_r11/codigo`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(primeira.status, 200);
    const codigo1 = await primeira.json();
    assert.equal(codigo1.encontroId, 'enc_r11');
    assert.equal(codigo1.codigo.length, 6);
    assert.match(codigo1.codigo, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);

    const segunda = await fetch(`${servidor.base}/encontros/enc_r11/codigo`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(segunda.status, 200);
    const codigo2 = await segunda.json();
    assert.equal(codigo2.codigo, codigo1.codigo, 'mesmo minuto devolve o mesmo codigo');
    assert.equal(codigo2.trocaEm, codigo1.trocaEm, 'mesmo minuto devolve o mesmo trocaEm');
    assert.equal(codigo2.validoAte, codigo1.validoAte, 'mesmo minuto devolve o mesmo validoAte');

    await fixarRelogio(servidor.base, '2026-10-20T19:04:10-03:00');
    const terceira = await fetch(`${servidor.base}/encontros/enc_r11/codigo`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(terceira.status, 200);
    const codigo3 = await terceira.json();
    assert.notEqual(codigo3.codigo, codigo1.codigo, 'um minuto depois o codigo muda');
  } finally {
    await servidor.fechar();
  }
});

test('R12: trocaEm e validoAte da janela corrente tem um minuto de sobreposicao; o codigo vencido ja nao sai em 19:05:00', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r12',
      titulo: 'Atividade R12',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_r12', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });

    await fixarRelogio(servidor.base, '2026-10-20T19:03:20-03:00');
    const resposta = await fetch(`${servidor.base}/encontros/enc_r12/codigo`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(resposta.status, 200);
    const codigo = await resposta.json();
    assert.equal(
      Date.parse(codigo.trocaEm),
      Date.parse('2026-10-20T19:04:00-03:00'),
      'trocaEm e o fim do minuto corrente',
    );
    assert.equal(
      Date.parse(codigo.validoAte),
      Date.parse('2026-10-20T19:05:00-03:00'),
      'validoAte e trocaEm mais um minuto de sobreposicao',
    );

    await fixarRelogio(servidor.base, '2026-10-20T19:05:00-03:00');
    const aposVencer = await fetch(`${servidor.base}/encontros/enc_r12/codigo`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(aposVencer.status, 200);
    const codigoAposVencer = await aposVencer.json();
    assert.notEqual(
      codigoAposVencer.codigo,
      codigo.codigo,
      'o codigo obtido as 19:03:20 ja nao sai em 19:05:00',
    );
  } finally {
    await servidor.fechar();
  }
});

test('R7: a janela do obter codigo vai de 15 min antes a 30 min depois do inicio, bordas incluidas', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r7',
      titulo: 'Atividade R7',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_r7', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });

    const casos = [
      { agora: '2026-10-20T18:45:00-03:00', status: 200, erro: null },
      { agora: '2026-10-20T18:44:59-03:00', status: 422, erro: 'FORA_DA_JANELA' },
      { agora: '2026-10-20T19:30:00-03:00', status: 200, erro: null },
      { agora: '2026-10-20T19:30:01-03:00', status: 422, erro: 'FORA_DA_JANELA' },
    ];

    for (const { agora, status, erro } of casos) {
      await fixarRelogio(servidor.base, agora);
      const res = await fetch(`${servidor.base}/encontros/enc_r7/codigo`, {
        headers: { 'X-Usuario': 'org-ana' },
      });
      assert.equal(res.status, status, agora);
      if (erro) {
        assert.equal((await res.json()).erro, erro, agora);
      } else {
        assert.equal((await res.json()).encontroId, 'enc_r7', agora);
      }
    }
  } finally {
    await servidor.fechar();
  }
});

test('R8: atividade cancelada recusa o obter codigo com ATIVIDADE_CANCELADA, antes de FORA_DA_JANELA', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r8_canc',
      titulo: 'Atividade R8 Cancelada',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      cancelada: 1,
      encontros: [
        { id: 'enc_r8', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });

    const casos = [
      { agora: '2026-10-20T19:00:00-03:00', descricao: 'dentro da janela' },
      { agora: '2026-10-20T20:00:00-03:00', descricao: 'fora da janela, depois do inicio + 30min' },
    ];

    for (const { agora, descricao } of casos) {
      await fixarRelogio(servidor.base, agora);
      const res = await fetch(`${servidor.base}/encontros/enc_r8/codigo`, {
        headers: { 'X-Usuario': 'org-ana' },
      });
      assert.equal(res.status, 422, descricao);
      assert.equal((await res.json()).erro, 'ATIVIDADE_CANCELADA', descricao);
    }
  } finally {
    await servidor.fechar();
  }
});

test('R8 parte 2: atividade cancelada pela rota do M1 -> presenca por QR e manual devolvem 403 NAO_INSCRITO (bloqueio herdado do M2)', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r8p2',
      titulo: 'Atividade R8 Parte 2',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      cancelada: 0,
      encontros: [
        { id: 'enc_r8p2', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    semearInscricao(banco, {
      id: 'ins_r8p2_0',
      atividadeId: 'atv_r8p2',
      participanteId: 'p-carla',
      status: 'confirmada',
    });

    await fixarRelogio(servidor.base, '2026-10-20T18:45:00-03:00');
    const respostaCodigo = await fetch(`${servidor.base}/encontros/enc_r8p2/codigo`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(respostaCodigo.status, 200, 'o codigo sai enquanto a atividade esta ativa');
    const { codigo } = await respostaCodigo.json();

    const cancelamento = await fetch(`${servidor.base}/atividades/atv_r8p2/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(cancelamento.status, 200, 'cancelamento antes do inicio funciona');

    const inscricoes = await fetch(`${servidor.base}/inscricoes?atividadeId=atv_r8p2`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal((await inscricoes.json())[0].status, 'cancelada', 'R11 do M2: o cancelamento da atividade cancela a inscricao ativa');

    await fixarRelogio(servidor.base, '2026-10-20T18:46:00-03:00');
    const qr = await fetch(`${servidor.base}/encontros/enc_r8p2/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla', 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo }),
    });
    assert.equal(qr.status, 403, 'QR em atividade cancelada');
    assert.equal((await qr.json()).erro, 'NAO_INSCRITO', 'QR em atividade cancelada');

    const manual = await fetch(`${servidor.base}/encontros/enc_r8p2/presencas/manual`, {
      method: 'POST',
      headers: { 'X-Usuario': 'org-ana', 'Content-Type': 'application/json' },
      body: JSON.stringify({ participanteId: 'p-carla', justificativa: '123456789012' }),
    });
    assert.equal(manual.status, 403, 'presenca manual em atividade cancelada');
    assert.equal((await manual.json()).erro, 'NAO_INSCRITO', 'presenca manual em atividade cancelada');
  } finally {
    await servidor.fechar();
  }
});

test('infra: POST /_teste/reset limpa a tabela presencas', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_reset',
      titulo: 'Atividade Reset',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_reset', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    banco
      .prepare(
        'INSERT INTO presencas (id, encontroId, participanteId, origem, lidoEm, registradaEm, justificativa) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        'pre_reset',
        'enc_reset',
        'p-carla',
        'qr',
        '2026-10-20T19:00:00-03:00',
        '2026-10-20T19:00:00-03:00',
        null,
      );

    assert.equal(banco.prepare('SELECT COUNT(*) AS total FROM presencas').get().total, 1);

    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    assert.equal(banco.prepare('SELECT COUNT(*) AS total FROM presencas').get().total, 0);
  } finally {
    await servidor.fechar();
  }
});

test('R6: so inscricao confirmada registra presenca por QR; os demais status -> 403 NAO_INSCRITO', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r6',
      titulo: 'Atividade R6',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_r6', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    const inscricoes = [
      { participanteId: 'p-carla', status: 'confirmada' },
      { participanteId: 'p-diego', status: 'em_espera' },
      { participanteId: 'p-elisa', status: 'convocada' },
      { participanteId: 'p-fabio', status: 'cancelada' },
      { participanteId: 'p-gabriela', status: 'expirada' },
    ];
    for (const [indice, { participanteId, status }] of inscricoes.entries()) {
      semearInscricao(banco, {
        id: `ins_r6_${indice}`,
        atividadeId: 'atv_r6',
        participanteId,
        status,
        posicaoNaEspera: status === 'em_espera' ? 1 : null,
      });
    }

    await fixarRelogio(servidor.base, '2026-10-20T19:00:00-03:00');
    const respostaCodigo = await fetch(`${servidor.base}/encontros/enc_r6/codigo`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(respostaCodigo.status, 200);
    const { codigo } = await respostaCodigo.json();

    const confirmada = await fetch(`${servidor.base}/encontros/enc_r6/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla', 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo }),
    });
    assert.equal(confirmada.status, 201);
    const presenca = await confirmada.json();
    assert.match(presenca.id, /^pre_[0-9a-f]{8}$/);
    assert.deepEqual(presenca, {
      id: presenca.id,
      encontroId: 'enc_r6',
      participanteId: 'p-carla',
      origem: 'qr',
      lidoEm: presenca.registradaEm,
      registradaEm: presenca.registradaEm,
      justificativa: null,
    });

    const recusados = [
      { participanteId: 'p-diego', status: 'em_espera' },
      { participanteId: 'p-elisa', status: 'convocada' },
      { participanteId: 'p-fabio', status: 'cancelada' },
      { participanteId: 'p-gabriela', status: 'expirada' },
      { participanteId: 'p-heitor', status: 'sem inscricao' },
    ];
    for (const { participanteId, status } of recusados) {
      const res = await fetch(`${servidor.base}/encontros/enc_r6/presencas`, {
        method: 'POST',
        headers: { 'X-Usuario': participanteId, 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo }),
      });
      assert.equal(res.status, 403, `${participanteId} (${status})`);
      assert.equal((await res.json()).erro, 'NAO_INSCRITO', `${participanteId} (${status})`);
    }
  } finally {
    await servidor.fechar();
  }
});

test('R9: janela do QR vai de 15 min antes a 30 min depois do inicio, bordas incluidas', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r9',
      titulo: 'Atividade R9',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_r9', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    for (const [indice, participanteId] of ['p-carla', 'p-diego', 'p-elisa', 'p-fabio'].entries()) {
      semearInscricao(banco, {
        id: `ins_r9_${indice}`,
        atividadeId: 'atv_r9',
        participanteId,
        status: 'confirmada',
      });
    }

    const casos = [
      { agora: '2026-10-20T18:45:00-03:00', usuario: 'p-carla', status: 201, erro: null },
      { agora: '2026-10-20T18:44:59-03:00', usuario: 'p-diego', status: 422, erro: 'FORA_DA_JANELA' },
      { agora: '2026-10-20T19:30:00-03:00', usuario: 'p-elisa', status: 201, erro: null },
      { agora: '2026-10-20T19:30:01-03:00', usuario: 'p-fabio', status: 422, erro: 'FORA_DA_JANELA' },
    ];

    for (const { agora, usuario, status, erro } of casos) {
      await fixarRelogio(servidor.base, agora);
      let codigo = 'ZZZZZZ';
      if (status === 201) {
        const respostaCodigo = await fetch(`${servidor.base}/encontros/enc_r9/codigo`, {
          headers: { 'X-Usuario': 'org-ana' },
        });
        assert.equal(respostaCodigo.status, 200, `${agora}: o codigo deveria sair na borda`);
        codigo = (await respostaCodigo.json()).codigo;
      }
      const res = await fetch(`${servidor.base}/encontros/enc_r9/presencas`, {
        method: 'POST',
        headers: { 'X-Usuario': usuario, 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo }),
      });
      assert.equal(res.status, status, agora);
      if (erro) {
        assert.equal((await res.json()).erro, erro, agora);
      } else {
        assert.equal((await res.json()).origem, 'qr', agora);
      }
    }
  } finally {
    await servidor.fechar();
  }
});

test('R5: codigo ausente ou nao-string -> DADOS_INVALIDOS; string curta ou de outro encontro -> CODIGO_INVALIDO', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r5',
      titulo: 'Atividade R5',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_r5', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    semearAtividade(banco, {
      id: 'atv_r5b',
      titulo: 'Atividade R5b',
      tipo: 'palestra',
      salaId: 'sala-101',
      vagas: 10,
      encontros: [
        { id: 'enc_r5b', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    const participantes = ['p-carla', 'p-diego', 'p-elisa', 'p-fabio'];
    for (const [indice, participanteId] of participantes.entries()) {
      semearInscricao(banco, {
        id: `ins_r5_${indice}`,
        atividadeId: 'atv_r5',
        participanteId,
        status: 'confirmada',
      });
    }

    await fixarRelogio(servidor.base, '2026-10-20T19:00:00-03:00');
    const pegarCodigo = async (encontroId) => {
      const res = await fetch(`${servidor.base}/encontros/${encontroId}/codigo`, {
        headers: { 'X-Usuario': 'org-ana' },
      });
      assert.equal(res.status, 200);
      return (await res.json()).codigo;
    };
    const codigoDeOutro = await pegarCodigo('enc_r5b');

    const casos = [
      { corpo: {}, erro: 'DADOS_INVALIDOS', descricao: 'codigo ausente' },
      { corpo: { codigo: 123456 }, erro: 'DADOS_INVALIDOS', descricao: 'codigo nao-string' },
      { corpo: { codigo: 'ABC' }, erro: 'CODIGO_INVALIDO', descricao: 'codigo de 3 letras' },
      { corpo: { codigo: codigoDeOutro }, erro: 'CODIGO_INVALIDO', descricao: 'codigo de outro encontro' },
    ];

    for (const [indice, { corpo, erro, descricao }] of casos.entries()) {
      const res = await fetch(`${servidor.base}/encontros/enc_r5/presencas`, {
        method: 'POST',
        headers: { 'X-Usuario': participantes[indice], 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      assert.equal(res.status, 422, descricao);
      assert.equal((await res.json()).erro, erro, descricao);
    }
  } finally {
    await servidor.fechar();
  }
});

test('R12: aceita o codigo do minuto corrente e o do minuto anterior; em validoAte ja recusa', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r12qr',
      titulo: 'Atividade R12 QR',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_r12qr', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    const participantes = ['p-carla', 'p-diego', 'p-elisa'];
    for (const [indice, participanteId] of participantes.entries()) {
      semearInscricao(banco, {
        id: `ins_r12qr_${indice}`,
        atividadeId: 'atv_r12qr',
        participanteId,
        status: 'confirmada',
      });
    }

    await fixarRelogio(servidor.base, '2026-10-20T19:03:20-03:00');
    const respostaCodigo = await fetch(`${servidor.base}/encontros/enc_r12qr/codigo`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(respostaCodigo.status, 200);
    const { codigo } = await respostaCodigo.json();

    const registrar = (usuario) =>
      fetch(`${servidor.base}/encontros/enc_r12qr/presencas`, {
        method: 'POST',
        headers: { 'X-Usuario': usuario, 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo }),
      });

    await fixarRelogio(servidor.base, '2026-10-20T19:03:59-03:00');
    const noCorrente = await registrar('p-carla');
    assert.equal(noCorrente.status, 201, 'no minuto corrente ainda vale');

    await fixarRelogio(servidor.base, '2026-10-20T19:04:59-03:00');
    const noAnterior = await registrar('p-diego');
    assert.equal(noAnterior.status, 201, 'no minuto anterior (sobreposicao) ainda vale');

    await fixarRelogio(servidor.base, '2026-10-20T19:05:00-03:00');
    const emValidoAte = await registrar('p-elisa');
    assert.equal(emValidoAte.status, 422, 'em validoAte o codigo deixa de valer');
    assert.equal((await emValidoAte.json()).erro, 'CODIGO_INVALIDO');
  } finally {
    await servidor.fechar();
  }
});

test('R13: a comparacao normaliza caixa e espaços; caractere fora do alfabeto -> CODIGO_INVALIDO', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r13',
      titulo: 'Atividade R13',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_r13', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    const participantes = ['p-carla', 'p-diego', 'p-elisa'];
    for (const [indice, participanteId] of participantes.entries()) {
      semearInscricao(banco, {
        id: `ins_r13_${indice}`,
        atividadeId: 'atv_r13',
        participanteId,
        status: 'confirmada',
      });
    }

    await fixarRelogio(servidor.base, '2026-10-20T19:00:00-03:00');
    const respostaCodigo = await fetch(`${servidor.base}/encontros/enc_r13/codigo`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(respostaCodigo.status, 200);
    const { codigo } = await respostaCodigo.json();

    const registrar = (usuario, valor) =>
      fetch(`${servidor.base}/encontros/enc_r13/presencas`, {
        method: 'POST',
        headers: { 'X-Usuario': usuario, 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: valor }),
      });

    const minusculasComEspacos = await registrar('p-carla', ` ${codigo.toLowerCase()} `);
    assert.equal(minusculasComEspacos.status, 201, 'minusculas com espacos nas bordas');

    const espacoNoMeio = await registrar('p-diego', `${codigo.slice(0, 3)} ${codigo.slice(3)}`);
    assert.equal(espacoNoMeio.status, 201, 'espaco no meio e descartado');

    const foraDoAlfabeto = await registrar('p-elisa', `0${codigo.slice(1)}`);
    assert.equal(foraDoAlfabeto.status, 422);
    assert.equal((await foraDoAlfabeto.json()).erro, 'CODIGO_INVALIDO');
  } finally {
    await servidor.fechar();
  }
});

test('R17 e R24: primeiro QR devolve 201 origem qr; repetir devolve 200 com a mesma presenca, sem duplicar', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r17',
      titulo: 'Atividade R17',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_r17', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    semearInscricao(banco, {
      id: 'ins_r17_0',
      atividadeId: 'atv_r17',
      participanteId: 'p-carla',
      status: 'confirmada',
    });

    await fixarRelogio(servidor.base, '2026-10-20T19:00:00-03:00');
    const respostaCodigo = await fetch(`${servidor.base}/encontros/enc_r17/codigo`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(respostaCodigo.status, 200);
    const { codigo } = await respostaCodigo.json();

    const enviar = () =>
      fetch(`${servidor.base}/encontros/enc_r17/presencas`, {
        method: 'POST',
        headers: { 'X-Usuario': 'p-carla', 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo }),
      });

    const primeira = await enviar();
    assert.equal(primeira.status, 201);
    const presenca = await primeira.json();
    assert.equal(presenca.origem, 'qr');
    assert.equal(presenca.lidoEm, presenca.registradaEm);

    const repetida = await enviar();
    assert.equal(repetida.status, 200);
    assert.deepEqual(await repetida.json(), presenca, 'a repeticao devolve a mesma presenca, inalterada');

    const total = banco
      .prepare('SELECT COUNT(*) AS total FROM presencas WHERE encontroId = ? AND participanteId = ?')
      .get('enc_r17', 'p-carla').total;
    assert.equal(total, 1, 'nao cria presenca duplicada');
  } finally {
    await servidor.fechar();
  }
});

test('R23: codigo vencido e recusado mesmo sem ninguem ter buscado a rotacao', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r23',
      titulo: 'Atividade R23',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_r23', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    semearInscricao(banco, {
      id: 'ins_r23_0',
      atividadeId: 'atv_r23',
      participanteId: 'p-carla',
      status: 'confirmada',
    });

    await fixarRelogio(servidor.base, '2026-10-20T19:00:00-03:00');
    const respostaCodigo = await fetch(`${servidor.base}/encontros/enc_r23/codigo`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(respostaCodigo.status, 200);
    const { codigo } = await respostaCodigo.json();

    await fixarRelogio(servidor.base, '2026-10-20T19:10:00-03:00');
    const res = await fetch(`${servidor.base}/encontros/enc_r23/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla', 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo }),
    });
    assert.equal(res.status, 422);
    assert.equal((await res.json()).erro, 'CODIGO_INVALIDO');
  } finally {
    await servidor.fechar();
  }
});

test('R1: registrar presenca por QR nao altera a inscricao deixada pelo M2', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r1',
      titulo: 'Atividade R1',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_r1', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    semearInscricao(banco, {
      id: 'ins_r1_0',
      atividadeId: 'atv_r1',
      participanteId: 'p-carla',
      status: 'confirmada',
    });
    const lerInscricao = () =>
      banco
        .prepare(
          'SELECT id, atividadeId, participanteId, status, posicaoNaEspera, convocadaAte, criadaEm FROM inscricoes WHERE id = ?',
        )
        .get('ins_r1_0');
    const antes = lerInscricao();

    await fixarRelogio(servidor.base, '2026-10-20T19:00:00-03:00');
    const respostaCodigo = await fetch(`${servidor.base}/encontros/enc_r1/codigo`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(respostaCodigo.status, 200);
    const { codigo } = await respostaCodigo.json();

    const res = await fetch(`${servidor.base}/encontros/enc_r1/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla', 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo }),
    });
    assert.equal(res.status, 201);

    assert.deepEqual(lerInscricao(), antes, 'a inscricao permanece identica depois do registro');
    assert.equal(antes.status, 'confirmada');
  } finally {
    await servidor.fechar();
  }
});

test('R4: POST presencas com lidoEm nao-string ou que nao da para interpretar como data -> 422 DADOS_INVALIDOS', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r4',
      titulo: 'Atividade R4',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_r4', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    semearInscricao(banco, {
      id: 'ins_r4_0',
      atividadeId: 'atv_r4',
      participanteId: 'p-carla',
      status: 'confirmada',
    });

    await fixarRelogio(servidor.base, '2026-10-20T19:00:00-03:00');
    const respostaCodigo = await fetch(`${servidor.base}/encontros/enc_r4/codigo`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(respostaCodigo.status, 200);
    const { codigo } = await respostaCodigo.json();

    const casos = [
      { corpo: { codigo, lidoEm: 123 }, descricao: 'lidoEm nao-string' },
      { corpo: { codigo, lidoEm: 'abc' }, descricao: 'lidoEm nao interpretavel como data' },
    ];
    for (const { corpo, descricao } of casos) {
      const res = await fetch(`${servidor.base}/encontros/enc_r4/presencas`, {
        method: 'POST',
        headers: { 'X-Usuario': 'p-carla', 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      assert.equal(res.status, 422, descricao);
      assert.equal((await res.json()).erro, 'DADOS_INVALIDOS', descricao);
    }
  } finally {
    await servidor.fechar();
  }
});

test('R14: o lidoEm anterior ao envio guia a janela e a validade do codigo; sem lidoEm o envio vale o instante do envio', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r14',
      titulo: 'Atividade R14',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_r14', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    for (const [indice, participanteId] of ['p-carla', 'p-diego'].entries()) {
      semearInscricao(banco, {
        id: `ins_r14_${indice}`,
        atividadeId: 'atv_r14',
        participanteId,
        status: 'confirmada',
      });
    }

    await fixarRelogio(servidor.base, '2026-10-20T19:20:00-03:00');
    const respostaCodigo = await fetch(`${servidor.base}/encontros/enc_r14/codigo`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(respostaCodigo.status, 200);
    const { codigo } = await respostaCodigo.json();

    await fixarRelogio(servidor.base, '2026-10-20T20:00:00-03:00');
    const comLidoEm = await fetch(`${servidor.base}/encontros/enc_r14/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla', 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo, lidoEm: '2026-10-20T19:20:00-03:00' }),
    });
    assert.equal(comLidoEm.status, 201, 'fora da janela do envio, mas dentro no lidoEm: registra');
    const presenca = await comLidoEm.json();
    assert.equal(presenca.origem, 'qr_offline', 'o corpo trouxe lidoEm: origem qr_offline');
    assert.equal(presenca.lidoEm, '2026-10-20T19:20:00-03:00', 'lidoEm guardado e o instante da leitura (valor do corpo)');

    const semLidoEm = await fetch(`${servidor.base}/encontros/enc_r14/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego', 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo }),
    });
    assert.equal(semLidoEm.status, 422, 'sem lidoEm o instante que vale e o do envio (20:00)');
    assert.equal((await semLidoEm.json()).erro, 'FORA_DA_JANELA');
  } finally {
    await servidor.fechar();
  }
});

test('R15 e R24: lidoEm adiantado nao e erro, vale o instante do envio; origem qr_offline e lidoEm guardado = envio', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r15',
      titulo: 'Atividade R15',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_r15', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    semearInscricao(banco, {
      id: 'ins_r15_0',
      atividadeId: 'atv_r15',
      participanteId: 'p-carla',
      status: 'confirmada',
    });

    await fixarRelogio(servidor.base, '2026-10-20T19:00:00-03:00');
    const respostaCodigo = await fetch(`${servidor.base}/encontros/enc_r15/codigo`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(respostaCodigo.status, 200);
    const { codigo } = await respostaCodigo.json();

    const res = await fetch(`${servidor.base}/encontros/enc_r15/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla', 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo, lidoEm: '2026-10-20T20:00:00-03:00' }),
    });
    assert.equal(res.status, 201, 'lidoEm no futuro nao e erro');
    const presenca = await res.json();
    assert.equal(presenca.origem, 'qr_offline', 'o corpo trouxe lidoEm, mesmo adiantado');
    assert.equal(presenca.lidoEm, presenca.registradaEm, 'lidoEm guardado = o instante do envio');
    assert.equal(
      Date.parse(presenca.lidoEm),
      Date.parse('2026-10-20T19:00:00-03:00'),
      'lidoEm guardado e o envio, nao o valor cru adiantado',
    );
  } finally {
    await servidor.fechar();
  }
});

test('R16: envio com lidoEm e aceito ate o fim do encontro + 2h; dali em diante e SINCRONIZACAO_TARDIA (limite preso ao fim)', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r16',
      titulo: 'Atividade R16',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_r16', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    for (const [indice, participanteId] of ['p-carla', 'p-diego', 'p-elisa'].entries()) {
      semearInscricao(banco, {
        id: `ins_r16_${indice}`,
        atividadeId: 'atv_r16',
        participanteId,
        status: 'confirmada',
      });
    }

    await fixarRelogio(servidor.base, '2026-10-20T19:10:00-03:00');
    const respostaCodigo = await fetch(`${servidor.base}/encontros/enc_r16/codigo`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(respostaCodigo.status, 200);
    const { codigo } = await respostaCodigo.json();
    const lidoEm = '2026-10-20T19:10:00-03:00';

    const enviar = (participanteId) =>
      fetch(`${servidor.base}/encontros/enc_r16/presencas`, {
        method: 'POST',
        headers: { 'X-Usuario': participanteId, 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, lidoEm }),
      });

    await fixarRelogio(servidor.base, '2026-10-20T23:59:00-03:00');
    const antesDoLimite = await enviar('p-carla');
    assert.equal(antesDoLimite.status, 201, '23:59 ainda e aceito (22:00 + 2h)');

    await fixarRelogio(servidor.base, '2026-10-21T00:00:00-03:00');
    const noLimite = await enviar('p-diego');
    assert.equal(noLimite.status, 201, 'fim + 2h exato ainda e aceito');

    await fixarRelogio(servidor.base, '2026-10-21T00:00:01-03:00');
    const tardio = await enviar('p-elisa');
    assert.equal(tardio.status, 422, 'depois de fim + 2h e tardio, mesmo com lidoEm dentro da janela');
    assert.equal((await tardio.json()).erro, 'SINCRONIZACAO_TARDIA');
  } finally {
    await servidor.fechar();
  }
});

test('R20: ordem da rota QR — NAO_INSCRITO, presenca existente, SINCRONIZACAO_TARDIA, FORA_DA_JANELA, CODIGO_INVALIDO', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r20',
      titulo: 'Atividade R20',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_r20', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    for (const [indice, participanteId] of ['p-carla', 'p-diego', 'p-elisa'].entries()) {
      semearInscricao(banco, {
        id: `ins_r20_${indice}`,
        atividadeId: 'atv_r20',
        participanteId,
        status: 'confirmada',
      });
    }
    const enviar = (participanteId, corpo) =>
      fetch(`${servidor.base}/encontros/enc_r20/presencas`, {
        method: 'POST',
        headers: { 'X-Usuario': participanteId, 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });

    await fixarRelogio(servidor.base, '2026-10-20T19:00:00-03:00');
    const respostaCodigo = await fetch(`${servidor.base}/encontros/enc_r20/codigo`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(respostaCodigo.status, 200);
    const { codigo } = await respostaCodigo.json();

    const naoInscrito = await enviar('p-heitor', { codigo: 'ZZZZZZ' });
    assert.equal(naoInscrito.status, 403, 'nao inscrito com codigo invalido: NAO_INSCRITO vem antes de CODIGO_INVALIDO');
    assert.equal((await naoInscrito.json()).erro, 'NAO_INSCRITO');

    await fixarRelogio(servidor.base, '2026-10-20T19:45:00-03:00');
    const foraDaJanelaCodigoRuim = await enviar('p-elisa', { codigo: 'ZZZZZZ' });
    assert.equal(foraDaJanelaCodigoRuim.status, 422, 'inscrito fora da janela com codigo invalido: FORA_DA_JANELA vem antes');
    assert.equal((await foraDaJanelaCodigoRuim.json()).erro, 'FORA_DA_JANELA');

    await fixarRelogio(servidor.base, '2026-10-20T19:00:00-03:00');
    const primeira = await enviar('p-carla', { codigo });
    assert.equal(primeira.status, 201);

    await fixarRelogio(servidor.base, '2026-10-21T00:00:01-03:00');
    const reenvio = await enviar('p-carla', { codigo: 'ZZZZZZ', lidoEm: '2026-10-20T19:10:00-03:00' });
    assert.equal(reenvio.status, 200, 'presenca ja registrada para por aí, mesmo com lidoEm tardio e codigo invalido');

    const ambasRecusariam = await enviar('p-diego', { codigo: 'ZZZZZZ', lidoEm: '2026-10-20T18:00:00-03:00' });
    assert.equal(ambasRecusariam.status, 422, 'lidoEm fora da janela e envio apos fim + 2h: SINCRONIZACAO_TARDIA vence FORA_DA_JANELA');
    assert.equal((await ambasRecusariam.json()).erro, 'SINCRONIZACAO_TARDIA');
  } finally {
    await servidor.fechar();
  }
});

test('R18: presenca manual exige justificativa de no minimo 10 caracteres; ausente, vazia ou curta -> 422 JUSTIFICATIVA_OBRIGATORIA e com 12 caracteres -> 201', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r18',
      titulo: 'Atividade R18',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_r18', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    for (const [indice, participanteId] of ['p-carla', 'p-diego'].entries()) {
      semearInscricao(banco, {
        id: `ins_r18_${indice}`,
        atividadeId: 'atv_r18',
        participanteId,
        status: 'confirmada',
      });
    }

    await fixarRelogio(servidor.base, '2026-10-20T19:00:00-03:00');
    const enviar = (participanteId, corpo) =>
      fetch(`${servidor.base}/encontros/enc_r18/presencas/manual`, {
        method: 'POST',
        headers: { 'X-Usuario': 'org-ana', 'Content-Type': 'application/json' },
        body: JSON.stringify({ participanteId, ...corpo }),
      });

    const casos = [
      { corpo: {}, descricao: 'justificativa ausente' },
      { corpo: { justificativa: '' }, descricao: 'justificativa vazia' },
      { corpo: { justificativa: '123456789' }, descricao: 'justificativa com 9 caracteres' },
    ];
    for (const { corpo, descricao } of casos) {
      const res = await enviar('p-carla', corpo);
      assert.equal(res.status, 422, descricao);
      assert.equal((await res.json()).erro, 'JUSTIFICATIVA_OBRIGATORIA', descricao);
    }

    const valida = await enviar('p-diego', { justificativa: '123456789012' });
    assert.equal(valida.status, 201, 'justificativa com 12 caracteres registra');
    const presenca = await valida.json();
    assert.equal(presenca.participanteId, 'p-diego');
    assert.equal(presenca.justificativa, '123456789012');
  } finally {
    await servidor.fechar();
  }
});

test('R18: presenca manual com justificativa de tipo errado (numero, objeto) -> 422 DADOS_INVALIDOS; ausente continua JUSTIFICATIVA_OBRIGATORIA', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r18t',
      titulo: 'Atividade R18 Tipo',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_r18t', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    semearInscricao(banco, {
      id: 'ins_r18t_0',
      atividadeId: 'atv_r18t',
      participanteId: 'p-carla',
      status: 'confirmada',
    });

    await fixarRelogio(servidor.base, '2026-10-20T19:00:00-03:00');
    const enviar = (participanteId, corpo) =>
      fetch(`${servidor.base}/encontros/enc_r18t/presencas/manual`, {
        method: 'POST',
        headers: { 'X-Usuario': 'org-ana', 'Content-Type': 'application/json' },
        body: JSON.stringify({ participanteId, ...corpo }),
      });

    const tipoErrado = [
      { corpo: { justificativa: 123 }, descricao: 'justificativa numero' },
      { corpo: { justificativa: {} }, descricao: 'justificativa objeto' },
      { corpo: { justificativa: ['a', 'b'] }, descricao: 'justificativa lista' },
    ];
    for (const { corpo, descricao } of tipoErrado) {
      const res = await enviar('p-carla', corpo);
      assert.equal(res.status, 422, descricao);
      assert.equal((await res.json()).erro, 'DADOS_INVALIDOS', descricao);
    }

    const ausente = await enviar('p-carla', {});
    assert.equal(ausente.status, 422, 'justificativa ausente');
    assert.equal((await ausente.json()).erro, 'JUSTIFICATIVA_OBRIGATORIA', 'justificativa ausente');
  } finally {
    await servidor.fechar();
  }
});

test('R10: a janela da presenca manual vai de 15 min antes do inicio ate 2 horas depois do fim, bordas incluidas', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r10',
      titulo: 'Atividade R10',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 30,
      encontros: [
        { id: 'enc_r10', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    for (let i = 1; i <= 20; i += 1) {
      const id = i <= 7 ? ['p-carla', 'p-diego', 'p-elisa', 'p-fabio', 'p-gabriela', 'p-heitor', 'p-isadora'][i - 1] : `p-r10-${i}`;
      if (id.startsWith('p-r10')) semearUsuario(banco, id, `Participante R10 ${i}`, 'participante');
      semearInscricao(banco, {
        id: `ins_r10_${i}`,
        atividadeId: 'atv_r10',
        participanteId: id,
        status: 'confirmada',
      });
    }

    const casos = [
      { agora: '2026-10-20T18:45:00-03:00', participanteId: 'p-carla', status: 201, erro: null },
      { agora: '2026-10-20T18:44:59-03:00', participanteId: 'p-diego', status: 422, erro: 'FORA_DA_JANELA' },
      { agora: '2026-10-20T23:00:00-03:00', participanteId: 'p-elisa', status: 201, erro: null },
      { agora: '2026-10-21T00:00:01-03:00', participanteId: 'p-fabio', status: 422, erro: 'FORA_DA_JANELA' },
    ];

    for (const { agora, participanteId, status, erro } of casos) {
      await fixarRelogio(servidor.base, agora);
      const res = await fetch(`${servidor.base}/encontros/enc_r10/presencas/manual`, {
        method: 'POST',
        headers: { 'X-Usuario': 'org-ana', 'Content-Type': 'application/json' },
        body: JSON.stringify({ participanteId, justificativa: '123456789012' }),
      });
      assert.equal(res.status, status, agora);
      if (erro) {
        assert.equal((await res.json()).erro, erro, agora);
      } else {
        assert.equal((await res.json()).origem, 'manual', agora);
      }
    }
  } finally {
    await servidor.fechar();
  }
});

test('R6 na manual: quem e conferido e o participanteId do corpo, nao a organizacao chamadora — confirmada registra; demais status e sem inscricao dao 403 NAO_INSCRITO; participanteId ausente ou nao-string e DADOS_INVALIDOS', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r6m',
      titulo: 'Atividade R6 Manual',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_r6m', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    const inscricoes = [
      { participanteId: 'p-carla', status: 'confirmada' },
      { participanteId: 'p-diego', status: 'em_espera' },
      { participanteId: 'p-elisa', status: 'convocada' },
      { participanteId: 'p-fabio', status: 'cancelada' },
      { participanteId: 'p-gabriela', status: 'expirada' },
    ];
    for (const [indice, { participanteId, status }] of inscricoes.entries()) {
      semearInscricao(banco, {
        id: `ins_r6m_${indice}`,
        atividadeId: 'atv_r6m',
        participanteId,
        status,
        posicaoNaEspera: status === 'em_espera' ? 1 : null,
      });
    }

    await fixarRelogio(servidor.base, '2026-10-20T19:00:00-03:00');
    const enviar = (participanteId, corpo) =>
      fetch(`${servidor.base}/encontros/enc_r6m/presencas/manual`, {
        method: 'POST',
        headers: { 'X-Usuario': 'org-ana', 'Content-Type': 'application/json' },
        body: JSON.stringify({ participanteId, ...corpo }),
      });

    const semId = await enviar(undefined, { justificativa: '123456789012' });
    assert.equal(semId.status, 422, 'participanteId ausente');
    assert.equal((await semId.json()).erro, 'DADOS_INVALIDOS');

    const idNum = await enviar(123, { justificativa: '123456789012' });
    assert.equal(idNum.status, 422, 'participanteId nao-string');
    assert.equal((await idNum.json()).erro, 'DADOS_INVALIDOS');

    const confirmada = await enviar('p-carla', { justificativa: '123456789012' });
    assert.equal(confirmada.status, 201, 'confirmada registra na manual');
    assert.equal((await confirmada.json()).participanteId, 'p-carla');

    const recusados = [
      { participanteId: 'p-diego', status: 'em_espera' },
      { participanteId: 'p-elisa', status: 'convocada' },
      { participanteId: 'p-fabio', status: 'cancelada' },
      { participanteId: 'p-gabriela', status: 'expirada' },
      { participanteId: 'p-heitor', status: 'sem inscricao' },
    ];
    for (const { participanteId, status } of recusados) {
      const res = await enviar(participanteId, { justificativa: '123456789012' });
      assert.equal(res.status, 403, `${participanteId} (${status})`);
      assert.equal((await res.json()).erro, 'NAO_INSCRITO', `${participanteId} (${status})`);
    }
  } finally {
    await servidor.fechar();
  }
});

test('R24: presenca manual nasce com origem manual, lidoEm igual ao instante do envio e justificativa preenchida', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r24m',
      titulo: 'Atividade R24 Manual',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_r24m', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    semearInscricao(banco, {
      id: 'ins_r24m_0',
      atividadeId: 'atv_r24m',
      participanteId: 'p-carla',
      status: 'confirmada',
    });

    await fixarRelogio(servidor.base, '2026-10-20T19:00:00-03:00');
    const res = await fetch(`${servidor.base}/encontros/enc_r24m/presencas/manual`, {
      method: 'POST',
      headers: { 'X-Usuario': 'org-ana', 'Content-Type': 'application/json' },
      body: JSON.stringify({ participanteId: 'p-carla', justificativa: '123456789012' }),
    });
    assert.equal(res.status, 201);
    const presenca = await res.json();
    assert.match(presenca.id, /^pre_[0-9a-f]{8}$/);
    assert.equal(presenca.encontroId, 'enc_r24m');
    assert.equal(presenca.participanteId, 'p-carla');
    assert.equal(presenca.origem, 'manual');
    assert.equal(presenca.justificativa, '123456789012');
    assert.equal(
      Date.parse(presenca.lidoEm),
      Date.parse('2026-10-20T19:00:00-03:00'),
      'lidoEm e o instante do envio que valeu para as regras',
    );
    assert.equal(
      Date.parse(presenca.lidoEm),
      Date.parse(presenca.registradaEm),
      'na manual nao ha leitura previa: lidoEm iguala o instante do registro',
    );
  } finally {
    await servidor.fechar();
  }
});

test('R19: limite de presencas manuais por encontro e 10% das confirmadas arredondado para cima (5 -> 1; 20 -> 2; 21 -> 3), e so as de origem manual contam', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    for (let i = 1; i <= 21; i += 1) {
      const id = `p-teto${String(i).padStart(2, '0')}`;
      semearUsuario(banco, id, `Participante Teto ${i}`, 'participante');
    }

    const cenarios = [
      { atividadeId: 'atv_teto1', encontroId: 'enc_teto1', confirmadas: 5, teto: 1 },
      { atividadeId: 'atv_teto2', encontroId: 'enc_teto2', confirmadas: 20, teto: 2 },
      { atividadeId: 'atv_teto3', encontroId: 'enc_teto3', confirmadas: 21, teto: 3 },
    ];
    for (const { atividadeId, encontroId, confirmadas, teto } of cenarios) {
      semearAtividade(banco, {
        id: atividadeId,
        titulo: `Atividade ${atividadeId}`,
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 30,
        encontros: [
          { id: encontroId, inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
        ],
      });
      for (let i = 1; i <= confirmadas; i += 1) {
        semearInscricao(banco, {
          id: `ins_${atividadeId}_${i}`,
          atividadeId,
          participanteId: `p-teto${String(i).padStart(2, '0')}`,
          status: 'confirmada',
        });
      }
    }

    await fixarRelogio(servidor.base, '2026-10-20T19:00:00-03:00');
    const registrar = (encontroId, participanteId) =>
      fetch(`${servidor.base}/encontros/${encontroId}/presencas/manual`, {
        method: 'POST',
        headers: { 'X-Usuario': 'org-ana', 'Content-Type': 'application/json' },
        body: JSON.stringify({ participanteId, justificativa: '123456789012' }),
      });

    for (const { encontroId, teto } of cenarios) {
      const participantes = Array.from(
        { length: teto + 1 },
        (_, i) => `p-teto${String(i + 1).padStart(2, '0')}`,
      );
      for (let i = 0; i < teto; i += 1) {
        const res = await registrar(encontroId, participantes[i]);
        assert.equal(
          res.status,
          201,
          `${encontroId}: a ${i + 1}a manual do teto ${teto} registra`,
        );
      }
      const estouro = await registrar(encontroId, participantes[teto]);
      assert.equal(
        estouro.status,
        422,
        `${encontroId}: a ${teto + 1}a manual do teto ${teto} estoura o limite`,
      );
      assert.equal((await estouro.json()).erro, 'LIMITE_DE_MANUAIS', encontroId);
    }
  } finally {
    await servidor.fechar();
  }
});

test('R21: ordem da rota manual — JUSTIFICATIVA_OBRIGATORIA antes da presenca existente, depois presenca (200), NAO_INSCRITO, FORA_DA_JANELA e LIMITE_DE_MANUAIS', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r21',
      titulo: 'Atividade R21',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_r21', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    for (const [indice, participanteId] of ['p-carla', 'p-diego', 'p-elisa', 'p-fabio', 'p-gabriela'].entries()) {
      semearInscricao(banco, {
        id: `ins_r21_${indice}`,
        atividadeId: 'atv_r21',
        participanteId,
        status: 'confirmada',
      });
    }

    const manual = (participanteId, justificativa) =>
      fetch(`${servidor.base}/encontros/enc_r21/presencas/manual`, {
        method: 'POST',
        headers: { 'X-Usuario': 'org-ana', 'Content-Type': 'application/json' },
        body: JSON.stringify({ participanteId, justificativa }),
      });

    await fixarRelogio(servidor.base, '2026-10-20T19:00:00-03:00');
    const respostaCodigo = await fetch(`${servidor.base}/encontros/enc_r21/codigo`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(respostaCodigo.status, 200);
    const { codigo } = await respostaCodigo.json();

    const qr = await fetch(`${servidor.base}/encontros/enc_r21/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla', 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo }),
    });
    assert.equal(qr.status, 201, 'p-carla registra por QR');

    const presencaExistenteComJustificativaCurta = await manual('p-carla', 'curta');
    assert.equal(
      presencaExistenteComJustificativaCurta.status,
      422,
      'presenca ja registrada com justificativa invalida: JUSTIFICATIVA_OBRIGATORIA vem antes do 200',
    );
    assert.equal((await presencaExistenteComJustificativaCurta.json()).erro, 'JUSTIFICATIVA_OBRIGATORIA');

    const presencaExistenteComJustificativaValida = await manual('p-carla', '123456789012');
    assert.equal(presencaExistenteComJustificativaValida.status, 200, 'ja registrado com justificativa valida devolve 200');
    const presenca = await presencaExistenteComJustificativaValida.json();
    assert.equal(presenca.origem, 'qr', 'a presenca de QR existente e preservada, nao vira manual');
    assert.equal(presenca.justificativa, null);

    const primeiraManual = await manual('p-fabio', '123456789012');
    assert.equal(primeiraManual.status, 201, 'a presenca de QR de p-carla nao ocupa o teto de manuais: p-fabio registra');
    assert.equal((await primeiraManual.json()).origem, 'manual');

    await fixarRelogio(servidor.base, '2026-10-21T00:00:01-03:00');
    const naoInscritoForaDaJanela = await manual('p-heitor', '123456789012');
    assert.equal(naoInscritoForaDaJanela.status, 403, 'nao inscrito fora da janela: NAO_INSCRITO vem antes de FORA_DA_JANELA');
    assert.equal((await naoInscritoForaDaJanela.json()).erro, 'NAO_INSCRITO');

    const inscritoForaComTetoCheio = await manual('p-diego', '123456789012');
    assert.equal(inscritoForaComTetoCheio.status, 422, 'inscrito fora da janela com teto cheio: FORA_DA_JANELA vem antes de LIMITE_DE_MANUAIS');
    assert.equal((await inscritoForaComTetoCheio.json()).erro, 'FORA_DA_JANELA');

    await fixarRelogio(servidor.base, '2026-10-20T19:00:00-03:00');
    const inscritoNaJanelaComTetoCheio = await manual('p-elisa', '123456789012');
    assert.equal(inscritoNaJanelaComTetoCheio.status, 422, 'inscrito na janela com teto cheio: LIMITE_DE_MANUAIS');
    assert.equal((await inscritoNaJanelaComTetoCheio.json()).erro, 'LIMITE_DE_MANUAIS');
  } finally {
    await servidor.fechar();
  }
});

test('R17: manual em cima de presenca de QR devolve 200 preservando origem qr e justificativa; QR em cima de manual preserva origem manual e a justificativa', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r17x',
      titulo: 'Atividade R17 Cruzamento',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 10,
      encontros: [
        { id: 'enc_r17x', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });
    for (const [indice, participanteId] of ['p-carla', 'p-diego'].entries()) {
      semearInscricao(banco, {
        id: `ins_r17x_${indice}`,
        atividadeId: 'atv_r17x',
        participanteId,
        status: 'confirmada',
      });
    }

    await fixarRelogio(servidor.base, '2026-10-20T19:00:00-03:00');
    const respostaCodigo = await fetch(`${servidor.base}/encontros/enc_r17x/codigo`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(respostaCodigo.status, 200);
    const { codigo } = await respostaCodigo.json();

    const qrDaCarla = await fetch(`${servidor.base}/encontros/enc_r17x/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla', 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo }),
    });
    assert.equal(qrDaCarla.status, 201);
    const presencaQr = await qrDaCarla.json();
    assert.equal(presencaQr.origem, 'qr');

    const manualSobreQr = await fetch(`${servidor.base}/encontros/enc_r17x/presencas/manual`, {
      method: 'POST',
      headers: { 'X-Usuario': 'org-ana', 'Content-Type': 'application/json' },
      body: JSON.stringify({ participanteId: 'p-carla', justificativa: '123456789012' }),
    });
    assert.equal(manualSobreQr.status, 200, 'manual em cima de QR devolve 200');
    assert.deepEqual(
      await manualSobreQr.json(),
      presencaQr,
      'preserve origem qr e justificativa null, sem criar outra',
    );

    const manualDoDiego = await fetch(`${servidor.base}/encontros/enc_r17x/presencas/manual`, {
      method: 'POST',
      headers: { 'X-Usuario': 'org-ana', 'Content-Type': 'application/json' },
      body: JSON.stringify({ participanteId: 'p-diego', justificativa: '123456789012' }),
    });
    assert.equal(manualDoDiego.status, 201);
    const presencaManual = await manualDoDiego.json();
    assert.equal(presencaManual.origem, 'manual');
    assert.equal(presencaManual.justificativa, '123456789012');

    const qrSobreManual = await fetch(`${servidor.base}/encontros/enc_r17x/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego', 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo }),
    });
    assert.equal(qrSobreManual.status, 200, 'QR em cima de manual devolve 200');
    assert.deepEqual(await qrSobreManual.json(), presencaManual, 'preserve origem manual e a justificativa');
  } finally {
    await servidor.fechar();
  }
});

test('R22: GET /encontros/:id/presencas devolve [Presenca] ordenado por nome do participante, com desempate por participanteId', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_r22',
      titulo: 'Atividade R22',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 20,
      encontros: [
        { id: 'enc_r22', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
      ],
    });

    const principais = [
      { id: 'p-ze', nome: 'Ana Beatriz', origemEsperada: 'qr' },
      { id: 'p-am', nome: 'Beatriz Souza', origemEsperada: 'manual' },
      { id: 'p-aa', nome: 'Carla Mendes', origemEsperada: 'qr_offline' },
      { id: 'p-bb', nome: 'Daniela Alves', origemEsperada: 'manual' },
      { id: 'p-cc', nome: 'Daniela Alves', origemEsperada: 'qr' },
    ];
    for (const p of principais) semearUsuario(banco, p.id, p.nome, 'participante');

    const extras = [];
    for (let i = 1; i <= 6; i += 1) {
      const id = `p-extra${String(i).padStart(2, '0')}`;
      extras.push(id);
      semearUsuario(banco, id, `Fulano Extra ${i}`, 'participante');
    }

    const inscritos = [...principais.map((p) => p.id), ...extras];
    for (const [indice, participanteId] of inscritos.entries()) {
      semearInscricao(banco, {
        id: `ins_r22_${indice}`,
        atividadeId: 'atv_r22',
        participanteId,
        status: 'confirmada',
      });
    }

    await fixarRelogio(servidor.base, '2026-10-20T19:00:00-03:00');
    const respostaCodigo = await fetch(`${servidor.base}/encontros/enc_r22/codigo`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(respostaCodigo.status, 200);
    const { codigo } = await respostaCodigo.json();

    const registrarQr = (participanteId, corpo = {}) =>
      fetch(`${servidor.base}/encontros/enc_r22/presencas`, {
        method: 'POST',
        headers: { 'X-Usuario': participanteId, 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, ...corpo }),
      });
    const registrarManual = (participanteId) =>
      fetch(`${servidor.base}/encontros/enc_r22/presencas/manual`, {
        method: 'POST',
        headers: { 'X-Usuario': 'org-ana', 'Content-Type': 'application/json' },
        body: JSON.stringify({ participanteId, justificativa: '123456789012' }),
      });

    const manuais = [
      { participanteId: 'p-bb', esperado: 201 },
      { participanteId: 'p-am', esperado: 201 },
    ];
    for (const { participanteId, esperado } of manuais) {
      const res = await registrarManual(participanteId);
      assert.equal(res.status, esperado, `manual ${participanteId}`);
    }
    const registrosQr = [
      { participanteId: 'p-ze', corpo: {} },
      { participanteId: 'p-aa', corpo: { lidoEm: '2026-10-20T19:00:00-03:00' } },
      { participanteId: 'p-cc', corpo: {} },
    ];
    for (const { participanteId, corpo } of registrosQr) {
      const res = await registrarQr(participanteId, corpo);
      assert.equal(res.status, 201, `qr ${participanteId}`);
    }

    const lista = await fetch(`${servidor.base}/encontros/enc_r22/presencas`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    assert.equal(lista.status, 200);
    const presencas = await lista.json();
    assert.equal(presencas.length, 5);

    assert.deepEqual(
      presencas.map((p) => p.participanteId),
      ['p-ze', 'p-am', 'p-aa', 'p-bb', 'p-cc'],
      'ordena por nome do participante; empate de nome resolvido por participanteId',
    );

    for (const esperada of principais) {
      const presenca = presencas.find((p) => p.participanteId === esperada.id);
      assert.equal(presenca.origem, esperada.origemEsperada, `origem de ${esperada.id}`);
      assert.deepEqual(
        Object.keys(presenca).sort(),
        ['encontroId', 'id', 'justificativa', 'lidoEm', 'origem', 'participanteId', 'registradaEm'],
        `${esperada.id} devolve Presenca do contrato, sem nome extra`,
      );
      assert.equal(presenca.encontroId, 'enc_r22');
    }
  } finally {
    await servidor.fechar();
  }
});
