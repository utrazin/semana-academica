import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function PresencaOrganizacao({ api, encontroId }) {
  const [codigo, setCodigo] = useState(null);
  const [qrSvg, setQrSvg] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let ativo = true;
    let agendado = null;

    async function buscar() {
      try {
        const proximo = await api.obterCodigoDoEncontro(encontroId);
        if (!ativo) return;
        setErro(null);
        setCodigo(proximo);
        const svg = await QRCode.toString(proximo.codigo, { type: 'svg' });
        if (!ativo) return;
        setQrSvg(svg);
        const atraso = new Date(proximo.trocaEm).getTime() - Date.now();
        const atrasoEmBits = Math.min(Math.max(atraso, 0), 2_147_483_647);
        agendado = setTimeout(buscar, atrasoEmBits);
      } catch (err) {
        if (!ativo) return;
        setErro(err);
      }
    }

    buscar();

    return () => {
      ativo = false;
      if (agendado !== null) {
        clearTimeout(agendado);
      }
    };
  }, [api, encontroId]);

  return (
    <section aria-label="Código do encontro" style={{ textAlign: 'center', padding: '8vh 0' }}>
      {erro && (
        <p role="alert">
          {erro.erro}: {erro.mensagem || erro.message}
        </p>
      )}
      {codigo && !erro && (
        <div>
          <p style={{ fontSize: '6rem', letterSpacing: '0.3em', margin: '0' }}>
            {codigo.codigo}
          </p>
          {qrSvg && (
            <div
              role="img"
              aria-label="QR code do encontro"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          )}
        </div>
      )}
    </section>
  );
}