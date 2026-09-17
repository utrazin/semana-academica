import { useState } from 'react';
import api, { USUARIOS } from './api.js';
import SelectorDeUsuario from './componentes/SelectorDeUsuario.jsx';
import Programacao from './paginas/programacao/Programacao.jsx';

export default function App() {
  const [usuarioId, setUsuarioId] = useState(() => api.obterUsuarioAtual() || USUARIOS[0].id);

  function trocarUsuario(id) {
    api.definirUsuario(id);
    setUsuarioId(id);
  }

  return (
    <main>
      <h1>Semana Acadêmica 2026</h1>
      <SelectorDeUsuario usuarios={USUARIOS} valor={usuarioId} aoTrocar={trocarUsuario} />
      <Programacao api={api} />
    </main>
  );
}