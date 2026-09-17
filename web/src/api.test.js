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