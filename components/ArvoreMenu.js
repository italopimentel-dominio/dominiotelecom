'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { normalizar } from '@/lib/nomes';

// Menu retrátil: canais > regionais > equipes > colaboradores.
export default function ArvoreMenu({ grupos, colaboradores }) {
  const caminho = usePathname();
  const params = useSearchParams();
  const p = params.get('p');
  const q = p ? `?p=${p}` : '';

  const { porId, filhos, colabsDe, totalSub } = useMemo(() => {
    const porId = new Map(grupos.map((g) => [g.id, g]));
    const filhos = new Map();
    grupos.forEach((g) => {
      const k = g.parent_id && porId.has(g.parent_id) ? g.parent_id : 'raiz';
      if (!filhos.has(k)) filhos.set(k, []);
      filhos.get(k).push(g);
    });
    const colabsDe = new Map();
    colaboradores.forEach((c) => {
      if (!colabsDe.has(c.grupo_id)) colabsDe.set(c.grupo_id, []);
      colabsDe.get(c.grupo_id).push(c);
    });
    const totalSub = new Map();
    const contar = (id) => {
      const n = (colabsDe.get(id) || []).length + (filhos.get(id) || []).reduce((s, f) => s + contar(f.id), 0);
      totalSub.set(id, n);
      return n;
    };
    (filhos.get('raiz') || []).forEach((g) => contar(g.id));
    return { porId, filhos, colabsDe, totalSub };
  }, [grupos, colaboradores]);

  const partes = caminho.split('/');
  const colabAtual = partes[1] === 'colaboradores' ? partes[2] : null;
  const grupoAtual = partes[1] === 'grupos' ? partes[2] : colaboradores.find((c) => c.id === colabAtual)?.grupo_id || null;

  const ancestrais = (id) => {
    const lista = [];
    let g = porId.get(id);
    while (g) { lista.push(g.id); g = porId.get(g.parent_id); }
    return lista;
  };

  const [abertos, setAbertos] = useState(() => new Set(ancestrais(grupoAtual)));
  const [busca, setBusca] = useState('');
  useEffect(() => {
    if (grupoAtual) setAbertos((a) => new Set([...a, ...ancestrais(grupoAtual)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoAtual]);

  const alternar = (id) => setAbertos((a) => {
    const n = new Set(a);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  // filtro da busca: mostra o que combina e o caminho até lá
  const filtro = useMemo(() => {
    const b = normalizar(busca);
    if (!b) return null;
    const gruposVisiveis = new Set();
    const colabsVisiveis = new Set();
    const avaliar = (g, ancestralCasou) => {
      const casou = ancestralCasou || normalizar(g.nome).includes(b);
      let algum = casou;
      (filhos.get(g.id) || []).forEach((f) => { if (avaliar(f, casou)) algum = true; });
      (colabsDe.get(g.id) || []).forEach((c) => {
        if (casou || normalizar(c.nome).includes(b)) { colabsVisiveis.add(c.id); algum = true; }
      });
      if (algum) gruposVisiveis.add(g.id);
      return algum;
    };
    (filhos.get('raiz') || []).forEach((g) => avaliar(g, false));
    return { gruposVisiveis, colabsVisiveis };
  }, [busca, filhos, colabsDe]);

  function No({ g }) {
    if (filtro && !filtro.gruposVisiveis.has(g.id)) return null;
    const fs = filhos.get(g.id) || [];
    const cs = (colabsDe.get(g.id) || []).filter((c) => !filtro || filtro.colabsVisiveis.has(c.id));
    const temFilhos = fs.length > 0 || cs.length > 0;
    const aberto = filtro ? true : abertos.has(g.id);
    return (
      <li>
        <div className={`no${g.id === grupoAtual && !colabAtual ? ' atual' : ''}`}>
          <button
            type="button"
            className={`no-seta${aberto ? ' aberto' : ''}`}
            onClick={() => alternar(g.id)}
            disabled={!temFilhos}
            aria-expanded={aberto}
            aria-label={`${aberto ? 'Recolher' : 'Expandir'} ${g.nome}`}
          >▶</button>
          <Link href={`/grupos/${g.id}${q}`} title={g.nome}>{g.nome}</Link>
          {totalSub.get(g.id) > 0 && <span className="conta">{totalSub.get(g.id)}</span>}
        </div>
        {aberto && temFilhos && (
          <ul>
            {fs.map((f) => <No key={f.id} g={f} />)}
            {cs.map((c) => (
              <li key={c.id}>
                <div className={`no pessoa${c.id === colabAtual ? ' atual' : ''}`}>
                  <Link href={`/colaboradores/${c.id}${q}`} title={c.nome}>{c.nome}</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  }

  const raizes = filhos.get('raiz') || [];
  if (!raizes.length) return null;
  return (
    <div className="arvore">
      <div className="arvore-cab">
        <span className="arvore-titulo">Equipes</span>
        {abertos.size > 0 && !busca && <button type="button" onClick={() => setAbertos(new Set())}>Recolher tudo</button>}
      </div>
      <input
        type="text"
        className="arvore-busca"
        placeholder="Buscar equipe ou pessoa"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        aria-label="Buscar equipe ou colaborador"
      />
      <div className="arvore-lista">
        <ul>{raizes.map((g) => <No key={g.id} g={g} />)}</ul>
        {filtro && !filtro.gruposVisiveis.size && <p className="dica" style={{ color: '#8a86a0', padding: '4px 8px' }}>Nada encontrado.</p>}
      </div>
    </div>
  );
}
