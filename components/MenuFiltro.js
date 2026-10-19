'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

// Botão "Rótulo ▾" que abre uma lista de opções com contagem (pode marcar várias).
// opcoes: [{ param, v, t, n, cor }] — cada opção liga/desliga o valor v no parâmetro param (lista separada por vírgula).
export default function MenuFiltro({ rotulo, opcoes }) {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef(null);
  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (caixa.current && !caixa.current.contains(e.target)) setAberto(false); };
    const esc = (e) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); };
  }, [aberto]);

  const valores = (param) => (params.get(param) || '').split(',').filter(Boolean);
  const marcado = (o) => valores(o.param).includes(o.v);
  const marcados = opcoes.filter(marcado);

  function alternar(o) {
    const p = new URLSearchParams(params.toString());
    const atual = valores(o.param);
    const novo = atual.includes(o.v) ? atual.filter((x) => x !== o.v) : [...atual, o.v];
    if (novo.length) p.set(o.param, novo.join(',')); else p.delete(o.param);
    p.delete('pag');
    router.push(`${caminho}?${p.toString()}`, { scroll: false });
  }
  function limpar() {
    const p = new URLSearchParams(params.toString());
    [...new Set(opcoes.map((o) => o.param))].forEach((k) => p.delete(k));
    p.delete('pag');
    router.push(`${caminho}?${p.toString()}`, { scroll: false });
    setAberto(false);
  }

  return (
    <div className="menu-filtro" ref={caixa}>
      <button type="button" className={`menu-filtro-botao${marcados.length ? ' ativo' : ''}`} aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
        {rotulo}
        {marcados.length > 0 && <b>{marcados.length === 1 ? marcados[0].t : `${marcados.length} escolhidos`}</b>}
        <span aria-hidden="true" className="seta-menu">▾</span>
      </button>
      {aberto && (
        <div className="menu-filtro-lista" role="dialog" aria-label={`Filtro: ${rotulo}`}>
          {opcoes.map((o, i) => (
            o.titulo
              ? <span key={`t${i}`} className="menu-filtro-titulo">{o.titulo}</span>
              : (
                <label key={`${o.param}-${o.v}`} className={`menu-filtro-op${marcado(o) ? ' sel' : ''}`}>
                  <input type="checkbox" checked={marcado(o)} onChange={() => alternar(o)} />
                  {o.cor && <i className="ponto-chip" style={{ background: o.cor }} />}
                  <span>{o.t}</span>
                  <span className="dica" style={{ marginLeft: 'auto' }}>{o.n}</span>
                </label>
              )
          ))}
          {marcados.length > 0 && <button type="button" className="link-acao" style={{ alignSelf: 'flex-start', margin: '4px 6px' }} onClick={limpar}>Limpar {rotulo.toLowerCase()}</button>}
        </div>
      )}
    </div>
  );
}
