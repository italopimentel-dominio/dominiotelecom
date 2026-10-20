'use client';
import { useEffect, useRef, useState } from 'react';

// Ícone "i" com balão escuro ao passar o mouse (ou ao focar com o teclado / tocar no celular),
// no mesmo jeito do "Do que é feito este resultado" do Painel.
export default function InfoBalao({ titulo, children, rotulo = 'Mais detalhes' }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    const esc = (e) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', fora); document.removeEventListener('keydown', esc); };
  }, [aberto]);
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setAberto(true)} onMouseLeave={() => setAberto(false)}>
      <button type="button" aria-label={rotulo} aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)} onFocus={() => setAberto(true)} onBlur={() => setAberto(false)}
        style={{ width: 20, height: 20, borderRadius: '50%', border: '1.5px solid var(--acento, #6e50c8)', color: 'var(--acento, #6e50c8)', background: 'transparent', font: 'italic 700 12px/1 Georgia, serif', cursor: 'help', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        i
      </button>
      {aberto && (
        <span role="tooltip"
          style={{ position: 'absolute', top: 'calc(100% + 8px)', right: -8, zIndex: 50, minWidth: 220, maxWidth: 280, background: '#1f1a2e', color: '#fff', borderRadius: 10, padding: '10px 12px', boxShadow: '0 8px 24px rgba(0,0,0,.25)', fontSize: 13, lineHeight: 1.45, textAlign: 'left', whiteSpace: 'normal' }}>
          {titulo && <span style={{ display: 'block', color: '#c9b8ff', fontWeight: 600, marginBottom: 4 }}>{titulo}</span>}
          {children}
        </span>
      )}
    </span>
  );
}
