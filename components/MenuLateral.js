'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icone from './Icones';
import ArvoreMenu from './ArvoreMenu';

function gravar(nome, valor) {
  document.cookie = `${nome}=${valor}; path=/; max-age=31536000; samesite=lax`;
}

export default function MenuLateral({ principais, cadastros, perfil, grupos, colaboradores, recolhidoInicial, equipesAbertaInicial, sair }) {
  const caminho = usePathname();
  const [recolhido, setRecolhido] = useState(recolhidoInicial);
  const emCadastros = cadastros.some((i) => caminho.startsWith(i.href));
  const [cadAberto, setCadAberto] = useState(emCadastros);

  const ativo = (href) => (href === '/' ? caminho === '/' || caminho.startsWith('/grupos') || caminho.startsWith('/colaboradores') : caminho.startsWith(href));
  const alternar = () => { setRecolhido((r) => { gravar('menu_recolhido', r ? '0' : '1'); return !r; }); };
  const Item = ({ i }) => (
    <Link href={i.href} className={ativo(i.href) ? 'nav-item ativo' : 'nav-item'} aria-current={ativo(i.href) ? 'page' : undefined} title={recolhido ? i.rotulo : undefined}>
      <Icone nome={i.icone} /><span className="nav-rotulo">{i.rotulo}</span>
    </Link>
  );

  return (
    <aside className={`lateral${recolhido ? ' recolhida' : ''}`}>
      <div className="lateral-topo">
        <div className="marca">Metas<small>da equipe</small></div>
        <button type="button" className="botao-recolher" onClick={alternar} aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'} title={recolhido ? 'Expandir menu' : 'Recolher menu'}>
          <Icone nome={recolhido ? 'expandir' : 'recolher'} />
        </button>
      </div>

      <nav className="nav" aria-label="Principal">
        {principais.map((i) => <Item key={i.href} i={i} />)}
        {recolhido ? (
          <>
            {cadastros.map((i) => <Item key={i.href} i={i} />)}
            <button type="button" className="nav-item" title="Equipes" onClick={() => { setRecolhido(false); gravar('menu_recolhido', '0'); gravar('menu_equipes', '1'); }}>
              <Icone nome="equipes" />
            </button>
          </>
        ) : (
          <div className="grupo-nav">
            <button type="button" className={`nav-item nav-grupo${emCadastros ? ' contem-ativo' : ''}`} onClick={() => setCadAberto((a) => !a)} aria-expanded={cadAberto}>
              <Icone nome="cadastros" /><span className="nav-rotulo">Cadastros</span>
              <span className={`seta-grupo${cadAberto ? ' aberto' : ''}`}>▶</span>
            </button>
            {cadAberto && <div className="sub-nav">{cadastros.map((i) => <Item key={i.href} i={i} />)}</div>}
          </div>
        )}
      </nav>

      {!recolhido && <ArvoreMenu grupos={grupos} colaboradores={colaboradores} abertaInicial={equipesAbertaInicial} />}

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
