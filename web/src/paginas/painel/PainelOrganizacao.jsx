import { useEffect, useState } from 'react';
import api from '../api.js';

export default function PainelOrganizacao() {
  const [atividades, setAtividades] = useState(null);
  const [atividadeSelecionada, setAtividadeSelecionada] = useState(null);
  const [semChance, setSemChance] = useState(null);
  const [bloqueios, setBloqueios] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    setErro(null);
    setAtividades(null);
    api.listarPainelAtividades().then(setAtividades).catch((erroDaApi) => setErro(erroDaApi));
  }, [api]);

  useEffect(() => {
    if (!atividadeSelecionada) {
      setSemChance(null);
      setBloqueios(null);
      return;
    }
    setErro(null);
    setSemChance(null);
    Promise.all([
      api.listarSemChance(atividadeSelecionada.id).then(setSemChance).catch((e) => setErro(e)),
      api.listarBloqueios().then(setBloqueios).catch((e) => setErro(e)),
    ]);
  }, [api, atividadeSelecionada]);

  function handleBaixarCSV(atividadeId) {
    window.location.href = `/painel/atividades/${atividadeId}/frequencia.csv`;
  }

  if (erro) {
    return (
      <section aria-label="Painel da Organização - Erro">
        <h2>Painel da Organização</h2>
        <p role="alert" style={{ color: 'red' }}>
          {erro.erro}: {erro.mensagem || erro.message}
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Painel da Organização">
      <h2>Painel da Organização</h2>

      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={() => setAtividadeSelecionada(null)}
          style={{ marginRight: '0.5rem' }}
        >
          Listar Todas Atividades
        </button>
        {atividadeSelecionada && (
          <button
            onClick={() => setAtividadeSelecionada(null)}
            style={{ marginLeft: '0.5rem' }}
          >
            Voltar
          </button>
        )}
      </div>

      {atividadeSelecionada ? (
        <div>
          <h3>Atividade: {atividadeSelecionada.titulo}</h3>
          <p>
            Ocupação: {atividadeSelecionada.ocupacaoPercentual}% |
            Frequência: {atividadeSelecionada.frequenciaPercentual}%
          </p>
        </div>
      ) : (
        <ul>
          {atividades && atividades.length > 0 ? (
            activities.map((atividade) => (
              <li key={atividade.id} style={{ marginBottom: '0.5rem' }}>
                <strong>{atividade.titulo}</strong> ({atividade.tipo})
                <br />
                Ocupação: {atividade.ocupacaoPercentual}% | Frequência: {atividade.frequenciaPercentual}%
                <br />
                <button
                  onClick={() => setAtividadeSelecionada(atividade)}
                  style={{ marginLeft: '1rem', background: '#e2e8f0', border: 'none', padding: '0.3rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Ver detalhes
                </button>
              </li>
            ))
          ) : (
            <p role="status">Nenhuma atividade encontrada.</p>
          )}
        </ul>
      )}

      {atividadeSelecionada && semChance !== null && (
        <section aria-label="Participantes sem chance de certificado">
          <h3>Participantes sem chance de certificado</h3>
          <p>
            Lista de participantes com mais de 25% de faltas nesta atividade
            (não poderão emitir certificado)
          </p>
          {semChance.length > 0 ? (
            <ul>
              {semChance.map((participante) => (
                <li key={participante.id} aria-label={participante.nome}>
                  {participante.nome}
                </li>
              ))}
            </ul>
          ) : (
            <p role="status">Nenhum participante sem chance de certificado.</p>
          )}
        </section>
      )}

      {atividadeSelecionada && bloqueios !== null && (
        <section aria-label="Bloqueios por faltas">
          <h3>Bloqueios por faltas</h3>
          <p>
            Participantes bloqueados (2+ atividades com excesivas faltas):
          </p>
          {bloqueios.length > 0 ? (
            <ul>
              {bloqueios.map((bloqueio) => (
                <li key={bloqueio.id} aria-label={bloqueio.nome}>
                  {bloqueio.nome}
                  <button
                    onClick={() => api.desbloquearParticipante(bloqueio.id)}
                    style={{
                      marginLeft: '0.5rem',
                      background: '#f87171',
                      color: 'white',
                      border: 'none',
                      padding: '0.3rem 0.5rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                    aria-label="Desbloquear participante"
                  >
                    Desbloquear
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p role="status">Nenhum participante bloqueado.</p>
          )}
        </section>
      )}

      {atividadeSelecionada && (
        <div style={{ marginTop: '1.5rem' }}>
          <button
            onClick={() => handleBaixarCSV(atividadeSelecionada.id)}
            style={{
              marginTop: '0.5rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Baixar Planilha CSV de Frequência
          </button>
        </div>
      )}
    </section>
  );
}