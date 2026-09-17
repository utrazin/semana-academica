export const API_URL =
  import.meta.env.API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const USUARIOS = [
  { id: 'org-ana', nome: 'Ana Beatriz Lima', papel: 'organizacao' },
  { id: 'org-bruno', nome: 'Bruno Tavares', papel: 'organizacao' },
  { id: 'p-carla', nome: 'Carla Mendes Souza', papel: 'participante' },
  { id: 'p-diego', nome: 'Diego Alves', papel: 'participante' },
  { id: 'p-elisa', nome: 'Elisa Fernandes da Rocha', papel: 'participante' },
  { id: 'p-fabio', nome: 'Fábio Nogueira', papel: 'participante' },
  { id: 'p-gabriela', nome: 'Gabriela Moura Castro', papel: 'participante' },
  { id: 'p-heitor', nome: 'Heitor Campos', papel: 'participante' },
  { id: 'p-isadora', nome: 'Isadora Ribeiro dos Santos', papel: 'participante' },
  { id: 'p-joao', nome: 'João Pedro Martins', papel: 'participante' },
];

const CHAVE_USUARIO = 'semana-academica.usuario';

export function definirUsuario(id) {
  if (id == null) {
    localStorage.removeItem(CHAVE_USUARIO);
  } else {
    localStorage.setItem(CHAVE_USUARIO, id);
  }
}

export function obterUsuarioAtual() {
  const id = localStorage.getItem(CHAVE_USUARIO);
  return USUARIOS.some((usuario) => usuario.id === id) ? id : null;
}

async function chamar(caminho, { metodo = 'GET', corpo } = {}) {
  const cabecalhos = corpo !== undefined ? { 'Content-Type': 'application/json' } : {};
  const usuario = obterUsuarioAtual();
  if (usuario) {
    cabecalhos['X-Usuario'] = usuario;
  }

  const resposta = await fetch(`${API_URL}${caminho}`, {
    method: metodo,
    headers: cabecalhos,
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });

  if (!resposta.ok) {
    let corpo = {};
    try {
      corpo = await resposta.json();
    } catch {
      corpo = {};
    }
    throw Object.assign(new Error(corpo.mensagem || 'Erro da API.'), {
      erro: corpo.erro || 'ERRO_DESCONHECIDO',
      status: resposta.status,
    });
  }

  return resposta.json();
}

export function listarAtividades({ dia, tipo } = {}) {
  const parametros = new URLSearchParams();
  if (dia !== undefined) parametros.set('dia', dia);
  if (tipo !== undefined) parametros.set('tipo', tipo);
  const sufixo = parametros.toString();
  return chamar(`/atividades${sufixo ? `?${sufixo}` : ''}`);
}

export function obterAtividade(id) {
  return chamar(`/atividades/${encodeURIComponent(id)}`);
}

export function listarSalas() {
  return chamar('/salas');
}

export function criarAtividade(corpo) {
  return chamar('/atividades', { metodo: 'POST', corpo });
}

export default {
  API_URL,
  USUARIOS,
  definirUsuario,
  obterUsuarioAtual,
  listarAtividades,
  obterAtividade,
  listarSalas,
  criarAtividade,
};