import Database from 'better-sqlite3';
import { USUARIOS, SALAS } from './dados-iniciais.js';

export function novoBanco(caminho) {
  const banco = new Database(caminho);
  banco.pragma('foreign_keys = ON');
  banco.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      papel TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS salas (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      capacidade INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS atividades (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      tipo TEXT NOT NULL,
      salaId TEXT NOT NULL,
      vagas INTEGER NOT NULL,
      cancelada INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (salaId) REFERENCES salas(id)
    );
    CREATE TABLE IF NOT EXISTS encontros (
      id TEXT PRIMARY KEY,
      atividadeId TEXT NOT NULL,
      inicio TEXT NOT NULL,
      fim TEXT NOT NULL,
      FOREIGN KEY (atividadeId) REFERENCES atividades(id)
    );
    CREATE TABLE IF NOT EXISTS inscricoes (
      id TEXT PRIMARY KEY,
      atividadeId TEXT NOT NULL,
      participanteId TEXT NOT NULL,
      status TEXT NOT NULL,
      posicaoNaEspera INTEGER,
      convocadaAte TEXT,
      criadaEm TEXT NOT NULL,
      FOREIGN KEY (atividadeId) REFERENCES atividades(id),
      FOREIGN KEY (participanteId) REFERENCES usuarios(id)
    );
    CREATE TABLE IF NOT EXISTS presencas (
      id TEXT PRIMARY KEY,
      encontroId TEXT NOT NULL,
      participanteId TEXT NOT NULL,
      origem TEXT NOT NULL,
      lidoEm TEXT NOT NULL,
      registradaEm TEXT NOT NULL,
      justificativa TEXT,
      FOREIGN KEY (encontroId) REFERENCES encontros(id),
      FOREIGN KEY (participanteId) REFERENCES usuarios(id)
    );
  `);
  return banco;
}

export function carregarDadosIniciais(banco) {
  const usuario = banco.prepare('INSERT INTO usuarios (id, nome, papel) VALUES (?, ?, ?)');
  const sala = banco.prepare('INSERT INTO salas (id, nome, capacidade) VALUES (?, ?, ?)');
  for (const u of USUARIOS) usuario.run(u.id, u.nome, u.papel);
  for (const s of SALAS) sala.run(s.id, s.nome, s.capacidade);
}

export function resetarBanco(banco) {
  banco.exec('DELETE FROM presencas; DELETE FROM inscricoes; DELETE FROM encontros; DELETE FROM atividades; DELETE FROM salas; DELETE FROM usuarios;');
  carregarDadosIniciais(banco);
}