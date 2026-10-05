'use client';
import { useRef, useState } from 'react';

// Ícone "i" que mostra um quadrinho com detalhes ao passar o mouse (ou tocar, no celular).
// O quadrinho é posicionado na tela, então não é cortado pelas tabelas com rolagem.
export default function InfoDica({ titulo, linhas }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const abrir = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const largura = 260;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - largura / 2), window.innerWidth - largura - 8);
    const embaixo = r.bottom + 8 + 40 + linhas.length * 22 < window.innerHeight;
    setPos({ left, top: embaixo ? r.bottom + 8 : undefined, bottom: embaixo ? undefined : window.innerHeight - r.top + 8 });
  };
  const fechar = () => setPos(null);
  return (
    <span className="info-dica">
      <button
        type="button"
        ref={ref}
        className="info-i"
        aria-label={`${titulo}: ${linhas.join('; ')}`}
        onMouseEnter={abrir}
        onMouseLeave={fechar}
        onFocus={abrir}
        onBlur={fechar}
        onClick={() => (pos ? fechar() : abrir())}
      >i</button>
      {pos && (
        <span className="info-caixa" role="tooltip" style={{ left: pos.left, top: pos.top, bottom: pos.bottom }}>
          <strong>{titulo}</strong>
          {linhas.map((l) => <span key={l}>{l}</span>)}
        </span>
      )}
    </span>
  );
}
