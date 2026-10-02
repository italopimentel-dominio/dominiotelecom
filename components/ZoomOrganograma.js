'use client';
import { useEffect, useRef, useState } from 'react';

// Área do organograma com zoom (−, +, ajustar à tela)
export default function ZoomOrganograma({ children }) {
  const area = useRef(null);
  const conteudo = useRef(null);
  const [zoom, setZoom] = useState(1);

  function ajustar() {
    if (!area.current || !conteudo.current) return;
    const largura = conteudo.current.scrollWidth / (zoom || 1);
    const disponivel = area.current.clientWidth - 24;
    setZoom(Math.max(0.4, Math.min(1, disponivel / largura)));
  }
  useEffect(() => { ajustar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const mudar = (d) => setZoom((z) => Math.max(0.4, Math.min(1.5, Math.round((z + d) * 10) / 10)));
  return (
    <div className="org-moldura">
      <div className="org-zoom" role="group" aria-label="Zoom do organograma">
        <button type="button" onClick={() => mudar(-0.1)} aria-label="Diminuir">−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => mudar(0.1)} aria-label="Aumentar">+</button>
        <button type="button" onClick={ajustar} className="org-ajustar">Ajustar à tela</button>
      </div>
      <div className="org-area" ref={area}>
        <div ref={conteudo} style={{ zoom }} className="org-conteudo">{children}</div>
      </div>
    </div>
  );
}
