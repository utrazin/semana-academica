import crypto from 'node:crypto';
import express from 'express';
import { novoBanco, resetarBanco } from './banco.js';
import { ehModoTeste, agora, resetarRelogio, definirRelogio } from './relogio.js';
import { contarVagasOcupadas } from './contagem.js';

const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function codigoDoEncontro(encontroId, inicioMinutoMs) {
  const digest = crypto.createHash('sha256').update(`${encontroId}|${inicioMinutoMs}`).digest();
  let codigo = '';
  for (let i = 0; i < 6; i += 1) {
    codigo += ALFABETO_CODIGO[digest[i] % ALFABETO_CODIGO.length];
  }
  return codigo;
}

export function criarServidor({ banco = novoBanco(':memory:') } = {}) {
  resetarBanco(banco);

  const app = express();
  app.use(express.json());
  app.use((err, req, res, next) => {
    if (err && err.type === 'entity.parse.failed') {
      return res.status(422).json({
        erro: 'DADOS_INVALIDOS',
        mensagem: 'O corpo precisa ser um JSON válido.',
      });
    }
    next(err);
  });

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

  function formatarIsoBrasilia(date) {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const pegar = (tipo) => partes.find((p) => p.type === tipo).value;
    return `${pegar('year')}-${pegar('month')}-${pegar('day')}T${pegar('hour')}:${pegar('minute')}:${pegar('second')}-03:00`;
  }

  function getFechoMs(atividadeId) {
    const encontros = encontrosPorAtividade.all(atividadeId);
    return encontros.length > 0 ? Date.parse(encontros[0].inicio) - 30 * 60000 : Infinity;
  }

  function processarFilaEExpiracoes(atividadeId) {
    const atividade = banco.prepare('SELECT id, vagas FROM atividades WHERE id = ?').get(atividadeId);
    if (!atividade) return;

    const fechoMs = getFechoMs(atividadeId);
    const agoraMs = agora().getTime();

    let mudou = true;
    while (mudou) {
      mudou = false;

      const convocadas = banco.prepare(
        'SELECT id, convocadaAte FROM inscricoes WHERE atividadeId = ? AND status = ?'
      ).all(atividadeId, 'convocada');

      for (const c of convocadas) {
        if (c.convocadaAte && agoraMs > Date.parse(c.convocadaAte)) {
          banco.prepare('UPDATE inscricoes SET status = ?, convocadaAte = ? WHERE id = ?').run('expirada', null, c.id);
          mudou = true;
          atribuirVagasDisponiveis(atividadeId, Date.parse(c.convocadaAte));
        }
      }
    }
  }

  function atribuirVagasDisponiveis(atividadeId, tempoLiberacao) {
    const fechoMs = getFechoMs(atividadeId);
    if (tempoLiberacao >= fechoMs) return;

    const atividade = banco.prepare('SELECT vagas FROM atividades WHERE id = ?').get(atividadeId);
    if (!atividade) return;

    while (true) {
      const inscricoes = banco.prepare('SELECT status FROM inscricoes WHERE atividadeId = ?').all(atividadeId);
      const ocupadas = inscricoes.filter(i => i.status === 'confirmada' || i.status === 'convocada').length;

      if (ocupadas >= atividade.vagas) break;

      const proximo = banco.prepare(
        'SELECT id FROM inscricoes WHERE atividadeId = ? AND status = ? ORDER BY rowid ASC LIMIT 1'
      ).get(atividadeId, 'em_espera');

      if (!proximo) break;
      if (tempoLiberacao >= fechoMs) break;

      let convocadaAteMs = tempoLiberacao + 2 * 3600 * 1000;
      if (convocadaAteMs > fechoMs) {
        convocadaAteMs = fechoMs;
      }
      const convocadaAteIso = formatarIsoBrasilia(new Date(convocadaAteMs));

      banco.prepare('UPDATE inscricoes SET status = ?, convocadaAte = ?, posicaoNaEspera = NULL WHERE id = ?')
        .run('convocada', convocadaAteIso, proximo.id);
    }
  }

  function serializarAtividade(linha) {
    processarFilaEExpiracoes(linha.id);
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
    if ('vagas' in corpo && corpo.vagas > atividade.vagas) {
      atribuirVagasDisponiveis(atividade.id, agora().getTime());
      processarFilaEExpiracoes(atividade.id);
    }
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
    banco.prepare('UPDATE inscricoes SET status = \'cancelada\', convocadaAte = NULL WHERE atividadeId = ? AND status IN (\'confirmada\', \'em_espera\', \'convocada\')').run(atividade.id);
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
      .prepare('SELECT id, tipo, vagas, cancelada FROM atividades WHERE id = ?')
      .get(req.params.id);
    if (!atividade) {
      return res.status(404).json({ erro: 'NAO_ENCONTRADO', mensagem: 'Atividade inexistente.' });
    }
    if (atividade.cancelada) {
      return res.status(422).json({ erro: 'ATIVIDADE_CANCELADA', mensagem: 'Atividade cancelada.' });
    }

    const encontros = encontrosPorAtividade.all(atividade.id);
    if (encontros.length > 0 && agora().getTime() >= Date.parse(encontros[0].inicio) - 30 * 60000) {
      return res.status(422).json({ erro: 'INSCRICOES_ENCERRADAS', mensagem: 'Inscrições encerradas.' });
    }

    const inscricaoAtiva = banco
      .prepare('SELECT id FROM inscricoes WHERE atividadeId = ? AND participanteId = ? AND status IN (\'confirmada\', \'em_espera\', \'convocada\')')
      .get(atividade.id, req.usuario.id);
    if (inscricaoAtiva) {
      return res.status(409).json({ erro: 'JA_INSCRITO', mensagem: 'Participante já possui inscrição ativa nesta atividade.' });
    }

    const ocupadas = vagasOcupadas(atividade.id);
    const vaiOcuparVaga = ocupadas < atividade.vagas;

    if (vaiOcuparVaga) {
      const inscricoesAtivas = banco.prepare(
        'SELECT atividadeId FROM inscricoes WHERE participanteId = ? AND status IN (\'confirmada\', \'convocada\')'
      ).all(req.usuario.id);

      const novosEncontros = encontrosPorAtividade.all(atividade.id);

      for (const ins of inscricoesAtivas) {
        const exsEncontros = encontrosPorAtividade.all(ins.atividadeId);
        for (const exs of exsEncontros) {
          for (const novo of novosEncontros) {
            const inicioExs = Date.parse(exs.inicio);
            const fimExs = Date.parse(exs.fim);
            const inicioNovo = Date.parse(novo.inicio);
            const fimNovo = Date.parse(novo.fim);
            const sobreposto = Math.max(inicioExs, inicioNovo) < Math.min(fimExs, fimNovo);
            if (sobreposto) {
              return res.status(409).json({ erro: 'CONFLITO_DE_HORARIO', mensagem: 'Conflito de horário.' });
            }
          }
        }
      }

      if (atividade.tipo === 'minicurso') {
        const minicursosOcupados = banco.prepare(`
          SELECT COUNT(*) as count 
          FROM inscricoes i
          JOIN atividades a ON a.id = i.atividadeId
          WHERE i.participanteId = ? 
            AND i.status IN ('confirmada', 'convocada')
            AND a.tipo = 'minicurso'
        `).get(req.usuario.id);

        if (minicursosOcupados && minicursosOcupados.count >= 3) {
          return res.status(422).json({ erro: 'LIMITE_DE_MINICURSOS', mensagem: 'Limite de 3 minicursos atingido.' });
        }
      }
    }

    const status = vaiOcuparVaga ? 'confirmada' : 'em_espera';
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
    const atividadesIds = banco.prepare('SELECT DISTINCT atividadeId FROM inscricoes').all();
    for (const a of atividadesIds) {
      processarFilaEExpiracoes(a.atividadeId);
    }

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
    let linha = banco
      .prepare('SELECT id, atividadeId, participanteId, status, convocadaAte, criadaEm FROM inscricoes WHERE id = ?')
      .get(req.params.id);
    if (!linha) {
      return res.status(404).json({ erro: 'NAO_ENCONTRADO', mensagem: 'Inscrição inexistente.' });
    }
    processarFilaEExpiracoes(linha.atividadeId);
    linha = banco
      .prepare('SELECT id, atividadeId, participanteId, status, convocadaAte, criadaEm FROM inscricoes WHERE id = ?')
      .get(req.params.id);

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
    if (linha.status === 'cancelada' || linha.status === 'expirada') {
      return res.status(422).json({ erro: 'INSCRICAO_INATIVA', mensagem: 'Inscrição já está cancelada ou expirada.' });
    }
    const encontros = encontrosPorAtividade.all(linha.atividadeId);
    if (encontros.length > 0 && agora().getTime() >= Date.parse(encontros[0].inicio)) {
      return res.status(422).json({ erro: 'ATIVIDADE_JA_INICIADA', mensagem: 'Atividade já iniciada.' });
    }

    const statusAnterior = linha.status;
    banco.prepare('UPDATE inscricoes SET status = \'cancelada\', convocadaAte = NULL WHERE id = ?').run(linha.id);
    if (statusAnterior === 'confirmada' || statusAnterior === 'convocada') {
      atribuirVagasDisponiveis(linha.atividadeId, agora().getTime());
      processarFilaEExpiracoes(linha.atividadeId);
    }
    const atualizada = banco.prepare('SELECT id, atividadeId, participanteId, status, convocadaAte, criadaEm FROM inscricoes WHERE id = ?').get(linha.id);
    res.status(200).json(serializarInscricao(atualizada));
  });

  app.post('/inscricoes/:id/confirmacao', exigirUsuario, exigirParticipante, (req, res) => {
    let linha = banco
      .prepare('SELECT id, atividadeId, participanteId, status, convocadaAte, criadaEm FROM inscricoes WHERE id = ?')
      .get(req.params.id);
    if (!linha || linha.participanteId !== req.usuario.id) {
      return res.status(404).json({ erro: 'NAO_ENCONTRADO', mensagem: 'Inscrição inexistente.' });
    }

    if (linha.status === 'convocada' && linha.convocadaAte && agora().getTime() > Date.parse(linha.convocadaAte)) {
      processarFilaEExpiracoes(linha.atividadeId);
      return res.status(422).json({ erro: 'CONVOCACAO_EXPIRADA', mensagem: 'Convocação expirada.' });
    }

    processarFilaEExpiracoes(linha.atividadeId);
    linha = banco
      .prepare('SELECT id, atividadeId, participanteId, status, convocadaAte, criadaEm FROM inscricoes WHERE id = ?')
      .get(req.params.id);

    if (linha.status !== 'convocada') {
      return res.status(422).json({ erro: 'SEM_CONVOCACAO', mensagem: 'Inscrição não está convocada.' });
    }

    const atividade = banco.prepare('SELECT tipo FROM atividades WHERE id = ?').get(linha.atividadeId);
    const novosEncontros = encontrosPorAtividade.all(linha.atividadeId);
    const inscricoesAtivas = banco.prepare(
      'SELECT atividadeId FROM inscricoes WHERE participanteId = ? AND id != ? AND status IN (\'confirmada\', \'convocada\')'
    ).all(req.usuario.id, linha.id);

    for (const ins of inscricoesAtivas) {
      const exsEncontros = encontrosPorAtividade.all(ins.atividadeId);
      for (const exs of exsEncontros) {
        for (const novo of novosEncontros) {
          const inicioExs = Date.parse(exs.inicio);
          const fimExs = Date.parse(exs.fim);
          const inicioNovo = Date.parse(novo.inicio);
          const fimNovo = Date.parse(novo.fim);
          const sobreposto = Math.max(inicioExs, inicioNovo) < Math.min(fimExs, fimNovo);
          if (sobreposto) {
            return res.status(409).json({ erro: 'CONFLITO_DE_HORARIO', mensagem: 'Conflito de horário.' });
          }
        }
      }
    }

    if (atividade.tipo === 'minicurso') {
      const minicursosOcupados = banco.prepare(`
        SELECT COUNT(*) as count 
        FROM inscricoes i
        JOIN atividades a ON a.id = i.atividadeId
        WHERE i.participanteId = ? 
          AND i.id != ?
          AND i.status IN ('confirmada', 'convocada')
          AND a.tipo = 'minicurso'
      `).get(req.usuario.id, linha.id);

      if (minicursosOcupados && minicursosOcupados.count >= 3) {
        return res.status(422).json({ erro: 'LIMITE_DE_MINICURSOS', mensagem: 'Limite de 3 minicursos atingido.' });
      }
    }

    banco.prepare('UPDATE inscricoes SET status = \'confirmada\', convocadaAte = NULL WHERE id = ?').run(linha.id);
    const atualizada = banco.prepare('SELECT id, atividadeId, participanteId, status, convocadaAte, criadaEm FROM inscricoes WHERE id = ?').get(linha.id);
    res.status(200).json(serializarInscricao(atualizada));
  });

  const encontroPorId = banco.prepare('SELECT id, atividadeId, inicio, fim FROM encontros WHERE id = ?');
  const atividadeCancelada = banco.prepare('SELECT cancelada FROM atividades WHERE id = ?');
  const inscricaoConfirmada = banco.prepare(
    "SELECT id FROM inscricoes WHERE atividadeId = ? AND participanteId = ? AND status = 'confirmada'",
  );
  const presencaPorEncontroEParticipante = banco.prepare(
    'SELECT id, encontroId, participanteId, origem, lidoEm, registradaEm, justificativa FROM presencas WHERE encontroId = ? AND participanteId = ?',
  );
  const inserirPresenca = banco.prepare(
    'INSERT INTO presencas (id, encontroId, participanteId, origem, lidoEm, registradaEm, justificativa) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );

  function serializarPresenca(linha) {
    return {
      id: linha.id,
      encontroId: linha.encontroId,
      participanteId: linha.participanteId,
      origem: linha.origem,
      lidoEm: linha.lidoEm,
      registradaEm: linha.registradaEm,
      justificativa: linha.justificativa,
    };
  }

  function exigirEncontro(req, res, next) {
    const encontro = encontroPorId.get(req.params.id);
    if (!encontro) {
      return res.status(404).json({ erro: 'NAO_ENCONTRADO', mensagem: 'Encontro inexistente.' });
    }
    req.encontro = encontro;
    next();
  }

  app.get('/encontros/:id/codigo', exigirUsuario, exigirOrganizacao, exigirEncontro, (req, res) => {
    const atividade = atividadeCancelada.get(req.encontro.atividadeId);
    if (atividade && atividade.cancelada) {
      return res.status(422).json({
        erro: 'ATIVIDADE_CANCELADA',
        mensagem: 'Atividade cancelada.',
      });
    }
    const agoraMs = agora().getTime();
    const inicioMs = Date.parse(req.encontro.inicio);
    if (agoraMs < inicioMs - 15 * 60000 || agoraMs > inicioMs + 30 * 60000) {
      return res.status(422).json({
        erro: 'FORA_DA_JANELA',
        mensagem: 'O código só pode ser obtido de 15 min antes a 30 min depois do início do encontro.',
      });
    }
    const inicioMinutoMs = Math.floor(agoraMs / 60000) * 60000;
    res.json({
      encontroId: req.encontro.id,
      codigo: codigoDoEncontro(req.encontro.id, inicioMinutoMs),
      trocaEm: formatarIsoBrasilia(new Date(inicioMinutoMs + 60000)),
      validoAte: formatarIsoBrasilia(new Date(inicioMinutoMs + 120000)),
    });
  });

  app.post('/encontros/:id/presencas', exigirUsuario, exigirParticipante, exigirEncontro, (req, res) => {
    const corpo = req.body || {};
    if (typeof corpo.codigo !== 'string') {
      return res.status(422).json({
        erro: 'DADOS_INVALIDOS',
        mensagem: 'codigo precisa ser uma string.',
      });
    }
    if ('lidoEm' in corpo && (typeof corpo.lidoEm !== 'string' || Number.isNaN(Date.parse(corpo.lidoEm)))) {
      return res.status(422).json({
        erro: 'DADOS_INVALIDOS',
        mensagem: 'lidoEm precisa ser uma data em ISO 8601.',
      });
    }

    const presencaExistente = presencaPorEncontroEParticipante.get(req.encontro.id, req.usuario.id);
    if (presencaExistente) {
      return res.status(200).json(serializarPresenca(presencaExistente));
    }

    if (!inscricaoConfirmada.get(req.encontro.atividadeId, req.usuario.id)) {
      return res.status(403).json({
        erro: 'NAO_INSCRITO',
        mensagem: 'Só quem tem inscrição confirmada registra presença.',
      });
    }

    const agoraMs = agora().getTime();
    const temLidoEm = 'lidoEm' in corpo;
    if (temLidoEm && agoraMs > Date.parse(req.encontro.fim) + 2 * 3600 * 1000) {
      return res.status(422).json({
        erro: 'SINCRONIZACAO_TARDIA',
        mensagem: 'A sincronização offline só vale até 2 horas depois do fim do encontro.',
      });
    }

    const inicioMs = Date.parse(req.encontro.inicio);
    const instanteQueVale = temLidoEm ? Math.min(Date.parse(corpo.lidoEm), agoraMs) : agoraMs;
    if (instanteQueVale < inicioMs - 15 * 60000 || instanteQueVale > inicioMs + 30 * 60000) {
      return res.status(422).json({
        erro: 'FORA_DA_JANELA',
        mensagem: 'A presença só pode ser registrada de 15 min antes a 30 min depois do início do encontro.',
      });
    }

    const inicioMinutoMs = Math.floor(instanteQueVale / 60000) * 60000;
    const codigoNormalizado = corpo.codigo.toUpperCase().replace(/\s+/g, '');
    const codigosAceitos = [
      codigoDoEncontro(req.encontro.id, inicioMinutoMs),
      codigoDoEncontro(req.encontro.id, inicioMinutoMs - 60000),
    ];
    if (!codigosAceitos.includes(codigoNormalizado)) {
      return res.status(422).json({
        erro: 'CODIGO_INVALIDO',
        mensagem: 'Código inválido para este encontro.',
      });
    }

    const registradaEm = formatarIsoBrasilia(agora());
    const presenca = {
      id: gerarId('pre_'),
      encontroId: req.encontro.id,
      participanteId: req.usuario.id,
      origem: temLidoEm ? 'qr_offline' : 'qr',
      lidoEm: formatarIsoBrasilia(new Date(instanteQueVale)),
      registradaEm,
      justificativa: null,
    };
    inserirPresenca.run(
      presenca.id,
      presenca.encontroId,
      presenca.participanteId,
      presenca.origem,
      presenca.lidoEm,
      presenca.registradaEm,
      presenca.justificativa,
    );
    res.status(201).json(serializarPresenca(presenca));
  });

  app.post('/encontros/:id/presencas/manual', exigirUsuario, exigirOrganizacao, exigirEncontro, (req, res) => {
    const corpo = req.body || {};
    if (typeof corpo.participanteId !== 'string') {
      return res.status(422).json({
        erro: 'DADOS_INVALIDOS',
        mensagem: 'participanteId precisa ser uma string.',
      });
    }
    const justificativa = corpo.justificativa;
    if (justificativa === undefined) {
      return res.status(422).json({
        erro: 'JUSTIFICATIVA_OBRIGATORIA',
        mensagem: 'A justificativa da presenca manual e obrigatoria.',
      });
    }
    if (typeof justificativa !== 'string') {
      return res.status(422).json({
        erro: 'DADOS_INVALIDOS',
        mensagem: 'justificativa precisa ser uma string.',
      });
    }
    if (justificativa.length < 10) {
      return res.status(422).json({
        erro: 'JUSTIFICATIVA_OBRIGATORIA',
        mensagem: 'A justificativa da presenca manual precisa ter no minimo 10 caracteres.',
      });
    }

    const presencaExistente = presencaPorEncontroEParticipante.get(req.encontro.id, corpo.participanteId);
    if (presencaExistente) {
      return res.status(200).json(serializarPresenca(presencaExistente));
    }

    if (!inscricaoConfirmada.get(req.encontro.atividadeId, corpo.participanteId)) {
      return res.status(403).json({
        erro: 'NAO_INSCRITO',
        mensagem: 'So quem tem inscricao confirmada registra presenca.',
      });
    }

    const inicioMs = Date.parse(req.encontro.inicio);
    const fimMs = Date.parse(req.encontro.fim);
    const agoraMs = agora().getTime();
    if (agoraMs < inicioMs - 15 * 60000 || agoraMs > fimMs + 2 * 3600 * 1000) {
      return res.status(422).json({
        erro: 'FORA_DA_JANELA',
        mensagem: 'A presenca manual vale de 15 min antes do inicio ate 2 horas depois do fim do encontro.',
      });
    }

    const confirmadas = banco
      .prepare("SELECT COUNT(*) AS total FROM inscricoes WHERE atividadeId = ? AND status = 'confirmada'")
      .get(req.encontro.atividadeId).total;
    const teto = Math.ceil(confirmadas * 0.1);
    const manuais = banco
      .prepare('SELECT COUNT(*) AS total FROM presencas WHERE encontroId = ? AND origem = ?')
      .get(req.encontro.id, 'manual').total;
    if (manuais >= teto) {
      return res.status(422).json({
        erro: 'LIMITE_DE_MANUAIS',
        mensagem: 'As presencas manuais desse encontro estao no limite de 10% das inscricoes confirmadas.',
      });
    }

    const registradaEm = formatarIsoBrasilia(agora());
    const presenca = {
      id: gerarId('pre_'),
      encontroId: req.encontro.id,
      participanteId: corpo.participanteId,
      origem: 'manual',
      lidoEm: registradaEm,
      registradaEm,
      justificativa,
    };
    inserirPresenca.run(
      presenca.id,
      presenca.encontroId,
      presenca.participanteId,
      presenca.origem,
      presenca.lidoEm,
      presenca.registradaEm,
      presenca.justificativa,
    );
    res.status(201).json(serializarPresenca(presenca));
  });

  const presencasPorEncontro = banco.prepare(`
    SELECT p.id, p.encontroId, p.participanteId, p.origem, p.lidoEm, p.registradaEm, p.justificativa
    FROM presencas p
    JOIN usuarios u ON u.id = p.participanteId
    WHERE p.encontroId = ?
    ORDER BY u.nome COLLATE NOCASE, p.participanteId
  `);

  app.get('/encontros/:id/presencas', exigirUsuario, exigirOrganizacao, exigirEncontro, (req, res) => {
    res.json(presencasPorEncontro.all(req.encontro.id).map(serializarPresenca));
  });

  const certificadoPorCodigo = banco.prepare(
    'SELECT codigo, atividadeId, participanteId, cargaHorariaMinutos, presencas, encontros, emitidoEm FROM certificados WHERE codigo = ?',
  );
  const certificadosDoParticipante = banco.prepare(
    'SELECT codigo, atividadeId, participanteId, cargaHorariaMinutos, presencas, encontros, emitidoEm FROM certificados WHERE participanteId = ? ORDER BY emitidoEm, codigo',
  );
  const atividadePorId = banco.prepare('SELECT id, cancelada FROM atividades WHERE id = ?');

  function serializarCertificado(linha) {
    return {
      codigo: linha.codigo,
      atividadeId: linha.atividadeId,
      participanteId: linha.participanteId,
      cargaHorariaMinutos: linha.cargaHorariaMinutos,
      presencas: linha.presencas,
      encontros: linha.encontros,
      emitidoEm: linha.emitidoEm,
    };
  }

  const certificadoPorAtividadeEParticipante = banco.prepare(
    'SELECT codigo, atividadeId, participanteId, cargaHorariaMinutos, presencas, encontros, emitidoEm FROM certificados WHERE atividadeId = ? AND participanteId = ?',
  );
  const certificadoExistentePorCodigo = banco.prepare(
    'SELECT codigo FROM certificados WHERE codigo = ?',
  );
  const inserirCertificado = banco.prepare(
    'INSERT INTO certificados (codigo, atividadeId, participanteId, cargaHorariaMinutos, presencas, encontros, emitidoEm) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const contarPresencasCertificado = banco.prepare(
    'SELECT COUNT(*) AS total FROM presencas p JOIN encontros e ON e.id = p.encontroId WHERE e.atividadeId = ? AND p.participanteId = ?',
  );

  function gerarCodigoCertificado() {
    for (let tentativa = 0; tentativa < 100; tentativa += 1) {
      let variavel = '';
      for (let i = 0; i < 8; i += 1) {
        variavel += ALFABETO_CODIGO[crypto.randomInt(ALFABETO_CODIGO.length)];
      }
      const codigo = `SA26-${variavel.slice(0, 4)}-${variavel.slice(4)}`;
      if (!certificadoExistentePorCodigo.get(codigo)) {
        return codigo;
      }
    }
    throw new Error('Nao foi possivel gerar um codigo de certificado unico.');
  }

  app.post('/atividades/:id/certificado', exigirUsuario, exigirParticipante, (req, res) => {
    const atividade = atividadePorId.get(req.params.id);
    if (!atividade) {
      return res.status(404).json({ erro: 'NAO_ENCONTRADO', mensagem: 'Atividade inexistente.' });
    }
    if (atividade.cancelada) {
      return res.status(422).json({ erro: 'ATIVIDADE_CANCELADA', mensagem: 'Atividade cancelada.' });
    }
    const inscricao = banco.prepare(
      "SELECT id FROM inscricoes WHERE atividadeId = ? AND participanteId = ? AND status = 'confirmada'",
    ).get(atividade.id, req.usuario.id);
    if (!inscricao) {
      return res.status(403).json({ erro: 'NAO_INSCRITO', mensagem: 'Só quem tem inscrição confirmada emite certificado.' });
    }
    const encontrosDaAtividade = encontrosPorAtividade.all(atividade.id);
    const fimUltimoEncontroMs = Date.parse(encontrosDaAtividade[encontrosDaAtividade.length - 1].fim);
    if (agora().getTime() < fimUltimoEncontroMs) {
      return res.status(422).json({ erro: 'ATIVIDADE_NAO_ENCERRADA', mensagem: 'Atividade ainda não encerrada.' });
    }
    const totalEncontros = encontrosDaAtividade.length;
    const totalPresencas = contarPresencasCertificado.get(atividade.id, req.usuario.id).total;
    if (totalPresencas * 4 < totalEncontros * 3) {
      return res.status(422).json({ erro: 'PRESENCA_INSUFICIENTE', mensagem: 'Frequência abaixo do mínimo de 75%.' });
    }
    const existente = certificadoPorAtividadeEParticipante.get(atividade.id, req.usuario.id);
    if (existente) {
      return res.status(200).json(serializarCertificado(existente));
    }
    const cargaHorariaMinutos = Math.round(
      encontrosDaAtividade.reduce(
        (soma, e) => soma + (Date.parse(e.fim) - Date.parse(e.inicio)) / 60000,
        0,
      ),
    );
    const codigo = gerarCodigoCertificado();
    const emitidoEm = agora().toISOString();
    inserirCertificado.run(codigo, atividade.id, req.usuario.id, cargaHorariaMinutos, totalPresencas, totalEncontros, emitidoEm);
    return res.status(201).json({
      codigo,
      atividadeId: atividade.id,
      participanteId: req.usuario.id,
      cargaHorariaMinutos,
      presencas: totalPresencas,
      encontros: totalEncontros,
      emitidoEm,
    });
  });

  app.get('/certificados', exigirUsuario, exigirParticipante, (req, res) => {
    res.json(certificadosDoParticipante.all(req.usuario.id).map(serializarCertificado));
  });

  app.get('/certificados/:codigo', (req, res) => {
    const linha = certificadoPorCodigo.get(req.params.codigo);
    if (!linha) {
      return res.status(404).json({ erro: 'NAO_ENCONTRADO', mensagem: 'Certificado inexistente.' });
    }
    return res.status(501).json({ erro: 'NAO_IMPLEMENTADO', mensagem: 'Verificação fora da fatia 1.' });
  });

  app.get('/extrato', exigirUsuario, exigirParticipante, (req, res) => {
    return res.status(501).json({ erro: 'NAO_IMPLEMENTADO', mensagem: 'Extrato fora da fatia 1.' });
  });

  return app;
}