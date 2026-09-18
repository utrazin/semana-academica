import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import VerificarCertificado from './VerificarCertificado.jsx';

const VERIFICACAO = {
  codigo: 'SA26-ABCD-EFGH',
  participante: 'Elisa F. da R.',
  atividade: 'Flutter do zero',
  cargaHorariaMinutos: 360,
  emitidoEm: '2026-10-20T12:00:00-03:00',
};

function criarApiFalsa({ verificacao = VERIFICACAO, erro } = {}) {
  return {
    verificarCertificado: vi.fn((codigo) =>
      erro ? Promise.reject(erro) : Promise.resolve(verificacao || { ...VERIFICACAO, codigo }),
    ),
  };
}

describe('VerificarCertificado', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('verifica o código digitado e mostra nome abreviado, atividade, carga e emissão', async () => {
    const api = criarApiFalsa();
    render(<VerificarCertificado api={api} />);

    fireEvent.change(screen.getByLabelText(/código do certificado/i), {
      target: { value: 'SA26-ABCD-EFGH' },
    });
    fireEvent.click(screen.getByRole('button', { name: /verificar/i }));

    expect(await screen.findByText('Elisa F. da R.')).toBeInTheDocument();
    expect(screen.getByText('Flutter do zero')).toBeInTheDocument();
    expect(screen.getByText(/360 min/)).toBeInTheDocument();
    expect(screen.getByText(/2026-10-20T12:00:00-03:00/)).toBeInTheDocument();
    expect(api.verificarCertificado).toHaveBeenCalledWith('SA26-ABCD-EFGH');
  });

  it('mostra o erro cru NAO_ENCONTRADO quando o código não existe', async () => {
    const api = criarApiFalsa({
      erro: { erro: 'NAO_ENCONTRADO', mensagem: 'Certificado não encontrado.', status: 404 },
    });
    render(<VerificarCertificado api={api} />);

    fireEvent.change(screen.getByLabelText(/código do certificado/i), {
      target: { value: 'SA26-ZZZZ-ZZZZ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /verificar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'NAO_ENCONTRADO: Certificado não encontrado.',
    );
  });

  it('não mostra resultado antes de verificar', () => {
    const api = criarApiFalsa();
    render(<VerificarCertificado api={api} />);

    expect(screen.queryByText('Elisa F. da R.')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verificar/i })).toBeDisabled();
  });

  it('funciona sem usuário selecionado no localStorage', async () => {
    localStorage.clear();
    const api = criarApiFalsa();
    render(<VerificarCertificado api={api} />);

    fireEvent.change(screen.getByLabelText(/código do certificado/i), {
      target: { value: 'sa26-abcd-efgh' },
    });
    fireEvent.click(screen.getByRole('button', { name: /verificar/i }));

    expect(await screen.findByText('Elisa F. da R.')).toBeInTheDocument();
    expect(api.verificarCertificado).toHaveBeenCalledWith('sa26-abcd-efgh');
  });
});
