import { render, screen, fireEvent } from '@testing-library/react';
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

function criarApiFalsa({ atividade = minicurso, erro, erroInscricao, erroCertificado } = {}) {
  const certificado = {
    codigo: 'SA26-ABCD-EFGH',
    atividadeId: 'atv_minicurso02',
    participanteId: 'p-carla',
    cargaHorariaMinutos: 300,
    presencas: 2,
    encontros: 2,
    emitidoEm: '2026-10-20T12:00:00-03:00',
  };
  return {
    listarSalas: vi.fn(async () => SALAS),
    obterAtividade: vi.fn(() =>
      erro ? Promise.reject(erro) : Promise.resolve(atividade),
    ),
    listarInscricoes: vi.fn(async () => []),
    inscrever: vi.fn(() =>
      erroInscricao ? Promise.reject(erroInscricao) : Promise.resolve({ id: 'ins_1', status: 'confirmada', posicaoNaEspera: null }),
    ),
    cancelarInscricao: vi.fn(() => Promise.resolve({ id: 'ins_1', status: 'cancelada' })),
    emitirCertificado: vi.fn(() =>
      erroCertificado ? Promise.reject(erroCertificado) : Promise.resolve(certificado),
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

  it('permite inscrever-se e mostra sucesso', async () => {
    const api = criarApiFalsa();
    render(<Atividade api={api} id="atv_minicurso02" />);

    const botaoInscrever = await screen.findByRole('button', { name: 'Inscrever' });
    fireEvent.click(botaoInscrever);

    expect(await screen.findByRole('status')).toHaveTextContent('Inscrição realizada com sucesso!');
    expect(api.inscrever).toHaveBeenCalledWith('atv_minicurso02');
  });

  it('mostra erro da API (ex.: JA_INSCRITO) ao tentar inscrever', async () => {
    const api = criarApiFalsa({
      erroInscricao: { erro: 'JA_INSCRITO', mensagem: 'Participante já inscrito.' },
    });
    render(<Atividade api={api} id="atv_minicurso02" />);

    const botaoInscrever = await screen.findByRole('button', { name: 'Inscrever' });
    fireEvent.click(botaoInscrever);

    expect(await screen.findByRole('alert')).toHaveTextContent('JA_INSCRITO: Participante já inscrito.');
  });

  it('abre a presença do encontro clicado pelo botão de QR', async () => {
    const api = criarApiFalsa();
    const aoSelecionarEncontro = vi.fn();
    render(
      <Atividade api={api} id="atv_minicurso02" aoSelecionarEncontro={aoSelecionarEncontro} />,
    );

    const botoes = await screen.findAllByRole('button', { name: 'Presença por QR' });
    expect(botoes).toHaveLength(2);
    fireEvent.click(botoes[0]);

    expect(aoSelecionarEncontro).toHaveBeenCalledWith('enc_1');
  });

  it('solicita emissão do certificado e mostra o código', async () => {
    const api = criarApiFalsa();
    render(<Atividade api={api} id="atv_minicurso02" />);

    const botao = await screen.findByRole('button', { name: 'Solicitar certificado' });
    fireEvent.click(botao);

    expect(await screen.findAllByText(/SA26-ABCD-EFGH/)).not.toHaveLength(0);
    expect(api.emitirCertificado).toHaveBeenCalledWith('atv_minicurso02');
  });

  it('mostra o erro cru da API quando a emissão é recusada', async () => {
    const api = criarApiFalsa({
      erroCertificado: {
        erro: 'PRESENCA_INSUFICIENTE',
        mensagem: 'Frequência abaixo do mínimo.',
        status: 422,
      },
    });
    render(<Atividade api={api} id="atv_minicurso02" />);

    const botao = await screen.findByRole('button', { name: 'Solicitar certificado' });
    fireEvent.click(botao);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'PRESENCA_INSUFICIENTE: Frequência abaixo do mínimo.',
    );
    expect(api.emitirCertificado).toHaveBeenCalledWith('atv_minicurso02');
  });
});