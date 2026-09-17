import { useState } from 'react';
import api, { USUARIOS } from './api.js';
import SelectorDeUsuario from './componentes/SelectorDeUsuario.jsx';
import CriarAtividade from './paginas/criar-atividade/CriarAtividade.jsx';
import Programacao from './paginas/programacao/Programacao.jsx';
import Atividade from './paginas/atividade/Atividade.jsx';
import MinhasInscricoes from './paginas/minhas-inscricoes/MinhasInscricoes.jsx';

export default function App() {
  const [usuarioId, setUsuarioId] = useState(() => api.obterUsuarioAtual() || USUARIOS[0].id);
  const [vista, setVista] = useState('programacao');
  const [atividadeIdSelecionada, setAtividadeIdSelecionada] = useState(null);

  const usuario = USUARIOS.find((u) => u.id === usuarioId) || USUARIOS[0];

  function trocarUsuario(id) {
    api.definirUsuario(id);
    setUsuarioId(id);
    setVista('programacao');
  }

  function irParaAtividade(id) {
    setAtividadeIdSelecionada(id);
    setVista('atividade');
  }

  return (
    <main>
      <h1>Semana Acadêmica 2026</h1>
      <SelectorDeUsuario usuarios={USUARIOS} valor={usuarioId} aoTrocar={trocarUsuario} />

      <nav aria-label="Navegação principal">
        <button type="button" onClick={() => setVista('programacao')} aria-pressed={vista === 'programacao'}>
          Programação
        </button>
        {usuario.papel === 'participante' && (
          <button type="button" onClick={() => setVista('minhas-inscricoes')} aria-pressed={vista === 'minhas-inscricoes'}>
            Minhas Inscrições
          </button>
        )}
      </nav>

      {usuario.papel === 'organizacao' && <CriarAtividade api={api} />}

      {vista === 'programacao' && (
        <Programacao api={api} aoSelecionarAtividade={irParaAtividade} />
      )}
      {vista === 'minhas-inscricoes' && (
        <MinhasInscricoes api={api} />
      )}
      {vista === 'atividade' && (
        <div>
          <button type="button" onClick={() => setVista('programacao')}>Voltar para Programação</button>
          <Atividade api={api} id={atividadeIdSelecionada} />
        </div>
      )}
    </main>
  );
}