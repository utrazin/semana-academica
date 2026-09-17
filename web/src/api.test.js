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
});