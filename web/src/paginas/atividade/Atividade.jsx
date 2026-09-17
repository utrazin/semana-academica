import { useEffect, useMemo, useState } from 'react';

const ROTULOS_SITUACAO = {
  prevista: 'Prevista',
  em_andamento: 'Em andamento',
  encerrada: 'Encerrada',
  cancelada: 'Cancelada',
};

function rotuloTipo(tipo) {
  return tipo === 'minicurso' ? 'Minicurso' : 'Palestra';
}

function rotuloSituacao(situacao) {
  return ROTULOS_SITUACAO[situacao] || situacao;
}

function horarioEmBrasilia(iso) {
  return new Date(iso)
    .toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .replace('24:', '00:');
}

function formatarCargaHoraria(minutos) {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `${resto} min`;
  if (resto === 0) return `${horas}h`;
  return `${horas}h${resto}`;
}

export default function Atividade({ api, id }) {
  const [atividade, setAtividade] = useState(null);
  const [erro, setErro] = useState(null);
  const [salas, setSalas] = useState([]);

  useEffect(() => {
    api.listarSalas().then(setSalas).catch(() => {});
  }, [api]);

  useEffect(() => {
    setErro(null);
    setAtividade(null);
    api
      .obterAtividade(id)
      .then(setAtividade)
      .catch((erroDaApi) => setErro(erroDaApi));
  }, [api, id]);

  const nomeDaSala = useMemo(() => {
    const mapa = {};
    for (const sala of salas) {
      mapa[sala.id] = sala.nome;
    }
    return (salaId) => mapa[salaId] || salaId;
  }, [salas]);

  const encontros = useMemo(
    () =>
      atividade
        ? [...atividade.encontros].sort((a, b) => new Date(a.inicio) - new Date(b.inicio))
        : [],
    [atividade],
  );

  return (
    <section aria-label="Detalhes da atividade">
      {erro && (
        <p role="alert">
          {erro.erro}: {erro.mensagem || erro.message}
        </p>
      )}

      {atividade && !erro && (
        <article aria-label={atividade.titulo}>
          <h2>{atividade.titulo}</h2>
          <p>{rotuloTipo(atividade.tipo)}</p>
          <p>{nomeDaSala(atividade.salaId)}</p>
          <p>
            {atividade.vagasRestantes} de {atividade.vagas} vagas · {atividade.ocupadas}{' '}
            ocupadas
          </p>
          <p>Carga horária: {formatarCargaHoraria(atividade.cargaHorariaMinutos)}</p>
          <p>Situação: {rotuloSituacao(atividade.situacao)}</p>
          <ul aria-label="Encontros">
            {encontros.map((encontro) => (
              <li key={encontro.id}>
                {horarioEmBrasilia(encontro.inicio)}–{horarioEmBrasilia(encontro.fim)}
              </li>
            ))}
          </ul>
        </article>
      )}
    </section>
  );
}