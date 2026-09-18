import { useEffect, useState } from 'react';

export default function Extrato({ api }) {
  const [extrato, setExtrato] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    setErro(null);
    setExtrato(null);
    api
      .obterExtrato()
      .then(setExtrato)
      .catch((erroDaApi) => setErro(erroDaApi));
  }, [api]);

  return (
    <section aria-label="Extrato de horas complementares">
      <h2>Extrato de Horas Complementares</h2>
      {erro && (
        <p role="alert">
          {erro.erro}: {erro.mensagem || erro.message}
        </p>
      )}
      {!erro && extrato === null && <p role="status">Carregando extrato...</p>}
      {!erro && extrato !== null && extrato.itens.length === 0 && (
        <p role="status">Nenhuma atividade elegível.</p>
      )}
      {!erro && extrato !== null && extrato.itens.length > 0 && (
        <ul>
          {extrato.itens.map((item) => (
            <li key={item.atividadeId} aria-label={item.titulo}>
              <p>{item.titulo}</p>
              <p>Tipo: {item.tipo}</p>
              <p>Carga horária: {item.cargaHorariaMinutos} min</p>
              {item.codigo ? <p>Código: {item.codigo}</p> : <p>Ainda não emitido</p>}
            </li>
          ))}
        </ul>
      )}
      {!erro && extrato !== null && (
        <div>
          <p>Palestras: {extrato.palestrasMinutos} min</p>
          <p>Minicursos: {extrato.minicursosMinutos} min</p>
          <p>Total: {extrato.totalMinutos} min</p>
          <p>Aproveitado: {extrato.aproveitadoMinutos} min</p>
        </div>
      )}
    </section>
  );
}
