import { useEffect, useState } from 'react';

export default function CriarAtividade({ api }) {
  const [salas, setSalas] = useState([]);
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('palestra');
  const [salaId, setSalaId] = useState('');
  const [vagas, setVagas] = useState('');
  const [encontros, setEncontros] = useState([{ inicio: '', fim: '' }]);
  const [erro, setErro] = useState(null);
  const [criada, setCriada] = useState(null);

  useEffect(() => {
    api
      .listarSalas()
      .then((lista) => {
        setSalas(lista);
        setSalaId((atual) => atual || (lista[0] && lista[0].id) || '');
      })
      .catch(() => {});
  }, [api]);

  function alterarEncontro(indice, campo, valor) {
    setEncontros((atual) =>
      atual.map((encontro, i) => (i === indice ? { ...encontro, [campo]: valor } : encontro)),
    );
  }

  function adicionarEncontro() {
    setEncontros((atual) => [...atual, { inicio: '', fim: '' }]);
  }

  function removerEncontro(indice) {
    setEncontros((atual) => atual.filter((_, i) => i !== indice));
  }

  function aoEnviar(evento) {
    evento.preventDefault();
    setErro(null);
    setCriada(null);
    const corpo = {
      titulo,
      tipo,
      salaId,
      vagas: Number(vagas),
      encontros: encontros
        .filter((encontro) => encontro.inicio && encontro.fim)
        .map((encontro) => ({
          inicio: new Date(encontro.inicio).toISOString(),
          fim: new Date(encontro.fim).toISOString(),
        })),
    };
    api
      .criarAtividade(corpo)
      .then(setCriada)
      .catch((erroDaApi) => setErro(erroDaApi));
  }

  return (
    <section aria-label="Criar atividade">
      <h2>Nova atividade</h2>

      {erro && (
        <p role="alert">
          {erro.erro}: {erro.mensagem}
        </p>
      )}
      {criada && <p role="status">Atividade criada: {criada.titulo}</p>}

      <form onSubmit={aoEnviar}>
        <label>
          Título
          <input value={titulo} onChange={(evento) => setTitulo(evento.target.value)} />
        </label>

        <label>
          Tipo
          <select value={tipo} onChange={(evento) => setTipo(evento.target.value)}>
            <option value="palestra">Palestra</option>
            <option value="minicurso">Minicurso</option>
          </select>
        </label>

        <label>
          Sala
          <select value={salaId} onChange={(evento) => setSalaId(evento.target.value)}>
            {salas.map((sala) => (
              <option key={sala.id} value={sala.id}>
                {sala.nome}
              </option>
            ))}
          </select>
        </label>

        <label>
          Vagas
          <input
            type="number"
            value={vagas}
            onChange={(evento) => setVagas(evento.target.value)}
          />
        </label>

        <fieldset aria-label="Encontros">
          <legend>Encontros</legend>
          {encontros.map((encontro, indice) => (
            <div key={indice}>
              <label>
                Início
                <input
                  type="datetime-local"
                  value={encontro.inicio}
                  onChange={(evento) => alterarEncontro(indice, 'inicio', evento.target.value)}
                />
              </label>
              <label>
                Fim
                <input
                  type="datetime-local"
                  value={encontro.fim}
                  onChange={(evento) => alterarEncontro(indice, 'fim', evento.target.value)}
                />
              </label>
              {encontros.length > 1 && (
                <button type="button" onClick={() => removerEncontro(indice)}>
                  Remover encontro
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={adicionarEncontro}>
            Adicionar encontro
          </button>
        </fieldset>

        <button type="submit">Criar atividade</button>
      </form>
    </section>
  );
}