import { useEffect, useState } from 'react';

export default function MinhasInscricoes({ api }) {
  const [inscricoes, setInscricoes] = useState([]);
  const [erro, setErro] = useState(null);
  const [sucesso, setSucesso] = useState(null);

  async function carregar() {
    setErro(null);
    try {
      const lista = await api.listarInscricoes();
      setInscricoes(lista);
    } catch (err) {
      setErro(err);
    }
  }

  useEffect(() => {
    carregar();
  }, [api]);

  async function handleConfirmar(id) {
    setErro(null);
    setSucesso(null);
    try {
      await api.confirmarConvocacao(id);
      setSucesso('Convocação confirmada com sucesso!');
      await carregar();
    } catch (err) {
      setErro(err);
    }
  }

  async function handleCancelar(id) {
    setErro(null);
    setSucesso(null);
    try {
      await api.cancelarInscricao(id);
      setSucesso('Inscrição cancelada com sucesso!');
      await carregar();
    } catch (err) {
      setErro(err);
    }
  }

  return (
    <section aria-label="Minhas inscrições">
      <h2>Minhas Inscrições</h2>
      {sucesso && <p role="status">{sucesso}</p>}
      {erro && (
        <p role="alert">
          {erro.erro}: {erro.mensagem || erro.message}
        </p>
      )}

      {inscricoes.length === 0 && !erro && <p role="status">Nenhuma inscrição encontrada.</p>}

      {inscricoes.length > 0 && (
        <ul>
          {inscricoes.map((inscricao) => (
            <li key={inscricao.id} aria-label={`Inscrição ${inscricao.id}`}>
              <p>Atividade: {inscricao.atividadeId}</p>
              <p>Status: {inscricao.status}</p>
              {inscricao.posicaoNaEspera !== null && inscricao.posicaoNaEspera !== undefined && (
                <p>Posição na espera: {inscricao.posicaoNaEspera}</p>
              )}
              {inscricao.convocadaAte && (
                <p>Convocada até: {new Date(inscricao.convocadaAte).toLocaleString()}</p>
              )}
              {inscricao.status === 'convocada' && (
                <button type="button" onClick={() => handleConfirmar(inscricao.id)}>
                  Confirmar convocação
                </button>
              )}
              {['confirmada', 'em_espera', 'convocada'].includes(inscricao.status) && (
                <button type="button" onClick={() => handleCancelar(inscricao.id)}>
                  Cancelar inscrição
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
