import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Programacao, { diaEmBrasilia } from './Programacao.jsx';

const SALAS = [
  { id: 'auditorio', nome: 'Auditório Central', capacidade: 200 },
  { id: 'sala-101', nome: 'Sala 101', capacidade: 40 },
  { id: 'lab-3', nome: 'Laboratório 3', capacidade: 20 },
];

const palestra = {
  id: 'atv_palestra01',
  titulo: 'Inteligência Artificial na educação',
  tipo: 'palestra',
  salaId: 'auditorio',
  vagas: 200,
  encontros: [
    { id: 'enc_palestra', inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T21:00:00-03:00' },
  ],
  cargaHorariaMinutos: 120,
  situacao: 'prevista',
  ocupadas: 0,
  vagasRestantes: 200,
  emEspera: 0,
};

const minicurso = {
  id: 'atv_minicurso02',
  titulo: 'Flutter do zero',
  tipo: 'minicurso',
  salaId: 'lab-3',
  vagas: 20,
  encontros: [
    { id: 'enc_minicurso1', inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' },
    { id: 'enc_minicurso2', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' },
  ],
  cargaHorariaMinutos: 360,
  situacao: 'prevista',
  ocupadas: 0,
  vagasRestantes: 20,
  emEspera: 0,
};

function criarApiFalsa({ atividades = [], salas = SALAS } = {}) {
  return {
    listarSalas: vi.fn(async () => salas),
    listarAtividades: vi.fn(async ({ dia, tipo } = {}) =>
      atividades.filter(
        (atividade) =>
          (!dia || atividade.encontros.some((encontro) => diaEmBrasilia(encontro.inicio) === dia)) &&
          (!tipo || atividade.tipo === tipo),
      ),
    ),
  };
}

describe('Programacao', () => {
  it('mostra a lista vazia quando a API não tem atividade para o dia', async () => {
    const api = criarApiFalsa();
    render(<Programacao api={api} />);

    expect(await screen.findByText('Nenhuma atividade para este dia.')).toBeInTheDocument();
  });

  it('lista as atividades com sala e nome quando a API devolve atividades', async () => {
    const api = criarApiFalsa({ atividades: [palestra, minicurso] });
    render(<Programacao api={api} />);

    expect(await screen.findByText('Inteligência Artificial na educação')).toBeInTheDocument();
    expect(screen.getByText('Flutter do zero')).toBeInTheDocument();
    expect(screen.getByText('Auditório Central')).toBeInTheDocument();
    expect(screen.getByText('Laboratório 3')).toBeInTheDocument();
    expect(api.listarSalas).toHaveBeenCalledTimes(1);
    expect(api.listarAtividades).toHaveBeenCalledWith({ dia: '2026-10-19', tipo: undefined });
  });

  it('filtra por tipo mandando ?tipo e mostrando só as do tipo escolhido', async () => {
    const api = criarApiFalsa({ atividades: [palestra, minicurso] });
    render(<Programacao api={api} />);
    await screen.findByText('Inteligência Artificial na educação');

    await userEvent.click(screen.getByRole('button', { name: 'Minicursos' }));

    expect(screen.getByText('Flutter do zero')).toBeInTheDocument();
    expect(screen.queryByText('Inteligência Artificial na educação')).not.toBeInTheDocument();
    expect(api.listarAtividades).toHaveBeenLastCalledWith({
      dia: '2026-10-19',
      tipo: 'minicurso',
    });
  });

  it('mostra a atividade cancelada com o aviso de cancelada', async () => {
    const cancelada = {
      ...palestra,
      id: 'atv_cancelada03',
      titulo: 'Palestra que não vai acontecer',
      situacao: 'cancelada',
    };
    const api = criarApiFalsa({ atividades: [cancelada] });
    render(<Programacao api={api} />);

    expect(await screen.findByText('Palestra que não vai acontecer')).toBeInTheDocument();
    expect(screen.getByText(/Cancelada/)).toBeInTheDocument();
  });
});