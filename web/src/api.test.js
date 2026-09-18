import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api, { API_URL, USUARIOS } from './api.js';

describe('api.js', () => {
  beforeEach(() => {
    localStorage.clear();
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => [] }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tem os 10 usuários da seção 4 do contrato', () => {
    expect(USUARIOS).toHaveLength(10);
    expect(USUARIOS.map((usuario) => usuario.id)).toEqual([
      'org-ana',
      'org-bruno',
      'p-carla',
      'p-diego',
      'p-elisa',
      'p-fabio',
      'p-gabriela',
      'p-heitor',
      'p-isadora',
      'p-joao',
    ]);
  });

  it('le API_URL do ambiente com fallback para localhost', () => {
    expect(API_URL).toMatch(/^https?:\/\/.+/);
  });

  it('manda X-Usuario em toda chamada quando há usuário no localStorage', async () => {
    api.definirUsuario('p-carla');
    await api.listarSalas();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_URL}/salas`,
      expect.objectContaining({ headers: { 'X-Usuario': 'p-carla' } }),
    );
  });

  it('lista atividades com os filtros dia e tipo na query string', async () => {
    api.definirUsuario('org-ana');
    await api.listarAtividades({ dia: '2026-10-20', tipo: 'minicurso' });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_URL}/atividades?dia=2026-10-20&tipo=minicurso`,
      expect.objectContaining({ headers: { 'X-Usuario': 'org-ana' } }),
    );
  });

  it('busca uma atividade por id', async () => {
    api.definirUsuario('p-carla');
    await api.obterAtividade('atv_1a2b3c4d');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_URL}/atividades/atv_1a2b3c4d`,
      expect.objectContaining({ headers: { 'X-Usuario': 'p-carla' } }),
    );
  });

  it('cria atividade com POST /atividades enviando o corpo como JSON', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ id: 'atv_a1b2c3d4', titulo: 'Flutter do zero' }),
    }));
    api.definirUsuario('org-ana');
    const corpo = {
      titulo: 'Flutter do zero',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 20,
      encontros: [],
    };

    await api.criarAtividade(corpo);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_URL}/atividades`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'X-Usuario': 'org-ana', 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      }),
    );
  });

  it('rejeita com o erro da API quando a resposta não é ok', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 422,
      json: async () => ({ erro: 'DADOS_INVALIDOS', mensagem: '?tipo só aceita palestra ou minicurso.' }),
    }));

    await expect(api.listarAtividades({ tipo: 'oficina' })).rejects.toMatchObject({
      erro: 'DADOS_INVALIDOS',
      status: 422,
    });
  });

  it('inscreve em uma atividade com POST /atividades/:id/inscricoes', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ id: 'ins_1', status: 'confirmada' }),
    }));
    api.definirUsuario('p-carla');
    await api.inscrever('atv_123');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_URL}/atividades/atv_123/inscricoes`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'X-Usuario': 'p-carla' },
      }),
    );
  });

  it('lista inscrições com GET /inscricoes, opcionalmente filtrando por atividadeId', async () => {
    api.definirUsuario('p-carla');
    await api.listarInscricoes({ atividadeId: 'atv_123' });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_URL}/inscricoes?atividadeId=atv_123`,
      expect.objectContaining({ headers: { 'X-Usuario': 'p-carla' } }),
    );
  });

  it('obtém inscrição por id com GET /inscricoes/:id', async () => {
    api.definirUsuario('p-carla');
    await api.obterInscricao('ins_1');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_URL}/inscricoes/ins_1`,
      expect.objectContaining({ headers: { 'X-Usuario': 'p-carla' } }),
    );
  });

  it('cancela inscrição com POST /inscricoes/:id/cancelamento', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: 'ins_1', status: 'cancelada' }),
    }));
    api.definirUsuario('p-carla');
    await api.cancelarInscricao('ins_1');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_URL}/inscricoes/ins_1/cancelamento`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'X-Usuario': 'p-carla' },
      }),
    );
  });

  it('confirma convocação com POST /inscricoes/:id/confirmacao', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: 'ins_1', status: 'confirmada' }),
    }));
    api.definirUsuario('p-carla');
    await api.confirmarConvocacao('ins_1');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_URL}/inscricoes/ins_1/confirmacao`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'X-Usuario': 'p-carla' },
      }),
    );
  });

  it('rejeita com JA_INSCRITO quando inscrição falha', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 409,
      json: async () => ({ erro: 'JA_INSCRITO', mensagem: 'Participante já inscrito.' }),
    }));

    await expect(api.inscrever('atv_123')).rejects.toMatchObject({
      erro: 'JA_INSCRITO',
      status: 409,
    });
  });

  it('obtém o código de um encontro com GET /encontros/:id/codigo', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ encontroId: 'enc_1', codigo: 'K7M2QX', trocaEm: '…', validoAte: '…' }),
    }));
    api.definirUsuario('org-ana');
    const codigo = await api.obterCodigoDoEncontro('enc_1');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_URL}/encontros/enc_1/codigo`,
      expect.objectContaining({ headers: { 'X-Usuario': 'org-ana' } }),
    );
    expect(codigo.codigo).toBe('K7M2QX');
  });

  it('registra presença por QR com POST /encontros/:id/presencas', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ id: 'pre_1', origem: 'qr' }),
    }));
    api.definirUsuario('p-carla');
    await api.registrarPresenca('enc_1', { codigo: 'K7M2QX', lidoEm: '2026-10-19T19:03:20-03:00' });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_URL}/encontros/enc_1/presencas`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'X-Usuario': 'p-carla', 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: 'K7M2QX', lidoEm: '2026-10-19T19:03:20-03:00' }),
      }),
    );
  });

  it('registra presença manual com POST /encontros/:id/presencas/manual', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ id: 'pre_2', origem: 'manual' }),
    }));
    api.definirUsuario('org-ana');
    await api.registrarPresencaManual('enc_1', {
      participanteId: 'p-carla',
      justificativa: 'Esqueceu o celular.',
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_URL}/encontros/enc_1/presencas/manual`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'X-Usuario': 'org-ana', 'Content-Type': 'application/json' },
        body: JSON.stringify({ participanteId: 'p-carla', justificativa: 'Esqueceu o celular.' }),
      }),
    );
  });

  it('lista presenças de um encontro com GET /encontros/:id/presencas', async () => {
    api.definirUsuario('org-ana');
    await api.listarPresencas('enc_1');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_URL}/encontros/enc_1/presencas`,
      expect.objectContaining({ headers: { 'X-Usuario': 'org-ana' } }),
    );
  });

  it('emite certificado com POST /atividades/:id/certificado enviando X-Usuario', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ codigo: 'SA26-ABCD-EFGH', atividadeId: 'atv_1' }),
    }));
    api.definirUsuario('p-carla');
    await api.emitirCertificado('atv_1');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_URL}/atividades/atv_1/certificado`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'X-Usuario': 'p-carla' },
      }),
    );
  });

  it('lista certificados do participante com GET /certificados enviando X-Usuario', async () => {
    api.definirUsuario('p-carla');
    await api.listarCertificados();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_URL}/certificados`,
      expect.objectContaining({ headers: { 'X-Usuario': 'p-carla' } }),
    );
  });

  it('consulta extrato com GET /extrato enviando X-Usuario', async () => {
    api.definirUsuario('p-carla');
    await api.obterExtrato();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_URL}/extrato`,
      expect.objectContaining({ headers: { 'X-Usuario': 'p-carla' } }),
    );
  });

  it('verifica certificado pela rota pública sem enviar X-Usuario', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ codigo: 'SA26-ABCD-EFGH', participante: 'Carla M. S.' }),
    }));
    api.definirUsuario('p-carla');
    const resultado = await api.verificarCertificado('SA26-ABCD-EFGH');

    const [, opcoes] = globalThis.fetch.mock.calls[0];
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_URL}/certificados/SA26-ABCD-EFGH`,
      expect.anything(),
    );
    expect(opcoes.headers).not.toHaveProperty('X-Usuario');
    expect(resultado.participante).toBe('Carla M. S.');
  });
});