import { useEffect, useRef, useState } from 'react';

export const CHAVE_FILA = 'semana-academica.fila-presenca';

function lerFila() {
  try {
    const bruto = localStorage.getItem(CHAVE_FILA);
    const fila = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(fila) ? fila : [];
  } catch {
    return [];
  }
}

function salvarFila(fila) {
  localStorage.setItem(CHAVE_FILA, JSON.stringify(fila));
}

function agoraIso() {
  const agora = new Date();
  const deslocamento = -agora.getTimezoneOffset();
  const sinal = deslocamento >= 0 ? '+' : '-';
  const absoluto = Math.abs(deslocamento);
  const horas = String(Math.floor(absoluto / 60)).padStart(2, '0');
  const minutos = String(absoluto % 60).padStart(2, '0');
  const semFuso = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, -1);
  return `${semFuso}${sinal}${horas}:${minutos}`;
}

function ehRespostaDaApi(erro) {
  return erro != null && erro.status !== undefined;
}

export default function PresencaParticipante({ api, encontroId }) {
  const [codigo, setCodigo] = useState('');
  const [presenca, setPresenca] = useState(null);
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [fila, setFila] = useState(() => lerFila());
  const sincronizandoRef = useRef(false);

  async function sincronizar() {
    if (sincronizandoRef.current) return;
    const pendentes = lerFila();
    if (pendentes.length === 0) return;
    sincronizandoRef.current = true;
    const restantes = [];
    for (const item of pendentes) {
      try {
        const resposta = await api.registrarPresenca(item.encontroId, {
          codigo: item.codigo,
          lidoEm: item.lidoEm,
        });
        setPresenca(resposta);
        setErro(null);
      } catch (err) {
        if (ehRespostaDaApi(err)) {
          setErro(err);
          setPresenca(null);
        } else {
          restantes.push(item);
        }
      }
    }
    setFila(restantes);
    salvarFila(restantes);
    sincronizandoRef.current = false;
  }

  useEffect(() => {
    window.addEventListener('online', sincronizar);
    return () => window.removeEventListener('online', sincronizar);
  }, []);

  async function handleRegistrar(evento) {
    evento.preventDefault();
    setErro(null);
    setPresenca(null);
    setEnviando(true);
    try {
      const resposta = await api.registrarPresenca(encontroId, { codigo });
      setPresenca(resposta);
    } catch (err) {
      if (ehRespostaDaApi(err)) {
        setErro(err);
      } else {
        const item = { encontroId, codigo, lidoEm: agoraIso() };
        const novaFila = [...lerFila(), item];
        salvarFila(novaFila);
        setFila(novaFila);
      }
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
      {fila.length > 0 && (
        <div>
          <p>Leituras aguardando envio: {fila.length}</p>
          <button type="button" onClick={sincronizar}>
            Enviar agora
          </button>
        </div>
      )}
      {erro && (
        <p role="alert">
          {erro.erro}: {erro.mensagem || erro.message}
        </p>
      )}
      {presenca && <p role="status">Presença registrada (origem: {presenca.origem}).</p>}
    </section>
  );
}