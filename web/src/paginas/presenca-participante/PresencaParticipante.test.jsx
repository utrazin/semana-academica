import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PresencaParticipante, { CHAVE_FILA } from './PresencaParticipante.jsx';

function criarApiFalsa({ presenca, erro } = {}) {
  return {
    registrarPresenca: vi.fn(() =>
      erro ? Promise.reject(erro) : Promise.resolve(presenca),
    ),
  };
}

describe('PresencaParticipante', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('envia o código e mostra a confirmação com a origem que a API devolveu', async () => {
    const api = criarApiFalsa({
      presenca: {
        id: 'pre_1',
        encontroId: 'enc_1',
        participanteId: 'p-carla',
        origem: 'qr',
        lidoEm: '2026-10-19T19:03:20-03:00',
        registradaEm: '2026-10-19T19:03:20-03:00',
        justificativa: null,
      },
    });
    render(<PresencaParticipante api={api} encontroId="enc_1" />);

    await userEvent.type(screen.getByLabelText('Código do encontro'), 'K7M2QX');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar presença' }));

    expect(api.registrarPresenca).toHaveBeenCalledWith('enc_1', { codigo: 'K7M2QX' });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Presença registrada (origem: qr).',
    );
  });

  it('mostra o erro CODIGO_INVALIDO cru quando a API recusa', async () => {
    const api = criarApiFalsa({
      erro: {
        status: 422,
        erro: 'CODIGO_INVALIDO',
        mensagem: 'Código inválido para este encontro.',
      },
    });
    render(<PresencaParticipante api={api} encontroId="enc_1" />);

    await userEvent.type(screen.getByLabelText('Código do encontro'), 'XXXXXXXX');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar presença' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'CODIGO_INVALIDO: Código inválido para este encontro.',
    );
  });

  it('mostra o erro FORA_DA_JANELA cru quando a API recusa', async () => {
    const api = criarApiFalsa({
      erro: {
        status: 422,
        erro: 'FORA_DA_JANELA',
        mensagem: 'A janela de presença ainda não abriu.',
      },
    });
    render(<PresencaParticipante api={api} encontroId="enc_1" />);

    await userEvent.type(screen.getByLabelText('Código do encontro'), 'K7M2QX');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar presença' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'FORA_DA_JANELA: A janela de presença ainda não abriu.',
    );
  });

  it('mostra o erro NAO_INSCRITO cru quando a API recusa', async () => {
    const api = criarApiFalsa({
      erro: {
        status: 403,
        erro: 'NAO_INSCRITO',
        mensagem: 'Você não está inscrito nesta atividade.',
      },
    });
    render(<PresencaParticipante api={api} encontroId="enc_1" />);

    await userEvent.type(screen.getByLabelText('Código do encontro'), 'K7M2QX');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar presença' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'NAO_INSCRITO: Você não está inscrito nesta atividade.',
    );
  });

  it('no caso de repetição mostra a confirmação com a origem da presença que já existia', async () => {
    const api = criarApiFalsa({
      presenca: {
        id: 'pre_1',
        encontroId: 'enc_1',
        participanteId: 'p-carla',
        origem: 'manual',
        lidoEm: '2026-10-19T19:10:00-03:00',
        registradaEm: '2026-10-19T19:05:00-03:00',
        justificativa: 'Esqueceu o celular.',
      },
    });
    render(<PresencaParticipante api={api} encontroId="enc_1" />);

    await userEvent.type(screen.getByLabelText('Código do encontro'), 'K7M2QX');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar presença' }));

    expect(api.registrarPresenca).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Presença registrada (origem: manual).',
    );
  });

  it('sem rede, guarda a leitura na fila e mostra a contagem', async () => {
    const api = criarApiFalsa({ erro: new TypeError('Failed to fetch') });
    render(<PresencaParticipante api={api} encontroId="enc_1" />);

    await userEvent.type(screen.getByLabelText('Código do encontro'), 'K7M2QX');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar presença' }));

    expect(api.registrarPresenca).toHaveBeenCalledWith('enc_1', { codigo: 'K7M2QX' });
    await waitFor(() => {
      const fila = JSON.parse(localStorage.getItem(CHAVE_FILA));
      expect(fila).toHaveLength(1);
      expect(fila[0]).toMatchObject({ encontroId: 'enc_1', codigo: 'K7M2QX' });
      expect(String(fila[0].lidoEm)).toMatch(/(Z|[+-]\d{2}:\d{2})$/);
    });
    expect(screen.getByText(/Leituras aguardando envio: 1/)).toBeInTheDocument();
  });

  it('o evento online esvazia a fila chamando a API com { codigo, lidoEm } e a contagem some', async () => {
    const api = {
      registrarPresenca: vi
        .fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({
          id: 'pre_1',
          encontroId: 'enc_1',
          participanteId: 'p-carla',
          origem: 'qr_offline',
          lidoEm: '2026-10-19T19:10:00-03:00',
          registradaEm: '2026-10-19T19:10:00-03:00',
          justificativa: null,
        }),
    };
    render(<PresencaParticipante api={api} encontroId="enc_1" />);

    await userEvent.type(screen.getByLabelText('Código do encontro'), 'K7M2QX');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar presença' }));

    const itens = JSON.parse(localStorage.getItem(CHAVE_FILA));
    expect(itens).toHaveLength(1);

    window.dispatchEvent(new Event('online'));
    await screen.findByRole('status');

    expect(api.registrarPresenca).toHaveBeenLastCalledWith('enc_1', {
      codigo: 'K7M2QX',
      lidoEm: itens[0].lidoEm,
    });
    expect(JSON.parse(localStorage.getItem(CHAVE_FILA))).toHaveLength(0);
    expect(screen.queryByText(/Leituras aguardando envio/)).not.toBeInTheDocument();
  });

  it('o botão Enviar agora esvazia a fila chamando a API com { codigo, lidoEm }', async () => {
    const api = {
      registrarPresenca: vi
        .fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({
          id: 'pre_1',
          encontroId: 'enc_1',
          participanteId: 'p-carla',
          origem: 'qr_offline',
          lidoEm: '2026-10-19T19:10:00-03:00',
          registradaEm: '2026-10-19T19:10:00-03:00',
          justificativa: null,
        }),
    };
    render(<PresencaParticipante api={api} encontroId="enc_1" />);

    await userEvent.type(screen.getByLabelText('Código do encontro'), 'K7M2QX');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar presença' }));

    const itens = JSON.parse(localStorage.getItem(CHAVE_FILA));
    await userEvent.click(screen.getByRole('button', { name: 'Enviar agora' }));
    await screen.findByRole('status');

    expect(api.registrarPresenca).toHaveBeenLastCalledWith('enc_1', {
      codigo: 'K7M2QX',
      lidoEm: itens[0].lidoEm,
    });
    expect(JSON.parse(localStorage.getItem(CHAVE_FILA))).toHaveLength(0);
    expect(screen.queryByText(/Leituras aguardando envio/)).not.toBeInTheDocument();
  });

  it('reenvio recusado pela API sai da fila e mostra o erro cru', async () => {
    const api = criarApiFalsa({
      erro:
        {
          status: 422,
          erro: 'SINCRONIZACAO_TARDIA',
          mensagem: 'Envio depois de fim + 2h.',
        },
    });
    localStorage.setItem(
      CHAVE_FILA,
      JSON.stringify([
        { encontroId: 'enc_1', codigo: 'K7M2QX', lidoEm: '2026-10-19T19:10:00-03:00' },
      ]),
    );
    render(<PresencaParticipante api={api} encontroId="enc_1" />);

    await userEvent.click(screen.getByRole('button', { name: 'Enviar agora' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'SINCRONIZACAO_TARDIA: Envio depois de fim + 2h.',
    );
    expect(api.registrarPresenca).toHaveBeenCalledWith('enc_1', {
      codigo: 'K7M2QX',
      lidoEm: '2026-10-19T19:10:00-03:00',
    });
    expect(JSON.parse(localStorage.getItem(CHAVE_FILA))).toHaveLength(0);
    expect(screen.queryByText(/Leituras aguardando envio/)).not.toBeInTheDocument();
  });

  it('a fila sobrevive a recarregar a tela: com item no localStorage, mostra a contagem de novo', () => {
    const api = criarApiFalsa();
    localStorage.setItem(
      CHAVE_FILA,
      JSON.stringify([
        { encontroId: 'enc_1', codigo: 'K7M2QX', lidoEm: '2026-10-19T19:10:00-03:00' },
      ]),
    );
    render(<PresencaParticipante api={api} encontroId="enc_1" />);

    expect(screen.getByText(/Leituras aguardando envio: 1/)).toBeInTheDocument();
    expect(api.registrarPresenca).not.toHaveBeenCalled();
  });
});