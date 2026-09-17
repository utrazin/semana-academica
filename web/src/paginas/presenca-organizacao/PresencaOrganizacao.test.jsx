import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PresencaOrganizacao from './PresencaOrganizacao.jsx';

const CODIGO_ENTREGA = {
  encontroId: 'enc_1',
  codigo: 'K7M2QX',
  trocaEm: '2026-10-19T19:04:00-03:00',
  validoAte: '2026-10-19T19:05:00-03:00',
};

function criarApiFalsa({ codigos = [], erro } = {}) {
  return {
    obterCodigoDoEncontro: vi.fn(() => {
      if (erro) return Promise.reject(erro);
      const proximo = codigos.length > 0 ? codigos.shift() : CODIGO_ENTREGA;
      return Promise.resolve(proximo);
    }),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('PresencaOrganizacao', () => {
  it('mostra o código e o QR que a API devolveu', async () => {
    const api = criarApiFalsa();
    const { container } = render(<PresencaOrganizacao api={api} encontroId="enc_1" />);

    expect(await screen.findByText('K7M2QX')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeTruthy();
    expect(api.obterCodigoDoEncontro).toHaveBeenCalledWith('enc_1');
  });

  it('busca o próximo código quando chega o trocaEm', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-19T19:00:00-03:00'));
    const proximoCodigo = {
      encontroId: 'enc_1',
      codigo: 'ABCDEF',
      trocaEm: '2026-10-19T19:02:00-03:00',
      validoAte: '2026-10-19T19:03:00-03:00',
    };
    const api = criarApiFalsa({
      codigos: [
        { ...CODIGO_ENTREGA, trocaEm: '2026-10-19T19:01:00-03:00' },
        proximoCodigo,
      ],
    });
    const { container } = render(<PresencaOrganizacao api={api} encontroId="enc_1" />);

    await act(async () => {});
    expect(screen.getByText('K7M2QX')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeTruthy();
    expect(api.obterCodigoDoEncontro).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(api.obterCodigoDoEncontro).toHaveBeenCalledTimes(2);
    expect(screen.getByText('ABCDEF')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('mostra o erro FORA_DA_JANELA cru quando a API recusa', async () => {
    const api = criarApiFalsa({
      erro: { erro: 'FORA_DA_JANELA', mensagem: 'A janela do encontro ainda não abriu.' },
    });
    render(<PresencaOrganizacao api={api} encontroId="enc_1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'FORA_DA_JANELA: A janela do encontro ainda não abriu.',
    );
    expect(screen.queryByText('K7M2QX')).not.toBeInTheDocument();
  });

  it('mostra o erro ATIVIDADE_CANCELADA cru quando a API recusa', async () => {
    const api = criarApiFalsa({
      erro: { erro: 'ATIVIDADE_CANCELADA', mensagem: 'A atividade foi cancelada.' },
    });
    render(<PresencaOrganizacao api={api} encontroId="enc_1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'ATIVIDADE_CANCELADA: A atividade foi cancelada.',
    );
  });
});