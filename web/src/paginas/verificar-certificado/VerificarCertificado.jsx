import { useState } from 'react';

export default function VerificarCertificado({ api }) {
  const [codigo, setCodigo] = useState('');
  const [verificacao, setVerificacao] = useState(null);
  const [erro, setErro] = useState(null);
  const [verificando, setVerificando] = useState(false);

  async function handleVerificar(evento) {
    evento.preventDefault();
    setErro(null);
    setVerificacao(null);
    setVerificando(true);
    try {
      const resposta = await api.verificarCertificado(codigo.trim());
      setVerificacao(resposta);
    } catch (erroDaApi) {
      setErro(erroDaApi);
    } finally {
      setVerificando(false);
    }
  }

  return (
    <section aria-label="Verificação pública de certificado">
      <h2>Verificar Certificado</h2>
      <form onSubmit={handleVerificar}>
        <label htmlFor="codigo-certificado">Código do certificado</label>
        <input
          id="codigo-certificado"
          value={codigo}
          onChange={(evento) => setCodigo(evento.target.value)}
          placeholder="SA26-XXXX-XXXX"
        />
        <button type="submit" disabled={verificando || codigo.trim() === ''}>
          Verificar
        </button>
      </form>
      {erro && (
        <p role="alert">
          {erro.erro}: {erro.mensagem || erro.message}
        </p>
      )}
      {verificacao && (
        <dl>
          <dt>Código</dt>
          <dd>{verificacao.codigo}</dd>
          <dt>Participante</dt>
          <dd>{verificacao.participante}</dd>
          <dt>Atividade</dt>
          <dd>{verificacao.atividade}</dd>
          <dt>Carga horária</dt>
          <dd>{verificacao.cargaHorariaMinutos} min</dd>
          <dt>Emitido em</dt>
          <dd>{verificacao.emitidoEm}</dd>
        </dl>
      )}
    </section>
  );
}
