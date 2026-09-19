import { useState } from 'react';
import api, { USUARIOS } from './api.js';
import SelectorDeUsuario from './componentes/SelectorDeUsuario.jsx';
import CriarAtividade from './paginas/criar-atividade/CriarAtividade.jsx';
import Programacao from './paginas/programacao/Programacao.jsx';
import Atividade from './paginas/atividade/Atividade.jsx';
import MinhasInscricoes from './paginas/minhas-inscricoes/MinhasInscricoes.jsx';
import MeusCertificados from './paginas/meus-certificados/MeusCertificados.jsx';
import Extrato from './paginas/extrato/Extrato.jsx';
import VerificarCertificado from './paginas/verificar-certificado/VerificarCertificado.jsx';
import PresencaOrganizacao from './paginas/presenca-organizacao/PresencaOrganizacao.jsx';
import PresencaParticipante from './paginas/presenca-participante/PresencaParticipante.jsx';
import PainelOrganizacao from './paginas/painel/PainelOrganizacao.jsx';

export default function App() {
  const [usuarioId, setUsuarioId] = useState(() => api.obterUsuarioAtual() || USUARIOS[0].id);
  const [vista, setVista] = useState('programacao');
  const [atividadeIdSelecionada, setAtividadeIdSelecionada] = useState(null);
  const [encontroIdSelecionado, setEncontroIdSelecionado] = useState(null);

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

  function irParaPresencaDoEncontro(id) {
    setEncontroIdSelecionado(id);
    setVista(usuario.papel === 'organizacao' ? 'presenca-organizacao' : 'presenca-participante');
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
        {usuario.papel === 'participante' && (
          <button type="button" onClick={() => setVista('meus-certificados')} aria-pressed={vista === 'meus-certificados'}>
            Meus Certificados
          </button>
        )}
        {usuario.papel === 'participante' && (
          <button type="button" onClick={() => setVista('extrato')} aria-pressed={vista === 'extrato'}>
            Extrato de Horas
          </button>
        )}
        <button type="button" onClick={() => setVista('verificar-certificado')} aria-pressed={vista === 'verificar-certificado'}>
          Verificar Certificado
        </button>
        {usuario.papel === 'organizacao' && (
          <button type="button" onClick={() => setVista('painel-organizacao')} aria-pressed={vista === 'painel-organizacao'}>
            Painel Organização
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
      {usuario.papel === 'participante' && vista === 'meus-certificados' && (
        <MeusCertificados api={api} />
      )}
      {usuario.papel === 'participante' && vista === 'extrato' && (
        <Extrato api={api} />
      )}
      {vista === 'verificar-certificado' && (
        <VerificarCertificado api={api} />
      )}
      {vista === 'atividade' && (
        <div>
          <button type="button" onClick={() => setVista('programacao')}>Voltar para Programação</button>
          <Atividade
            api={api}
            id={atividadeIdSelecionada}
            aoSelecionarEncontro={irParaPresencaDoEncontro}
          />
        </div>
      )}
      {usuario.papel === 'organizacao' && vista === 'presenca-organizacao' && (
        <div>
          <button type="button" onClick={() => setVista('atividade')}>Voltar para Atividade</button>
          <PresencaOrganizacao api={api} encontroId={encontroIdSelecionado} />
        </div>
      )}
      {usuario.papel === 'organizacao' && vista === 'painel-organizacao' && (
        <div>
          <button type="button" onClick={() => setVista('atividade')}>Voltar para Atividade</button>
          <PainelOrganizacao api={api} />
        </div>
      )}
      {usuario.papel === 'participante' && vista === 'presenca-participante' && (
        <div>
          <button type="button" onClick={() => setVista('atividade')}>Voltar para Atividade</button>
          <PresencaParticipante api={api} encontroId={encontroIdSelecionado} />
        </div>
      )}
    </main>
  );
}