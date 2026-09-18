import { useEffect, useState } from 'react';

export default function MeusCertificados({ api }) {
  const [certificados, setCertificados] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    setErro(null);
    setCertificados(null);
    api
      .listarCertificados()
      .then(setCertificados)
      .catch((erroDaApi) => setErro(erroDaApi));
  }, [api]);

  return (
    <section aria-label="Meus certificados">
      <h2>Meus Certificados</h2>
      {erro && (
        <p role="alert">
          {erro.erro}: {erro.mensagem || erro.message}
        </p>
      )}
      {!erro && certificados === null && <p role="status">Carregando certificados...</p>}
      {!erro && certificados !== null && certificados.length === 0 && (
        <p role="status">Nenhum certificado emitido.</p>
      )}
      {!erro && certificados !== null && certificados.length > 0 && (
        <ul>
          {certificados.map((certificado) => (
            <li key={certificado.codigo} aria-label={certificado.codigo}>
              <p>{certificado.codigo}</p>
              <p>Atividade: {certificado.atividadeId}</p>
              <p>Carga horária: {certificado.cargaHorariaMinutos} min</p>
              <p>
                Presenças: {certificado.presencas} de {certificado.encontros}
              </p>
              <p>Emitido em: {certificado.emitidoEm}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
