import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PresencaParticipante from './PresencaParticipante.jsx';

function criarApiFalsa({ presenca, erro } = {}) {
  return {
    registrarPresenca: vi.fn(() =>
      erro ? Promise.reject(erro) : Promise.resolve(presenca),
    ),
  };
}

describe('PresencaParticipante', () => {
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
      erro: { erro: 'CODIGO_INVALIDO', mensagem: 'Código inválido para este encontro.' },
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
      erro: { erro: 'FORA_DA_JANELA', mensagem: 'A janela de presença ainda não abriu.' },
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
      erro: { erro: 'NAO_INSCRITO', mensagem: 'Você não está inscrito nesta atividade.' },
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
});