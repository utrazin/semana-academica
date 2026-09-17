import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarServidor } from '../src/app.js';
import { novoBanco } from '../src/banco.js';

process.env.MODO_TESTE = '1';

export async function subirServidor(opcoes) {
  const app = criarServidor(opcoes);
  const srv = app.listen(0);
  await new Promise((resolve) => srv.once('listening', resolve));
  return {
    base: `http://127.0.0.1:${srv.address().port}`,
    fechar: () => new Promise((resolve) => srv.close(resolve)),
  };
}

function corpoValido(sobrescreve = {}) {
  const corpo = {
    titulo: 'Flutter do zero',
    tipo: 'minicurso',
    salaId: 'lab-3',
    vagas: 10,
    encontros: [
      { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T20:00:00-03:00' },
      { inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T20:00:00-03:00' },
    ],
  };
  return { ...corpo, ...sobrescreve };
}

function encontrosDaSemana(quantidade) {
  const fias = (dia) => `2026-10-${dia}T19:00:00-03:00`;
  const fims = (dia) => `2026-10-${dia}T20:00:00-03:00`;
  const dias = [19, 20, 21, 22, 23];
  return dias.slice(0, quantidade).map((dia) => ({ inicio: fias(dia), fim: fims(dia) }));
}

function semearAtividade(banco, { id, titulo, tipo, salaId, vagas, cancelada = false, encontros }) {
  banco
    .prepare('INSERT INTO atividades (id, titulo, tipo, salaId, vagas, cancelada) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, titulo, tipo, salaId, vagas, cancelada ? 1 : 0);
  const inserir = banco.prepare('INSERT INTO encontros (id, atividadeId, inicio, fim) VALUES (?, ?, ?, ?)');
  for (const encontro of encontros) {
    inserir.run(encontro.id, id, encontro.inicio, encontro.fim);
  }
}

async function postAtividade(servidor, corpo) {
  return fetch(`${servidor.base}/atividades`, {
    method: 'POST',
    headers: { 'X-Usuario': 'org-ana', 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
}

test('R7: POST /atividades recusa titulo ausente, vazio, so espacos e com 121 chars; aceita com 120 chars', async () => {
  const servidor = await subirServidor();
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    for (const corpo of [
      { ...corpoValido(), titulo: undefined },
      { ...corpoValido(), titulo: '' },
      { ...corpoValido(), titulo: '   ' },
      { ...corpoValido(), titulo: 'a'.repeat(121) },
    ]) {
      const resposta = await postAtividade(servidor, corpo);
      assert.equal(resposta.status, 422, `titulo ${JSON.stringify(corpo.titulo)}`);
      assert.equal((await resposta.json()).erro, 'DADOS_INVALIDOS');
    }

    const aceita = await postAtividade(servidor, { ...corpoValido(), titulo: 'a'.repeat(120) });
    assert.equal(aceita.status, 201);
    const criada = await aceita.json();
    assert.equal(criada.titulo, 'a'.repeat(120));
  } finally {
    await servidor.fechar();
  }
});

test('R8: palestra exige exatamente 1 encontro e minicurso de 2 a 5; violacao da 422 QUANTIDADE_DE_ENCONTROS', async () => {
  const servidor = await subirServidor();
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const violacoes = [
      { ...corpoValido(), tipo: 'palestra', encontros: encontrosDaSemana(2) },
      { ...corpoValido(), encontros: encontrosDaSemana(1) },
      { ...corpoValido(), encontros: encontrosDaSemana(5).concat(encontrosDaSemana(1)) },
    ];
    for (const corpo of violacoes) {
      const resposta = await postAtividade(servidor, corpo);
      assert.equal(resposta.status, 422, `${corpo.tipo} com ${corpo.encontros.length} encontros`);
      assert.equal((await resposta.json()).erro, 'QUANTIDADE_DE_ENCONTROS');
    }

    for (const quantidade of [2, 5]) {
      const aceita = await postAtividade(servidor, {
        ...corpoValido(),
        salaId: quantidade === 2 ? 'lab-3' : 'sala-101',
        encontros: encontrosDaSemana(quantidade),
      });
      assert.equal(aceita.status, 201, `minicurso com ${quantidade} encontros`);
    }
  } finally {
    await servidor.fechar();
  }
});

test('R9: encontro com duracao fora de 1h a 4h, cortando meia-noite, fora da janela ou sobreposto da 422 ENCONTRO_INVALIDO', async () => {
  const servidor = await subirServidor();
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const segundoValido = { inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T20:00:00-03:00' };
    const invalidos = [
      { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T19:59:00-03:00' },
      { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T23:01:00-03:00' },
      { inicio: '2026-10-19T22:00:00-03:00', fim: '2026-10-20T01:00:00-03:00' },
      { inicio: '2026-10-24T19:00:00-03:00', fim: '2026-10-24T20:00:00-03:00' },
    ];
    for (const encontro of invalidos) {
      const resposta = await postAtividade(servidor, {
        ...corpoValido(),
        encontros: [encontro, segundoValido],
      });
      assert.equal(resposta.status, 422, `encontro ${encontro.inicio} a ${encontro.fim}`);
      assert.equal((await resposta.json()).erro, 'ENCONTRO_INVALIDO');
    }

    const sobrepostos = await postAtividade(servidor, {
      ...corpoValido(),
      encontros: [
        { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T20:00:00-03:00' },
        { inicio: '2026-10-19T19:30:00-03:00', fim: '2026-10-19T20:30:00-03:00' },
      ],
    });
    assert.equal(sobrepostos.status, 422);
    assert.equal((await sobrepostos.json()).erro, 'ENCONTRO_INVALIDO');

    const favorecidos = await postAtividade(servidor, {
      ...corpoValido(),
      encontros: [
        { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T20:00:00-03:00' },
        { inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T23:00:00-03:00' },
      ],
    });
    assert.equal(favorecidos.status, 201, '1h exata e 4h exatas sao validas');
  } finally {
    await servidor.fechar();
  }
});

test('R10: vagas 0 ou negativa da 422 DADOS_INVALIDOS, acima da capacidade da sala da 422 VAGAS_ACIMA_DA_CAPACIDADE e igual a capacidade cria', async () => {
  const servidor = await subirServidor();
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    for (const vagas of [0, -5]) {
      const resposta = await postAtividade(servidor, { ...corpoValido(), vagas });
      assert.equal(resposta.status, 422, `vagas ${vagas}`);
      assert.equal((await resposta.json()).erro, 'DADOS_INVALIDOS');
    }

    const acima = await postAtividade(servidor, { ...corpoValido(), vagas: 21 });
    assert.equal(acima.status, 422);
    assert.equal((await acima.json()).erro, 'VAGAS_ACIMA_DA_CAPACIDADE');

    const noLimite = await postAtividade(servidor, { ...corpoValido(), vagas: 20 });
    assert.equal(noLimite.status, 201, 'vagas igual a capacidade da lab-3 (20)');
    assert.equal((await noLimite.json()).vagas, 20);
  } finally {
    await servidor.fechar();
  }
});

test('R11: encontro com menos de 15 min apos outro na mesma sala da 409 CONFLITO_DE_SALA; 15 min exatos criam; cancelada nao bloqueia', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_00000001',
      titulo: 'Palestra ocupada',
      tipo: 'palestra',
      salaId: 'lab-3',
      vagas: 10,
      encontros: [
        { id: 'enc_00000001', inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T20:00:00-03:00' },
      ],
    });

    const segundo = { inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T20:00:00-03:00' };

    const conflita = await postAtividade(servidor, {
      ...corpoValido(),
      encontros: [
        { inicio: '2026-10-19T20:14:00-03:00', fim: '2026-10-19T21:14:00-03:00' },
        segundo,
      ],
    });
    assert.equal(conflita.status, 409);
    assert.equal((await conflita.json()).erro, 'CONFLITO_DE_SALA');

    const folgaDe15 = await postAtividade(servidor, {
      ...corpoValido(),
      encontros: [
        { inicio: '2026-10-19T20:15:00-03:00', fim: '2026-10-19T21:15:00-03:00' },
        segundo,
      ],
    });
    assert.equal(folgaDe15.status, 201, '15 min exatos de folga criam');

    semearAtividade(banco, {
      id: 'atv_00000002',
      titulo: 'Palestra cancelada',
      tipo: 'palestra',
      salaId: 'lab-3',
      vagas: 10,
      cancelada: true,
      encontros: [
        { id: 'enc_00000002', inicio: '2026-10-22T20:00:00-03:00', fim: '2026-10-22T21:00:00-03:00' },
      ],
    });
    const apesarDaCancelada = await postAtividade(servidor, {
      ...corpoValido(),
      encontros: [
        { inicio: '2026-10-22T19:00:00-03:00', fim: '2026-10-22T20:00:00-03:00' },
        { inicio: '2026-10-23T19:00:00-03:00', fim: '2026-10-23T20:00:00-03:00' },
      ],
    });
    assert.equal(apesarDaCancelada.status, 201, 'cancelada nao bloqueia a sala');
  } finally {
    await servidor.fechar();
  }
});

test('R12: no POST vale a primeira recusa na ordem QUANTIDADE_DE_ENCONTROS, ENCONTRO_INVALIDO, VAGAS_ACIMA_DA_CAPACIDADE, CONFLITO_DE_SALA', async () => {
  const banco = novoBanco(':memory:');
  const servidor = await subirServidor({ banco });
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    semearAtividade(banco, {
      id: 'atv_00000001',
      titulo: 'Palestra ocupada',
      tipo: 'palestra',
      salaId: 'lab-3',
      vagas: 10,
      encontros: [
        { id: 'enc_00000001', inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T20:00:00-03:00' },
      ],
    });

    const casoQuantidade = await postAtividade(servidor, {
      ...corpoValido(),
      tipo: 'palestra',
      encontros: [
        { inicio: '2026-10-19T20:14:00-03:00', fim: '2026-10-19T21:14:00-03:00' },
        { inicio: '2026-10-21T20:14:00-03:00', fim: '2026-10-21T21:14:00-03:00' },
      ],
    });
    assert.equal(casoQuantidade.status, 422);
    assert.equal((await casoQuantidade.json()).erro, 'QUANTIDADE_DE_ENCONTROS');

    const casoEncontro = await postAtividade(servidor, {
      ...corpoValido(),
      vagas: 999,
      encontros: [
        { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T19:59:00-03:00' },
        { inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T20:00:00-03:00' },
      ],
    });
    assert.equal(casoEncontro.status, 422);
    assert.equal((await casoEncontro.json()).erro, 'ENCONTRO_INVALIDO');

    const casoVagas = await postAtividade(servidor, {
      ...corpoValido(),
      vagas: 999,
      encontros: [
        { inicio: '2026-10-19T20:14:00-03:00', fim: '2026-10-19T21:14:00-03:00' },
        { inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T20:00:00-03:00' },
      ],
    });
    assert.equal(casoVagas.status, 422);
    assert.equal((await casoVagas.json()).erro, 'VAGAS_ACIMA_DA_CAPACIDADE');
  } finally {
    await servidor.fechar();
  }
});

test('R13: criar atividade com o 1o encontro no passado do relogio e permitido e a situacao nasce derivada', async () => {
  const servidor = await subirServidor();
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });
    const avancar = await fetch(`${servidor.base}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-24T10:00:00-03:00' }),
    });
    assert.equal(avancar.status, 200);

    const resposta = await postAtividade(servidor, corpoValido());
    assert.equal(resposta.status, 201, 'passado do relogio nao bloqueia a criacao');
    const criada = await resposta.json();
    assert.equal(criada.situacao, 'encerrada');
  } finally {
    await servidor.fechar();
  }
});

test('R14: POST com salaId inexistente da 404 NAO_ENCONTRADO, e a existencia vem antes do corpo', async () => {
  const servidor = await subirServidor();
  try {
    await fetch(`${servidor.base}/_teste/reset`, { method: 'POST' });

    const comCorpoValido = await postAtividade(servidor, { ...corpoValido(), salaId: 'sala-404' });
    assert.equal(comCorpoValido.status, 404);
    assert.equal((await comCorpoValido.json()).erro, 'NAO_ENCONTRADO');

    const comCorpoInvalido = await postAtividade(servidor, {
      ...corpoValido(),
      salaId: 'sala-404',
      titulo: undefined,
      vagas: 0,
    });
    assert.equal(comCorpoInvalido.status, 404);
    assert.equal((await comCorpoInvalido.json()).erro, 'NAO_ENCONTRADO');
  } finally {
    await servidor.fechar();
  }
});