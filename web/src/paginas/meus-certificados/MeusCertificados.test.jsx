import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import MeusCertificados from './MeusCertificados.jsx';

const CERTIFICADOS = [
  {
    codigo: 'SA26-ABCD-EFGH',
    atividadeId: 'atv_1a2b3c4d',
    participanteId: 'p-carla',
    cargaHorariaMinutos: 360,
    presencas: 2,
    encontros: 2,
    emitidoEm: '2026-10-20T12:00:00-03:00',
  },
];

function criarApiFalsa({ certificados = CERTIFICADOS, erro } = {}) {
  return {
    listarCertificados: vi.fn(() =>
      erro ? Promise.reject(erro) : Promise.resolve(certificados),
    ),
  };
}

describe('MeusCertificados', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lista os certificados emitidos com código e carga horária', async () => {
    const api = criarApiFalsa();
    render(<MeusCertificados api={api} />);

    expect(await screen.findByText('SA26-ABCD-EFGH')).toBeInTheDocument();
    expect(screen.getByText(/atv_1a2b3c4d/)).toBeInTheDocument();
    expect(api.listarCertificados).toHaveBeenCalledTimes(1);
  });

  it('mostra estado vazio quando o participante ainda não emitiu nada', async () => {
    const api = criarApiFalsa({ certificados: [] });
    render(<MeusCertificados api={api} />);

    expect(await screen.findByText('Nenhum certificado emitido.')).toBeInTheDocument();
  });

  it('mostra o erro cru da API quando a listagem falha', async () => {
    const api = criarApiFalsa({
      erro: { erro: 'USUARIO_DESCONHECIDO', mensagem: 'Usuário desconhecido.', status: 401 },
    });
    render(<MeusCertificados api={api} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'USUARIO_DESCONHECIDO: Usuário desconhecido.',
    );
  });

  it('mostra carregando antes da resposta chegar', async () => {
    let resolver;
    const pendente = new Promise((resolve) => {
      resolver = resolve;
    });
    const api = { listarCertificados: vi.fn(() => pendente) };
    render(<MeusCertificados api={api} />);

    expect(await screen.findByText('Carregando certificados...')).toBeInTheDocument();
    resolver([]);
    expect(await screen.findByText('Nenhum certificado emitido.')).toBeInTheDocument();
  });
});
