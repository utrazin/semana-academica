import crypto from 'node:crypto';
import express from 'express';
import { novoBanco, resetarBanco } from './banco.js';
import { ehModoTeste, agora, resetarRelogio, definirRelogio } from './relogio.js';

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
    return {
      id: linha.id,
      titulo: linha.titulo,
      tipo: linha.tipo,
      salaId: linha.salaId,
      vagas: linha.vagas,
      encontros: encontros.map((e) => ({ id: e.id, inicio: e.inicio, fim: e.fim })),
      cargaHorariaMinutos,
      situacao,
      ocupadas: 0,
      vagasRestantes: linha.vagas,
      emEspera: 0,
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

  return app;
}