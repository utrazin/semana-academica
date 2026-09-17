import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CriarAtividade from './CriarAtividade.jsx';

const SALAS = [
  { id: 'auditorio', nome: 'Auditório Central', capacidade: 200 },
  { id: 'sala-101', nome: 'Sala 101', capacidade: 40 },
  { id: 'lab-3', nome: 'Laboratório 3', capacidade: 20 },
];

const atividadeCriada = {
  id: 'atv_a1b2c3d4',
  titulo: 'Flutter do zero',
  tipo: 'minicurso',
  salaId: 'lab-3',
  vagas: 20,
  encontros: [
    { id: 'enc_1', inicio: new Date('2026-10-19T19:00:00').toISOString(), fim: new Date('2026-10-19T22:00:00').toISOString() },
  ],
  cargaHorariaMinutos: 180,
  situacao: 'prevista',
  ocupadas: 0,
  vagasRestantes: 20,
  emEspera: 0,
};

function criarApiFalsa({ criada = atividadeCriada, erro } = {}) {
  return {
    listarSalas: vi.fn(async () => SALAS),
    criarAtividade: vi.fn(() =>
      erro ? Promise.reject(erro) : Promise.resolve(criada),
    ),
  };
}

async function preencherFormulario() {
  await screen.findByText('Laboratório 3');
  await userEvent.type(screen.getByLabelText(/Título/), 'Flutter do zero');
  await userEvent.selectOptions(screen.getByLabelText(/Tipo/), 'minicurso');
  await userEvent.selectOptions(screen.getByLabelText(/Sala/), 'lab-3');
  await userEvent.clear(screen.getByLabelText(/Vagas/));
  await userEvent.type(screen.getByLabelText(/Vagas/), '20');
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar encontro' }));
  fireEvent.change(screen.getAllByLabelText(/Início/)[0], {
    target: { value: '2026-10-19T19:00' },
  });
  fireEvent.change(screen.getAllByLabelText(/Fim/)[0], {
    target: { value: '2026-10-19T22:00' },
  });
  fireEvent.change(screen.getAllByLabelText(/Início/)[1], {
    target: { value: '2026-10-20T19:00' },
  });
  fireEvent.change(screen.getAllByLabelText(/Fim/)[1], {
    target: { value: '2026-10-20T22:00' },
  });
}

async function submeter(api) {
  await preencherFormulario();
  await userEvent.click(screen.getByRole('button', { name: 'Criar atividade' }));
}

describe('CriarAtividade', () => {
  it('cria a atividade quando a API responde 201 e mostra o sucesso', async () => {
    const api = criarApiFalsa();
    render(<CriarAtividade api={api} />);
    await submeter(api);

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Atividade criada: Flutter do zero',
    );
    expect(api.listarSalas).toHaveBeenCalled();
    expect(api.criarAtividade).toHaveBeenCalledWith({
      titulo: 'Flutter do zero',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 20,
      encontros: [
        { inicio: new Date('2026-10-19T19:00').toISOString(), fim: new Date('2026-10-19T22:00').toISOString() },
        { inicio: new Date('2026-10-20T19:00').toISOString(), fim: new Date('2026-10-20T22:00').toISOString() },
      ],
    });
  });

  it('mostra o erro 422 DADOS_INVALIDOS cru quando a API responde assim', async () => {
    const api = criarApiFalsa({ erro: { erro: 'DADOS_INVALIDOS', mensagem: 'Corpo mal formado.' } });
    render(<CriarAtividade api={api} />);
    await submeter(api);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'DADOS_INVALIDOS: Corpo mal formado.',
    );
  });

  it('mostra o erro QUANTIDADE_DE_ENCONTROS cru quando a API responde assim', async () => {
    const api = criarApiFalsa({
      erro: { erro: 'QUANTIDADE_DE_ENCONTROS', mensagem: 'Minicurso precisa de 2 a 5 encontros.' },
    });
    render(<CriarAtividade api={api} />);
    await submeter(api);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'QUANTIDADE_DE_ENCONTROS: Minicurso precisa de 2 a 5 encontros.',
    );
  });

  it('mostra o erro ENCONTRO_INVALIDO cru quando a API responde assim', async () => {
    const api = criarApiFalsa({
      erro: { erro: 'ENCONTRO_INVALIDO', mensagem: 'Encontro com menos de 1 hora.' },
    });
    render(<CriarAtividade api={api} />);
    await submeter(api);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'ENCONTRO_INVALIDO: Encontro com menos de 1 hora.',
    );
  });

  it('mostra o erro VAGAS_ACIMA_DA_CAPACIDADE cru quando a API responde assim', async () => {
    const api = criarApiFalsa({
      erro: { erro: 'VAGAS_ACIMA_DA_CAPACIDADE', mensagem: 'Vagas acima da capacidade da sala.' },
    });
    render(<CriarAtividade api={api} />);
    await submeter(api);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'VAGAS_ACIMA_DA_CAPACIDADE: Vagas acima da capacidade da sala.',
    );
  });

  it('mostra o erro 404 NAO_ENCONTRADO cru quando a API responde assim', async () => {
    const api = criarApiFalsa({ erro: { erro: 'NAO_ENCONTRADO', mensagem: 'Sala não existe.' } });
    render(<CriarAtividade api={api} />);
    await submeter(api);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'NAO_ENCONTRADO: Sala não existe.',
    );
  });

  it('mostra o erro 409 CONFLITO_DE_SALA cru quando a API responde assim', async () => {
    const api = criarApiFalsa({
      erro: { erro: 'CONFLITO_DE_SALA', mensagem: 'A sala já está ocupada nesse horário.' },
    });
    render(<CriarAtividade api={api} />);
    await submeter(api);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'CONFLITO_DE_SALA: A sala já está ocupada nesse horário.',
    );
  });

  it('mostra o erro 403 SOMENTE_ORGANIZACAO cru quando a API responde assim', async () => {
    const api = criarApiFalsa({
      erro: { erro: 'SOMENTE_ORGANIZACAO', mensagem: 'Só a organização cria atividades.' },
    });
    render(<CriarAtividade api={api} />);
    await submeter(api);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'SOMENTE_ORGANIZACAO: Só a organização cria atividades.',
    );
  });
});