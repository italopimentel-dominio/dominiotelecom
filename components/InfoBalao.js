'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Ícone "i" com balão escuro ao passar o mouse (ou ao focar com o teclado / tocar no celular),
// no mesmo jeito do "Do que é feito este resultado" do Painel.
// O balão é desenhado direto na página (fora da tabela), então nunca fica cortado por uma área com rolagem.
// Abre embaixo do ícone; se não couber, abre em cima. Nunca passa da borda da janela.
export default function InfoBalao({ titulo, children, rotulo = 'Mais detalhes' }) {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const balao = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (!ref.current?.contains(e.target) && !balao.current?.contains(e.target)) setAberto(false); };
    const esc = (e) => { if (e.key === 'Escape') setAberto(false); };
    const fechar = () => setAberto(false);
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', fechar, true); // rolou a página ou a tabela: fecha
    window.addEventListener('resize', fechar);
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', fechar, true);
      window.removeEventListener('resize', fechar);
    };
  }, [aberto]);

  // posiciona depois de desenhar (precisa saber o tamanho do balão)
  useLayoutEffect(() => {
    if (!aberto || !ref.current || !balao.current) return;
    const r = ref.current.getBoundingClientRect();
    const b = balao.current.getBoundingClientRect();
    const margem = 8;
    const cabeEmbaixo = r.bottom + margem + b.height <= window.innerHeight - margem;
    const top = cabeEmbaixo ? r.bottom + margem : Math.max(margem, r.top - margem - b.height);
    const left = Math.min(Math.max(margem, r.right - b.width + 8), window.innerWidth - b.width - margem);
    setPos({ top, left });
  }, [aberto]);

  const abrir = () => { setPos(null); setAberto(true); };
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={abrir} onMouseLeave={(e) => { if (!balao.current?.contains(e.relatedTarget)) setAberto(false); }}>
      <button type="button" aria-label={rotulo} aria-expanded={aberto}
        onClick={() => (aberto ? setAberto(false) : abrir())} onFocus={abrir} onBlur={() => setAberto(false)}
        style={{ width: 20, height: 20, borderRadius: '50%', border: '1.5px solid var(--acento, #6e50c8)', color: 'var(--acento, #6e50c8)', background: 'transparent', font: 'italic 700 12px/1 Georgia, serif', cursor: 'help', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        i
      </button>
      {aberto && typeof document !== 'undefined' && createPortal(
        <span ref={balao} role="tooltip" onMouseLeave={() => setAberto(false)}
          style={{ position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden', zIndex: 1000,
            minWidth: 220, maxWidth: 320, background: '#1f1a2e', color: '#fff', borderRadius: 10, padding: '10px 12px',
            boxShadow: '0 8px 24px rgba(0,0,0,.25)', fontSize: 13, lineHeight: 1.45, textAlign: 'left', whiteSpace: 'normal' }}>
          {titulo && <span style={{ display: 'block', color: '#c9b8ff', fontWeight: 600, marginBottom: 4 }}>{titulo}</span>}
          {children}
        </span>,
        document.body,
      )}
    </span>
  );
}
