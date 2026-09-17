import crypto from 'node:crypto';
import express from 'express';
import { novoBanco, resetarBanco } from './banco.js';
import { ehModoTeste, agora, resetarRelogio, definirRelogio } from './relogio.js';
import { contarVagasOcupadas } from './contagem.js';

export function criarServidor({ banco = novoBanco(':memory:') } = {}) {
  resetarBanco(banco);

  const app = express();
  app.use(express.json());

  const usuarioPorId = banco.prepare('SELECT id, nome, papel FROM usuarios WHERE id = ?');

  function exigirUsuario(req, res, next) {
    const id = req.get('X-Usuario');
    const usuario = id ? usuarioPorId.get(id) : undefined;
    if (!usuario) {
      return res.status(401).json({
        erro: 'USUARIO_DESCONHECIDO',
        mensagem: 'Envie um X-Usuario que exista nos dados iniciais.',
      });
    }
    req.usuario = usuario;
    next();
  }

  function exigirOrganizacao(req, res, next) {
    if (req.usuario.papel !== 'organizacao') {
      return res.status(403).json({
        erro: 'SOMENTE_ORGANIZACAO',
        mensagem: 'Só a organização cria ou altera atividades.',
      });
    }
    next();
  }

  function gerarId(prefixo) {
    return `${prefixo}${crypto.randomBytes(4).toString('hex')}`;
  }

  if (ehModoTeste()) {
    app.post('/_teste/reset', (req, res) => {
      resetarBanco(banco);
      resetarRelogio();
      res.status(204).end();
    });

    app.get('/_teste/relogio', (req, res) => {
      res.json({ agora: agora().toISOString() });
    });

    app.put('/_teste/relogio', (req, res) => {
      const iso = req.body && req.body.agora;
      if (typeof iso !== 'string' || !definirRelogio(iso)) {
        return res.status(422).json({
          erro: 'DADOS_INVALIDOS',
          mensagem: 'Envie um corpo {"agora": "<ISO>"} com uma data válida.',
        });
      }
      res.json({ agora: agora().toISOString() });
    });
  }

  app.get('/salas', exigirUsuario, (req, res) => {
    const salas = banco.prepare('SELECT id, nome, capacidade FROM salas ORDER BY nome').all();
    res.json(salas);
  });

  const encontrosPorAtividade = banco.prepare(
    'SELECT id, inicio, fim FROM encontros WHERE atividadeId = ? ORDER BY inicio',
  );

  function serializarAtividade(linha) {
    const encontros = encontrosPorAtividade.all(linha.id);
    const cargaHorariaMinutos = Math.round(
      encontros.reduce(
        (soma, e) => soma + (Date.parse(e.fim) - Date.parse(e.inicio)) / 60000,
        0,
      ),
    );
    const agoraMs = agora().getTime();
    let situacao = 'prevista';
    if (linha.cancelada) {
      situacao = 'cancelada';
    } else if (agoraMs >= Date.parse(encontros[encontros.length - 1].fim)) {
      situacao = 'encerrada';
    } else if (agoraMs >= Date.parse(encontros[0].inicio)) {
      situacao = 'em_andamento';
    }
    const ocupadas = vagasOcupadas(linha.id);
    const vagasRestantes = Math.max(0, linha.vagas - ocupadas);
    const emEsperaLinhas = banco.prepare('SELECT COUNT(*) as count FROM inscricoes WHERE atividadeId = ? AND status = ?').get(linha.id, 'em_espera');
    const emEspera = emEsperaLinhas ? emEsperaLinhas.count : 0;
    return {
      id: linha.id,
      titulo: linha.titulo,
      tipo: linha.tipo,
      salaId: linha.salaId,
      vagas: linha.vagas,
      encontros: encontros.map((e) => ({ id: e.id, inicio: e.inicio, fim: e.fim })),
      cargaHorariaMinutos,
      situacao,
      ocupadas,
      vagasRestantes,
      emEspera,
    };
  }

  function diaEmBrasilia(iso) {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(iso));
    const pegar = (tipo) => partes.find((p) => p.type === tipo).value;
    return `${pegar('year')}-${pegar('month')}-${pegar('day')}`;
  }

  function encontrosValidos(encontros) {
    const INICIO_JANELA_MS = Date.parse('2026-10-19T00:00:00-03:00');
    const FIM_JANELA_MS = Date.parse('2026-10-24T00:00:00-03:00');
    const ordenados = [...encontros].sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
    for (let i = 0; i < ordenados.length; i++) {
      const encontro = ordenados[i];
      const inicioMs = Date.parse(encontro.inicio);
      const fimMs = Date.parse(encontro.fim);
      const duracaoMinutos = (fimMs - inicioMs) / 60000;
      if (
        !Number.isFinite(inicioMs) ||
        !Number.isFinite(fimMs) ||
        duracaoMinutos < 60 ||
        duracaoMinutos > 240 ||
        diaEmBrasilia(encontro.inicio) !== diaEmBrasilia(encontro.fim) ||
        inicioMs < INICIO_JANELA_MS ||
        fimMs > FIM_JANELA_MS
      ) {
        return false;
      }
      if (i > 0 && inicioMs < Date.parse(ordenados[i - 1].fim)) {
        return false;
      }
    }
    return true;
  }

  app.get('/atividades', exigirUsuario, (req, res) => {
    const dia = req.query.dia;
    const tipo = req.query.tipo;
    if (tipo !== undefined && tipo !== 'palestra' && tipo !== 'minicurso') {
      return res.status(422).json({ erro: 'DADOS_INVALIDOS', mensagem: '?tipo só aceita palestra ou minicurso.' });
    }
    let linhas = banco.prepare('SELECT id, titulo, tipo, salaId, vagas, cancelada FROM atividades').all();
    if (dia !== undefined) {
      linhas = linhas.filter((linha) =>
        encontrosPorAtividade.all(linha.id).some((e) => diaEmBrasilia(e.inicio) === dia),
      );
    }
    if (tipo !== undefined) {
      linhas = linhas.filter((linha) => linha.tipo === tipo);
    }
    const porInicio = linhas.map((linha) => {
      const encontros = encontrosPorAtividade.all(linha.id);
      return { linha, inicio: encontros.length ? Date.parse(encontros[0].inicio) : Infinity };
    });
    porInicio.sort((a, b) => a.inicio - b.inicio || a.linha.titulo.localeCompare(b.linha.titulo));
    res.json(porInicio.map((item) => serializarAtividade(item.linha)));
  });

  app.get('/atividades/:id', exigirUsuario, (req, res) => {
    const linha = banco
      .prepare('SELECT id, titulo, tipo, salaId, vagas, cancelada FROM atividades WHERE id = ?')
      .get(req.params.id);
    if (!linha) {
      return res.status(404).json({ erro: 'NAO_ENCONTRADO', mensagem: 'Atividade inexistente.' });
    }
    res.json(serializarAtividade(linha));
  });

  function temConflitoDeSala(salaId, encontros) {
    const atividadesNaSala = banco.prepare('SELECT id, cancelada FROM atividades WHERE salaId = ?').all(salaId);
    const folga = 15 * 60000;
    for (const atividade of atividadesNaSala) {
      if (atividade.cancelada) continue;
      for (const existente of encontrosPorAtividade.all(atividade.id)) {
        for (const novo of encontros) {
          const inicioNovoMs = Date.parse(novo.inicio);
          const fimNovoMs = Date.parse(novo.fim);
          const inicioExistenteMs = Date.parse(existente.inicio);
          const fimExistenteMs = Date.parse(existente.fim);
          const separado = fimExistenteMs + folga <= inicioNovoMs || fimNovoMs + folga <= inicioExistenteMs;
          if (!separado) return true;
        }
      }
    }
    return false;
  }

  const salaExiste = banco.prepare('SELECT id, capacidade FROM salas WHERE id = ?');
  const inserirAtividade = banco.prepare(
    'INSERT INTO atividades (id, titulo, tipo, salaId, vagas, cancelada) VALUES (?, ?, ?, ?, ?, 0)',
  );
  const inserirEncontro = banco.prepare(
    'INSERT INTO encontros (id, atividadeId, inicio, fim) VALUES (?, ?, ?, ?)',
  );

  function vagasOcupadas(atividadeId) {
    const existeInscricoes = banco
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'inscricoes'`)
      .get();
    if (!existeInscricoes) return 0;
    const inscricoes = banco
      .prepare('SELECT status FROM inscricoes WHERE atividadeId = ?')
      .all(atividadeId);
    return contarVagasOcupadas(inscricoes);
  }

  app.post('/atividades', exigirUsuario, exigirOrganizacao, (req, res) => {
    const corpo = req.body;
    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
      return res.status(422).json({ erro: 'DADOS_INVALIDOS', mensagem: 'Envie um objeto JSON no corpo.' });
    }

    const salaId = corpo.salaId;
    const sala = typeof salaId === 'string' ? salaExiste.get(salaId) : undefined;
    if (typeof salaId === 'string' && !sala) {
      return res.status(404).json({ erro: 'NAO_ENCONTRADO', mensagem: 'Sala inexistente.' });
    }

    const camposDoContrato = ['titulo', 'tipo', 'salaId', 'vagas', 'encontros', 'cargaHorariaMinutos'];
    const desconhecido = Object.keys(corpo).find((campo) => !camposDoContrato.includes(campo));
    if (desconhecido) {
      return res.status(422).json({ erro: 'DADOS_INVALIDOS', mensagem: `"${desconhecido}" não existe no contrato.` });
    }

    const titulo = typeof corpo.titulo === 'string' ? corpo.titulo.trim() : corpo.titulo;
    if (typeof titulo !== 'string' || titulo.length < 1 || titulo.length > 120) {
      return res.status(422).json({ erro: 'DADOS_INVALIDOS', mensagem: 'titulo é obrigatório e vai de 1 a 120 caracteres após trim.' });
    }
    if (corpo.tipo !== 'palestra' && corpo.tipo !== 'minicurso') {
      return res.status(422).json({ erro: 'DADOS_INVALIDOS', mensagem: 'tipo deve ser palestra ou minicurso.' });
    }
    if (typeof salaId !== 'string' || salaId === '') {
      return res.status(422).json({ erro: 'DADOS_INVALIDOS', mensagem: 'salaId é obrigatório.' });
    }
    const vagas = corpo.vagas;
    if (!Number.isInteger(vagas) || vagas < 1) {
      return res.status(422).json({ erro: 'DADOS_INVALIDOS', mensagem: 'vagas precisa ser inteiro de no mínimo 1.' });
    }
    if (
      !Array.isArray(corpo.encontros) ||
      corpo.encontros.some((e) => !e || typeof e.inicio !== 'string' || typeof e.fim !== 'string')
    ) {
      return res.status(422).json({ erro: 'DADOS_INVALIDOS', mensagem: 'encontros precisa ser uma lista de {inicio, fim}.' });
    }

    const quantidadeDeEncontros = corpo.encontros.length;
    const quantidadeOk =
      corpo.tipo === 'palestra'
        ? quantidadeDeEncontros === 1
        : corpo.tipo === 'minicurso'
          ? quantidadeDeEncontros >= 2 && quantidadeDeEncontros <= 5
          : false;
    if (!quantidadeOk) {
      return res.status(422).json({
        erro: 'QUANTIDADE_DE_ENCONTROS',
        mensagem: 'palestra tem exatamente 1 encontro; minicurso tem de 2 a 5.',
      });
    }
    if (!encontrosValidos(corpo.encontros)) {
      return res.status(422).json({
        erro: 'ENCONTRO_INVALIDO',
        mensagem: 'Encontro precisa de 1h a 4h, sem cortar meia-noite, dentro de 19 a 23/10 e sem se sobrepor a outro da mesma atividade.',
      });
    }
    if (vagas > sala.capacidade) {
      return res.status(422).json({
        erro: 'VAGAS_ACIMA_DA_CAPACIDADE',
        mensagem: `vagas não pode passar da capacidade da sala (${sala.capacidade}).`,
      });
    }
    if (temConflitoDeSala(salaId, corpo.encontros)) {
      return res.status(409).json({
        erro: 'CONFLITO_DE_SALA',
        mensagem: 'A sala já tem atividade nesse horário com menos de 15 min de folga.',
      });
    }

    const id = gerarId('atv_');
    inserirAtividade.run(id, titulo, corpo.tipo, salaId, vagas);
    for (const encontro of corpo.encontros) {
      inserirEncontro.run(gerarId('enc_'), id, encontro.inicio, encontro.fim);
    }
    const linha = banco.prepare('SELECT id, titulo, tipo, salaId, vagas, cancelada FROM atividades WHERE id = ?').get(id);
    res.status(201).json(serializarAtividade(linha));
  });

  app.patch('/atividades/:id', exigirUsuario, exigirOrganizacao, (req, res) => {
    const atividade = banco
      .prepare('SELECT id, titulo, tipo, salaId, vagas, cancelada FROM atividades WHERE id = ?')
      .get(req.params.id);
    if (!atividade) {
      return res.status(404).json({ erro: 'NAO_ENCONTRADO', mensagem: 'Atividade inexistente.' });
    }

    const corpo = req.body;
    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
      return res.status(422).json({ erro: 'DADOS_INVALIDOS', mensagem: 'Envie um objeto JSON no corpo.' });
    }
    if (Object.keys(corpo).length === 0) {
      return res.status(422).json({ erro: 'DADOS_INVALIDOS', mensagem: 'O corpo precisa de pelo menos um campo editável.' });
    }
    const camposDoContrato = ['id', 'titulo', 'tipo', 'salaId', 'vagas', 'encontros', 'cargaHorariaMinutos', 'situacao', 'ocupadas', 'vagasRestantes', 'emEspera'];
    const desconhecido = Object.keys(corpo).find((campo) => !camposDoContrato.includes(campo));
    if (desconhecido) {
      return res.status(422).json({ erro: 'DADOS_INVALIDOS', mensagem: `"${desconhecido}" não existe no contrato.` });
    }
    if ('titulo' in corpo) {
      const titulo = typeof corpo.titulo === 'string' ? corpo.titulo.trim() : corpo.titulo;
      if (typeof titulo !== 'string' || titulo.length < 1 || titulo.length > 120) {
        return res.status(422).json({ erro: 'DADOS_INVALIDOS', mensagem: 'titulo vai de 1 a 120 caracteres após trim.' });
      }
    }
    if ('vagas' in corpo && (!Number.isInteger(corpo.vagas) || corpo.vagas < 1)) {
      return res.status(422).json({ erro: 'DADOS_INVALIDOS', mensagem: 'vagas precisa ser inteiro de no mínimo 1.' });
    }
    if (atividade.cancelada) {
      return res.status(422).json({ erro: 'ATIVIDADE_CANCELADA', mensagem: 'Atividade cancelada não pode ser alterada.' });
    }
    const naoEditavel = Object.keys(corpo).find((campo) => !['titulo', 'vagas'].includes(campo));
    if (naoEditavel) {
      return res.status(422).json({ erro: 'CAMPO_NAO_EDITAVEL', mensagem: 'Só titulo e vagas são editáveis.' });
    }

    if ('vagas' in corpo) {
      const sala = salaExiste.get(atividade.salaId);
      if (corpo.vagas > sala.capacidade) {
        return res.status(422).json({
          erro: 'VAGAS_ACIMA_DA_CAPACIDADE',
          mensagem: `vagas não pode passar da capacidade da sala (${sala.capacidade}).`,
        });
      }
      if (corpo.vagas < vagasOcupadas(atividade.id)) {
        return res.status(409).json({
          erro: 'VAGAS_ABAIXO_DOS_INSCRITOS',
          mensagem: 'vagas não pode ficar abaixo dos inscritos atuais.',
        });
      }
    }

    banco
      .prepare('UPDATE atividades SET titulo = ?, vagas = ? WHERE id = ?')
      .run(
        'titulo' in corpo ? corpo.titulo.trim() : atividade.titulo,
        'vagas' in corpo ? corpo.vagas : atividade.vagas,
        atividade.id,
      );
    const linha = banco
      .prepare('SELECT id, titulo, tipo, salaId, vagas, cancelada FROM atividades WHERE id = ?')
      .get(atividade.id);
    res.status(200).json(serializarAtividade(linha));
  });

  app.post('/atividades/:id/cancelamento', exigirUsuario, exigirOrganizacao, (req, res) => {
    const atividade = banco
      .prepare('SELECT id, titulo, tipo, salaId, vagas, cancelada FROM atividades WHERE id = ?')
      .get(req.params.id);
    if (!atividade) {
      return res.status(404).json({ erro: 'NAO_ENCONTRADO', mensagem: 'Atividade inexistente.' });
    }
    if (atividade.cancelada) {
      return res.status(422).json({ erro: 'ATIVIDADE_CANCELADA', mensagem: 'Atividade já está cancelada.' });
    }
    const encontros = encontrosPorAtividade.all(atividade.id);
    if (agora().getTime() >= Date.parse(encontros[0].inicio)) {
      return res.status(422).json({
        erro: 'ATIVIDADE_JA_INICIADA',
        mensagem: 'Só é possível cancelar antes do início do 1º encontro.',
      });
    }
    banco.prepare('UPDATE atividades SET cancelada = 1 WHERE id = ?').run(atividade.id);
    const linha = banco
      .prepare('SELECT id, titulo, tipo, salaId, vagas, cancelada FROM atividades WHERE id = ?')
      .get(atividade.id);
    res.status(200).json(serializarAtividade(linha));
  });

  function exigirParticipante(req, res, next) {
    if (req.usuario.papel !== 'participante') {
      return res.status(403).json({
        erro: 'SOMENTE_PARTICIPANTE',
        mensagem: 'Apenas participantes podem realizar inscrições.',
      });
    }
    next();
  }

  function serializarInscricao(linha) {
    let posicaoNaEspera = null;
    if (linha.status === 'em_espera') {
      const emEsperaList = banco.prepare(
        'SELECT id FROM inscricoes WHERE atividadeId = ? AND status = ? ORDER BY rowid ASC'
      ).all(linha.atividadeId, 'em_espera');
      const index = emEsperaList.findIndex((i) => i.id === linha.id);
      posicaoNaEspera = index >= 0 ? index + 1 : null;
    }
    return {
      id: linha.id,
      atividadeId: linha.atividadeId,
      participanteId: linha.participanteId,
      status: linha.status,
      posicaoNaEspera,
      convocadaAte: linha.convocadaAte || null,
      criadaEm: linha.criadaEm,
    };
  }

  app.post('/atividades/:id/inscricoes', exigirUsuario, exigirParticipante, (req, res) => {
    const atividade = banco
      .prepare('SELECT id, vagas, cancelada FROM atividades WHERE id = ?')
      .get(req.params.id);
    if (!atividade) {
      return res.status(404).json({ erro: 'NAO_ENCONTRADO', mensagem: 'Atividade inexistente.' });
    }

    const inscricaoAtiva = banco
      .prepare('SELECT id FROM inscricoes WHERE atividadeId = ? AND participanteId = ? AND status IN (\'confirmada\', \'em_espera\', \'convocada\')')
      .get(atividade.id, req.usuario.id);
    if (inscricaoAtiva) {
      return res.status(409).json({ erro: 'JA_INSCRITO', mensagem: 'Participante já possui inscrição ativa nesta atividade.' });
    }

    const ocupadas = vagasOcupadas(atividade.id);
    const status = ocupadas < atividade.vagas ? 'confirmada' : 'em_espera';
    const id = gerarId('ins_');
    const criadaEm = agora().toISOString();

    banco
      .prepare('INSERT INTO inscricoes (id, atividadeId, participanteId, status, posicaoNaEspera, convocadaAte, criadaEm) VALUES (?, ?, ?, ?, NULL, NULL, ?)')
      .run(id, atividade.id, req.usuario.id, status, criadaEm);

    const linha = banco.prepare('SELECT id, atividadeId, participanteId, status, convocadaAte, criadaEm FROM inscricoes WHERE id = ?').get(id);
    res.status(201).json(serializarInscricao(linha));
  });

  app.get('/inscricoes', exigirUsuario, (req, res) => {
    const atividadeId = req.query.atividadeId;
    let query = 'SELECT id, atividadeId, participanteId, status, convocadaAte, criadaEm FROM inscricoes';
    const params = [];
    const conditions = [];

    if (req.usuario.papel === 'participante') {
      conditions.push('participanteId = ?');
      params.push(req.usuario.id);
    }
    if (atividadeId !== undefined) {
      conditions.push('atividadeId = ?');
      params.push(atividadeId);
    }
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY criadaEm';

    const linhas = banco.prepare(query).all(...params);
    res.json(linhas.map(serializarInscricao));
  });

  app.get('/inscricoes/:id', exigirUsuario, (req, res) => {
    const linha = banco
      .prepare('SELECT id, atividadeId, participanteId, status, convocadaAte, criadaEm FROM inscricoes WHERE id = ?')
      .get(req.params.id);
    if (!linha) {
      return res.status(404).json({ erro: 'NAO_ENCONTRADO', mensagem: 'Inscrição inexistente.' });
    }
    if (req.usuario.papel === 'participante' && linha.participanteId !== req.usuario.id) {
      return res.status(404).json({ erro: 'NAO_ENCONTRADO', mensagem: 'Inscrição inexistente.' });
    }
    res.json(serializarInscricao(linha));
  });

  app.post('/inscricoes/:id/cancelamento', exigirUsuario, exigirParticipante, (req, res) => {
    const linha = banco
      .prepare('SELECT id, atividadeId, participanteId, status, convocadaAte, criadaEm FROM inscricoes WHERE id = ?')
      .get(req.params.id);
    if (!linha) {
      return res.status(404).json({ erro: 'NAO_ENCONTRADO', mensagem: 'Inscrição inexistente.' });
    }
    if (linha.participanteId !== req.usuario.id) {
      return res.status(404).json({ erro: 'NAO_ENCONTRADO', mensagem: 'Inscrição inexistente.' });
    }
    banco.prepare('UPDATE inscricoes SET status = \'cancelada\', convocadaAte = NULL WHERE id = ?').run(linha.id);
    const atualizada = banco.prepare('SELECT id, atividadeId, participanteId, status, convocadaAte, criadaEm FROM inscricoes WHERE id = ?').get(linha.id);
    res.status(200).json(serializarInscricao(atualizada));
  });

  return app;
}