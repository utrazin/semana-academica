import { useEffect, useMemo, useState } from 'react';

export const DIAS = [
  { valor: '2026-10-19', rotulo: 'seg 19/10' },
  { valor: '2026-10-20', rotulo: 'ter 20/10' },
  { valor: '2026-10-21', rotulo: 'qua 21/10' },
  { valor: '2026-10-22', rotulo: 'qui 22/10' },
  { valor: '2026-10-23', rotulo: 'sex 23/10' },
];

export function diaEmBrasilia(iso) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
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

function rotuloTipo(tipo) {
  return tipo === 'minicurso' ? 'Minicurso' : 'Palestra';
}

function encontroDoDia(atividade, dia) {
  return atividade.encontros.find((encontro) => diaEmBrasilia(encontro.inicio) === dia);
}

export default function Programacao({ api, aoSelecionarAtividade }) {
  const [dia, setDia] = useState(DIAS[0].valor);
  const [tipo, setTipo] = useState('');
  const [atividades, setAtividades] = useState(null);
  const [salas, setSalas] = useState([]);
  const [erro, setErro] = useState(null);

  const nomeDaSala = useMemo(() => {
    const mapa = {};
    for (const sala of salas) {
      mapa[sala.id] = sala.nome;
    }
    return (salaId) => mapa[salaId] || salaId;
  }, [salas]);

  useEffect(() => {
    api
      .listarSalas()
      .then(setSalas)
      .catch((erroDaApi) => setErro(erroDaApi));
  }, [api]);

  useEffect(() => {
    setErro(null);
    setAtividades(null);
    api
      .listarAtividades({ dia, tipo: tipo || undefined })
      .then(setAtividades)
      .catch((erroDaApi) => setErro(erroDaApi));
  }, [api, dia, tipo]);

  return (
    <section aria-label="Programação da Semana Acadêmica">
      <nav aria-label="Dia">
        {DIAS.map((d) => (
          <button
            key={d.valor}
            type="button"
            aria-pressed={d.valor === dia}
            onClick={() => setDia(d.valor)}
          >
            {d.rotulo}
          </button>
        ))}
      </nav>

      <div role="group" aria-label="Tipo de atividade">
        <button type="button" aria-pressed={tipo === ''} onClick={() => setTipo('')}>
          Todas
        </button>
        <button
          type="button"
          aria-pressed={tipo === 'palestra'}
          onClick={() => setTipo('palestra')}
        >
          Palestras
        </button>
        <button
          type="button"
          aria-pressed={tipo === 'minicurso'}
          onClick={() => setTipo('minicurso')}
        >
          Minicursos
        </button>
      </div>

      {erro && (
        <p role="alert">
          {erro.erro}: {erro.mensagem}
        </p>
      )}

      {!erro && atividades && atividades.length === 0 && (
        <p role="status">
          {tipo === 'palestra' && 'Nenhuma palestra para este dia.'}
          {tipo === 'minicurso' && 'Nenhum minicurso para este dia.'}
          {tipo === '' && 'Nenhuma atividade para este dia.'}
        </p>
      )}

      {atividades && atividades.length > 0 && (
        <ul>
          {atividades.map((atividade) => {
            const encontro = encontroDoDia(atividade, dia);
            return (
              <li
                key={atividade.id}
                aria-label={atividade.titulo}
                onClick={() => aoSelecionarAtividade?.(atividade.id)}
                style={{ cursor: 'pointer' }}
              >
                <h3>{atividade.titulo}</h3>
                <p>
                  {rotuloTipo(atividade.tipo)}
                  {atividade.situacao === 'cancelada' && <strong> · Cancelada</strong>}
                </p>
                <p>{nomeDaSala(atividade.salaId)}</p>
                {encontro && (
                  <p>
                    {horarioEmBrasilia(encontro.inicio)}–{horarioEmBrasilia(encontro.fim)}
                  </p>
                )}
                <p>
                  {atividade.vagasRestantes} de {atividade.vagas} vagas
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}