import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PainelOrganizacao from './PainelOrganizacao.jsx';

const ATIVIDADES = [
  {
    atividadeId: 'atv_1a2b3c4d',
    titulo: 'Flutter do zero',
    tipo: 'minicurso',
    vagas: 20,
    ocupadas: 12,
    emEspera: 3,
    ocupacaoPercentual: 60.0,
    frequenciaPercentual: 87.5,
  },
  {
    atividadeId: 'atv_7e8f9a0b',
    titulo: 'Palestra de abertura',
    tipo: 'palestra',
    vagas: 100,
    ocupadas: 80,
    emEspera: 0,
    ocupacaoPercentual: 80.0,
    frequenciaPercentual: null,
  },
];

const SEM_CHANCE = [
  { participanteId: 'p-heitor', nome: 'Heitor Campos', faltas: 2, faltasPermitidas: 1 },
];

const BLOQUEIOS = [
  {
    participanteId: 'p-heitor',
    nome: 'Heitor Campos',
    atividades: ['atv_1a2b3c4d', 'atv_7e8f9a0b'],
    bloqueadoDesde: '2026-10-19T18:00:00-03:00',
  },
];

function criarApiFalsa({ atividades = ATIVIDADES, semChance = [], bloqueios = [], erro = null } = {}) {
  const bloqueiosAtivos = [...bloqueios];
  return {
    listarPainelAtividades: vi.fn(() =>
      erro ? Promise.reject(erro) : Promise.resolve(atividades),
    ),
    listarSemChance: vi.fn(() => Promise.resolve(semChance)),
    listarBloqueios: vi.fn(() =>
      erro ? Promise.reject(erro) : Promise.resolve([...bloqueiosAtivos]),
    ),
    desbloquearParticipante: vi.fn((participanteId) => {
      const indice = bloqueiosAtivos.findIndex((b) => b.participanteId === participanteId);
      if (indice !== -1) bloqueiosAtivos.splice(indice, 1);
      return Promise.resolve();
    }),
    baixarFrequenciaCSV: vi.fn(() => Promise.resolve()),
  };
}

describe('PainelOrganizacao', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lista as atividades do painel com ocupação e frequência', async () => {
    const api = criarApiFalsa();
    render(<PainelOrganizacao api={api} />);

    expect(await screen.findByText('Flutter do zero')).toBeInTheDocument();
    expect(screen.getByText(/minicurso/)).toBeInTheDocument();
    expect(screen.getByText(/Ocupação: 60% \| Frequência: 87\.5%/)).toBeInTheDocument();
    expect(api.listarPainelAtividades).toHaveBeenCalledTimes(1);
  });

  it('mostra N/A na frequência quando não há encontros encerrados', async () => {
    const api = criarApiFalsa();
    render(<PainelOrganizacao api={api} />);

    expect(await screen.findByText('Palestra de abertura')).toBeInTheDocument();
    expect(screen.getByText(/Ocupação: 80% \| Frequência: N\/A/)).toBeInTheDocument();
  });

  it('mostra estado vazio quando não há atividades válidas no painel', async () => {
    const api = criarApiFalsa({ atividades: [] });
    render(<PainelOrganizacao api={api} />);

    expect(await screen.findByRole('status')).toHaveTextContent('Nenhuma atividade encontrada.');
  });

  it('mostra os participantes sem chance de certificado da atividade selecionada', async () => {
    const api = criarApiFalsa({ semChance: SEM_CHANCE });
    render(<PainelOrganizacao api={api} />);

    await screen.findByText('Flutter do zero');
    await userEvent.click(screen.getAllByRole('button', { name: 'Ver detalhes' })[0]);

    const secaoSemChance = await screen.findByRole('region', {
      name: 'Participantes sem chance de certificado',
    });
    expect(within(secaoSemChance).getByText('Heitor Campos')).toBeInTheDocument();
    expect(api.listarSemChance).toHaveBeenCalledWith('atv_1a2b3c4d');
  });

  it('baixa a planilha CSV de frequência da atividade selecionada', async () => {
    const api = criarApiFalsa();
    render(<PainelOrganizacao api={api} />);

    await screen.findByText('Flutter do zero');
    await userEvent.click(screen.getAllByRole('button', { name: 'Ver detalhes' })[0]);
    await screen.findByRole('region', { name: 'Participantes sem chance de certificado' });

    await userEvent.click(screen.getByRole('button', { name: 'Baixar Planilha CSV de Frequência' }));

    expect(api.baixarFrequenciaCSV).toHaveBeenCalledWith('atv_1a2b3c4d');
  });

  it('lista os participantes bloqueados com opção de desbloquear', async () => {
    const api = criarApiFalsa({ bloqueios: BLOQUEIOS });
    render(<PainelOrganizacao api={api} />);

    await screen.findByText('Flutter do zero');
    await userEvent.click(screen.getAllByRole('button', { name: 'Ver detalhes' })[0]);

    const secaoBloqueios = await screen.findByRole('region', { name: 'Bloqueios por faltas' });
    expect(within(secaoBloqueios).getByText('Heitor Campos')).toBeInTheDocument();
    expect(
      within(secaoBloqueios).getByRole('button', { name: 'Desbloquear participante' }),
    ).toBeInTheDocument();
  });

  it('desbloqueia o participante e atualiza a lista de bloqueios', async () => {
    const api = criarApiFalsa({ bloqueios: BLOQUEIOS });
    render(<PainelOrganizacao api={api} />);

    await screen.findByText('Flutter do zero');
    await userEvent.click(screen.getAllByRole('button', { name: 'Ver detalhes' })[0]);

    const secaoBloqueios = await screen.findByRole('region', { name: 'Bloqueios por faltas' });
    await userEvent.click(
      within(secaoBloqueios).getByRole('button', { name: 'Desbloquear participante' }),
    );

    await waitFor(() => expect(api.desbloquearParticipante).toHaveBeenCalledWith('p-heitor'));
    expect(api.listarBloqueios).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(within(secaoBloqueios).queryByText('Heitor Campos')).not.toBeInTheDocument(),
    );
  });

  it('mostra o erro cru da API quando o acesso ao painel é negado', async () => {
    const api = criarApiFalsa({
      erro: { erro: 'NAO_AUTORIZADO', mensagem: 'Acesso restrito à organização.', status: 403 },
    });
    render(<PainelOrganizacao api={api} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'NAO_AUTORIZADO: Acesso restrito à organização.',
    );
  });
});