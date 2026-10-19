import Link from 'next/link';

// Peças comuns dos filtros "clicáveis" (Acompanhamento, Ativação, Treinamentos).
// Cada chip liga/desliga um filtro pela URL; os filtros se combinam.

export function CartoesFocais({ itens, selecionado, hrefDe, rotuloNumero }) {
  // itens: [{ id: ''|'sem'|uuid, nome, numero, sub, sub2 }]; id '' = Todos
  return (
    <nav className="equipes-assid" aria-label="Pontos focais">
      {itens.map((x) => {
        const sel = (selecionado || '') === x.id;
        return (
          <Link key={x.id || 'todos'} href={hrefDe(sel && x.id ? '' : x.id)} className={`cartao-equipe${sel ? ' sel' : ''}`} aria-current={sel ? 'true' : undefined}>
            <span className="linha1"><span className="nome">{x.nome}</span>{x.canto && <span className="dica">{x.canto}</span>}</span>
            <span className="pct">{x.numero}</span>
            <span className="dica" style={{ marginTop: -4 }}>{rotuloNumero}</span>
            {x.sub && <span className="dica">{x.sub}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function GrupoFiltro({ rotulo, children }) {
  return <div className="grupo-filtro"><span className="rot">{rotulo}</span>{children}</div>;
}

export function ChipFiltro({ href, sel, cor, children }) {
  return (
    <Link href={href} className={`chip-acomp${sel ? ' sel' : ''}`} aria-pressed={sel} scroll={false}>
      {cor && <i className="ponto-chip" style={{ background: cor }} />}{children}
    </Link>
  );
}

// Monta a URL trocando/limpando parâmetros (vazio = remove)
export function urlCom(base, atuais, extra) {
  const q = new URLSearchParams(Object.entries({ ...atuais, ...extra }).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  q.delete('pag');
  const t = q.toString();
  return t ? `${base}?${t}` : base;
}
