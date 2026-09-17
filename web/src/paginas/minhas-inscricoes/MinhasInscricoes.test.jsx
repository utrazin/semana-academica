import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MinhasInscricoes from './MinhasInscricoes.jsx';

const INSCRICOES = [
  {
    id: 'ins_1',
    atividadeId: 'atv_1',
    status: 'confirmada',
    posicaoNaEspera: null,
    convocadaAte: null,
  },
  {
    id: 'ins_2',
    atividadeId: 'atv_2',
    status: 'em_espera',
    posicaoNaEspera: 2,
    convocadaAte: null,
  },
  {
    id: 'ins_3',
    atividadeId: 'atv_3',
    status: 'convocada',
    posicaoNaEspera: null,
    convocadaAte: '2026-10-18T15:00:00Z',
  },
];

function criarApiFalsa({ inscricoes = INSCRICOES, erroConfirmacao, erroListagem } = {}) {
  return {
    listarInscricoes: vi.fn(() =>
      erroListagem ? Promise.reject(erroListagem) : Promise.resolve(inscricoes),
    ),
    confirmarConvocacao: vi.fn((id) =>
      erroConfirmacao ? Promise.reject(erroConfirmacao) : Promise.resolve({ id, status: 'confirmada' }),
    ),
    cancelarInscricao: vi.fn((id) => Promise.resolve({ id, status: 'cancelada' })),
  };
}

describe('MinhasInscricoes', () => {
  it('lista inscrições com status, posicaoNaEspera e botão de confirmar para convocadas', async () => {
    const api = criarApiFalsa();
    render(<MinhasInscricoes api={api} />);

    expect(await screen.findByText('Atividade: atv_1')).toBeInTheDocument();
    expect(screen.getByText('Status: confirmada')).toBeInTheDocument();
    expect(screen.getByText('Status: em_espera')).toBeInTheDocument();
    expect(screen.getByText('Posição na espera: 2')).toBeInTheDocument();
    expect(screen.getByText('Status: convocada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar convocação' })).toBeInTheDocument();
  });

  it('confirma convocação com sucesso', async () => {
    const api = criarApiFalsa();
    render(<MinhasInscricoes api={api} />);

    const botao = await screen.findByRole('button', { name: 'Confirmar convocação' });
    fireEvent.click(botao);

    await waitFor(() => {
      expect(api.confirmarConvocacao).toHaveBeenCalledWith('ins_3');
      expect(screen.getByRole('status')).toHaveTextContent('Convocação confirmada com sucesso!');
    });
  });

  it('mostra erro da API ao falhar na confirmação da convocação', async () => {
    const api = criarApiFalsa({
      erroConfirmacao: { erro: 'CONVOCACAO_EXPIRADA', mensagem: 'Convocação expirou.' },
    });
    render(<MinhasInscricoes api={api} />);

    const botao = await screen.findByRole('button', { name: 'Confirmar convocação' });
    fireEvent.click(botao);

    expect(await screen.findByRole('alert')).toHaveTextContent('CONVOCACAO_EXPIRADA: Convocação expirou.');
  });
});
