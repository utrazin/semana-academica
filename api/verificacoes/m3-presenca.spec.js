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
