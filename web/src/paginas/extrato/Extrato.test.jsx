import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import Extrato from './Extrato.jsx';

const EXTRATO = {
  itens: [
    {
      atividadeId: 'atv_1',
      titulo: 'Palestra de abertura',
      tipo: 'palestra',
      cargaHorariaMinutos: 120,
      codigo: 'SA26-AAAA-BBBB',
    },
    {
      atividadeId: 'atv_2',
      titulo: 'Flutter do zero',
      tipo: 'minicurso',
      cargaHorariaMinutos: 360,
      codigo: null,
    },
  ],
  palestrasMinutos: 120,
  minicursosMinutos: 360,
  totalMinutos: 480,
  aproveitadoMinutos: 480,
};

function criarApiFalsa({ extrato = EXTRATO, erro } = {}) {
  return {
    obterExtrato: vi.fn(() => (erro ? Promise.reject(erro) : Promise.resolve(extrato))),
  };
}

describe('Extrato', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lista atividades elegíveis com código ou indicação de ainda não emitido', async () => {
    const api = criarApiFalsa();
    render(<Extrato api={api} />);

    expect(await screen.findByText('Palestra de abertura')).toBeInTheDocument();
    expect(screen.getByText(/SA26-AAAA-BBBB/)).toBeInTheDocument();
    expect(screen.getByText('Flutter do zero')).toBeInTheDocument();
    expect(screen.getByText('Ainda não emitido')).toBeInTheDocument();
    expect(api.obterExtrato).toHaveBeenCalledTimes(1);
  });

  it('apresenta os totais brutos e aproveitados vindos da API', async () => {
    const api = criarApiFalsa();
    render(<Extrato api={api} />);

    expect(await screen.findByText(/Palestras: 120 min/)).toBeInTheDocument();
    expect(screen.getByText(/Minicursos: 360 min/)).toBeInTheDocument();
    expect(screen.getByText(/Total: 480 min/)).toBeInTheDocument();
    expect(screen.getByText(/Aproveitado: 480 min/)).toBeInTheDocument();
  });

  it('mostra estado vazio quando não há atividade elegível', async () => {
    const api = criarApiFalsa({
      extrato: {
        itens: [],
        palestrasMinutos: 0,
        minicursosMinutos: 0,
        totalMinutos: 0,
        aproveitadoMinutos: 0,
      },
    });
    render(<Extrato api={api} />);

    expect(await screen.findByText('Nenhuma atividade elegível.')).toBeInTheDocument();
  });

  it('mostra o erro cru da API quando o extrato falha', async () => {
    const api = criarApiFalsa({
      erro: { erro: 'USUARIO_DESCONHECIDO', mensagem: 'Usuário desconhecido.', status: 401 },
    });
    render(<Extrato api={api} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'USUARIO_DESCONHECIDO: Usuário desconhecido.',
    );
  });

  it('mostra carregando antes da resposta chegar', async () => {
    let resolver;
    const pendente = new Promise((resolve) => {
      resolver = resolve;
    });
    const api = { obterExtrato: vi.fn(() => pendente) };
    render(<Extrato api={api} />);

    expect(await screen.findByText('Carregando extrato...')).toBeInTheDocument();
    resolver(EXTRATO);
    expect(await screen.findByText('Palestra de abertura')).toBeInTheDocument();
  });
});
