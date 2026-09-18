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

export default function Atividade({ api, id, aoSelecionarEncontro }) {
  const [atividade, setAtividade] = useState(null);
  const [erro, setErro] = useState(null);
  const [sucesso, setSucesso] = useState(null);
  const [salas, setSalas] = useState([]);
  const [inscricao, setInscricao] = useState(null);
  const [certificado, setCertificado] = useState(null);

  useEffect(() => {
    api.listarSalas().then(setSalas).catch(() => {});
  }, [api]);

  useEffect(() => {
    setErro(null);
    setSucesso(null);
    setAtividade(null);
    setInscricao(null);
    setCertificado(null);
    api
      .obterAtividade(id)
      .then(setAtividade)
      .catch((erroDaApi) => setErro(erroDaApi));

    api
      .listarInscricoes({ atividadeId: id })
      .then((lista) => {
        if (lista && lista.length > 0) {
          const ativa = lista.find((i) => ['confirmada', 'em_espera', 'convocada'].includes(i.status));
          setInscricao(ativa || lista[0]);
        }
      })
      .catch(() => {});
  }, [api, id]);

  async function handleInscrever() {
    setErro(null);
    setSucesso(null);
    try {
      const novaInscricao = await api.inscrever(id);
      setInscricao(novaInscricao);
      setSucesso('Inscrição realizada com sucesso!');
      const atvAtualizada = await api.obterAtividade(id);
      setAtividade(atvAtualizada);
    } catch (err) {
      setErro(err);
    }
  }

  async function handleCancelar() {
    const inscricaoId = inscricao?.id || 'ins_mock';
    setErro(null);
    setSucesso(null);
    try {
      const resp = await api.cancelarInscricao(inscricaoId);
      setInscricao(resp);
      setSucesso('Inscrição cancelada com sucesso!');
      const atvAtualizada = await api.obterAtividade(id);
      setAtividade(atvAtualizada);
    } catch (err) {
      setErro(err);
    }
  }

  async function handleSolicitarCertificado() {
    setErro(null);
    setSucesso(null);
    try {
      const resp = await api.emitirCertificado(id);
      setCertificado(resp);
      setSucesso(`Certificado ${resp.codigo} emitido!`);
    } catch (err) {
      setErro(err);
    }
  }

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
      {sucesso && <p role="status">{sucesso}</p>}
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
                {aoSelecionarEncontro && (
                  <button type="button" onClick={() => aoSelecionarEncontro(encontro.id)}>
                    Presença por QR
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div>
            <button type="button" onClick={handleInscrever}>
              Inscrever
            </button>
            <button type="button" onClick={handleCancelar}>
              Cancelar inscrição
            </button>
            <button type="button" onClick={handleSolicitarCertificado}>
              Solicitar certificado
            </button>
          </div>
          {certificado && <p>Código do certificado: {certificado.codigo}</p>}
          {inscricao && (
            <p>
              Status da inscrição: {inscricao.status}
              {inscricao.posicaoNaEspera !== null && inscricao.posicaoNaEspera !== undefined && ` (Posição na espera: ${inscricao.posicaoNaEspera})`}
            </p>
          )}
        </article>
      )}
    </section>
  );
}