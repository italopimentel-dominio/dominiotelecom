'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icone from './Icones';

function gravar(nome, valor) {
  document.cookie = `${nome}=${valor}; path=/; max-age=31536000; samesite=lax`;
}

// menu: itens soltos { href, rotulo, icone } ou grupos { rotulo, icone, itens: [...] }
// dentro de um grupo, { secao: 'Nome' } é um título pequeno (não clicável) que separa os itens
export default function MenuLateral({ menu, perfil, recolhidoInicial, sair }) {
  const caminho = usePathname();
  const [recolhido, setRecolhido] = useState(recolhidoInicial);
  const ativoHref = (href) => (!href ? false : href === '/' ? caminho === '/' || caminho.startsWith('/grupos') || caminho.startsWith('/colaboradores') : caminho.startsWith(href));
  // item ativo: pelo href, sem os caminhos de "excluir" e somando os de "incluir"
  const ativoItem = (i) => (ativoHref(i.href) && !(i.excluir || []).some((e) => caminho.startsWith(e))) || (i.incluir || []).some((e) => caminho.startsWith(e));
  const [abertos, setAbertos] = useState(() => new Set(menu.filter((m) => m.itens && (m.aberto || m.itens.some((i) => ativoItem(i)))).map((m) => m.rotulo)));
  const alternarGrupo = (r) => setAbertos((a) => { const n = new Set(a); if (n.has(r)) n.delete(r); else n.add(r); return n; });
  const alternar = () => { setRecolhido((r) => { gravar('menu_recolhido', r ? '0' : '1'); return !r; }); };

  const Item = ({ i }) => (
    <Link href={i.href} className={ativoItem(i) ? 'nav-item ativo' : 'nav-item'} aria-current={ativoItem(i) ? 'page' : undefined} title={recolhido ? i.rotulo : undefined}>
      <Icone nome={i.icone} /><span className="nav-rotulo">{i.rotulo}</span>
    </Link>
  );

  return (
    <aside className={`lateral${recolhido ? ' recolhida' : ''}`}>
      <div className="lateral-topo">
        <Link href="/" className="marca" aria-label="Duomni, ir para o painel">
          <img src="/logo-duomni-branco.png" alt="Duomni" />
          <small>Metas e controle</small>
        </Link>
        <Link href="/" aria-label="Duomni, ir para o painel"><img className="simbolo" src="/simbolo-duomni.png" alt="Duomni" /></Link>
        <button type="button" className="botao-recolher" onClick={alternar} aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'} title={recolhido ? 'Expandir menu' : 'Recolher menu'}>
          <Icone nome={recolhido ? 'expandir' : 'recolher'} />
        </button>
      </div>

      <nav className="nav" aria-label="Principal">
        {menu.map((m) => {
          if (!m.itens) return <Item key={m.href} i={m} />;
          const links = m.itens.filter((i) => i.href);
          if (recolhido) return <div key={m.rotulo} className="nav-separador">{links.map((i) => <Item key={i.href} i={i} />)}</div>;
          const aberto = abertos.has(m.rotulo);
          const contem = links.some((i) => ativoItem(i));
          return (
            <div key={m.rotulo} className="grupo-nav">
              <button type="button" className={`nav-item nav-grupo${contem ? ' contem-ativo' : ''}`} onClick={() => alternarGrupo(m.rotulo)} aria-expanded={aberto}>
                <Icone nome={m.icone} /><span className="nav-rotulo">{m.rotulo}</span>
                <span className={`seta-grupo${aberto ? ' aberto' : ''}`}>▶</span>
              </button>
              {aberto && (
                <div className="sub-nav">
                  {m.itens.map((i) => (i.secao
                    ? <div key={`secao-${i.secao}`} className="nav-secao">{i.secao}</div>
                    : <Item key={i.href} i={i} />))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="quem">
        <span className="avatar" title={`${perfil.nome} (${perfil.papel})`}>{(perfil.nome || '?').trim().charAt(0).toUpperCase()}</span>
        <div className="quem-texto">
          <strong>{perfil.nome}</strong>
          <span>{perfil.papel}</span>
        </div>
        <Link href="/conta" className="quem-acao" title="Minha senha" aria-label="Minha senha"><Icone nome="senha" /></Link>
        <form action={sair}><button type="submit" className="quem-acao" title="Sair" aria-label="Sair"><Icone nome="sair" /></button></form>
      </div>
    </aside>
  );
}
