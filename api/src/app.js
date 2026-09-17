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

  app.get('/atividades', exigirUsuario, (req, res) => {
    const linhas = banco.prepare('SELECT id, titulo, tipo, salaId, vagas, cancelada FROM atividades').all();
    const porInicio = linhas.map((linha) => {
      const encontros = encontrosPorAtividade.all(linha.id);
      return { linha, inicio: encontros.length ? Date.parse(encontros[0].inicio) : Infinity };
    });
    porInicio.sort((a, b) => a.inicio - b.inicio || a.linha.titulo.localeCompare(b.linha.titulo));
    res.json(porInicio.map((item) => serializarAtividade(item.linha)));
  });

  return app;
}