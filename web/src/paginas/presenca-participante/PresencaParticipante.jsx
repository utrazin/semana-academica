import { useState } from 'react';

export default function PresencaParticipante({ api, encontroId }) {
  const [codigo, setCodigo] = useState('');
  const [presenca, setPresenca] = useState(null);
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function handleRegistrar(evento) {
    evento.preventDefault();
    setErro(null);
    setPresenca(null);
    setEnviando(true);
    try {
      const resposta = await api.registrarPresenca(encontroId, { codigo });
      setPresenca(resposta);
    } catch (err) {
      setErro(err);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section aria-label="Registrar presença">
      <h2>Registrar presença</h2>
      <form onSubmit={handleRegistrar}>
        <label htmlFor="codigo-presenca">Código do encontro</label>
        <input
          id="codigo-presenca"
          value={codigo}
          onChange={(evento) => setCodigo(evento.target.value)}
        />
        <button type="submit" disabled={enviando}>
          Registrar presença
        </button>
      </form>
      {erro && (
        <p role="alert">
          {erro.erro}: {erro.mensagem || erro.message}
        </p>
      )}
      {presenca && <p role="status">Presença registrada (origem: {presenca.origem}).</p>}
    </section>
  );
}