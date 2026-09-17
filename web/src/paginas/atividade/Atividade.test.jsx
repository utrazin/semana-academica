import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Atividade from './Atividade.jsx';

const SALAS = [
  { id: 'auditorio', nome: 'Auditório Central', capacidade: 200 },
  { id: 'lab-3', nome: 'Laboratório 3', capacidade: 20 },
];

const minicurso = {
  id: 'atv_minicurso02',
  titulo: 'Flutter do zero',
  tipo: 'minicurso',
  salaId: 'lab-3',
  vagas: 20,
  encontros: [
    { id: 'enc_2', inicio: '2026-10-20T09:00:00-03:00', fim: '2026-10-20T12:00:00-03:00' },
    { id: 'enc_1', inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T21:00:00-03:00' },
  ],
  cargaHorariaMinutos: 300,
  situacao: 'em_andamento',
  ocupadas: 8,
  vagasRestantes: 12,
  emEspera: 0,
};

function criarApiFalsa({ atividade = minicurso, erro } = {}) {
  return {
    listarSalas: vi.fn(async () => SALAS),
    obterAtividade: vi.fn(() =>
      erro ? Promise.reject(erro) : Promise.resolve(atividade),
    ),
  };
}

describe('Atividade', () => {
  it('mostra os dados da atividade com os encontros ordenados pelo início', async () => {
    const api = criarApiFalsa();
    render(<Atividade api={api} id="atv_minicurso02" />);

    expect(await screen.findByText('Flutter do zero')).toBeInTheDocument();
    expect(screen.getByText('Minicurso')).toBeInTheDocument();
    expect(screen.getByText('Laboratório 3')).toBeInTheDocument();
    expect(screen.getByText(/12 de 20 vagas/)).toBeInTheDocument();
    expect(screen.getByText(/8 ocupadas/)).toBeInTheDocument();
    expect(screen.getByText('Carga horária: 5h')).toBeInTheDocument();
    expect(screen.getByText('Situação: Em andamento')).toBeInTheDocument();
    expect(api.obterAtividade).toHaveBeenCalledWith('atv_minicurso02');

    const encontros = screen.getAllByRole('listitem');
    expect(encontros[0]).toHaveTextContent('19:00');
    expect(encontros[1]).toHaveTextContent('09:00');
  });

  it('mostra o erro NAO_ENCONTRADO cru quando a API responde 404', async () => {
    const api = criarApiFalsa({
      erro: { erro: 'NAO_ENCONTRADO', mensagem: 'Atividade não existe.' },
    });
    render(<Atividade api={api} id="atv_00000000" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'NAO_ENCONTRADO: Atividade não existe.',
    );
    expect(screen.queryByText('Minicurso')).not.toBeInTheDocument();
  });
});