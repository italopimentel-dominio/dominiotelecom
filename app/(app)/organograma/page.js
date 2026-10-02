import Link from 'next/link';
import { exigirSessao } from '@/lib/auth';
import { carregarEstrutura } from '@/lib/dados';
import { tempoDeCasa } from '@/lib/datas';
import ZoomOrganograma from '@/components/ZoomOrganograma';

const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
const capitalizar = (s) => s.toLowerCase().split(/\s+/).filter(Boolean)
  .map((w, i) => (i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
// "ANDRESSA CAROLINE ESPINDOLA" -> "Andressa Espindola"
function nomeCurto(nome) {
  const partes = capitalizar(nome).split(' ').filter((w) => !MINUSCULAS.has(w));
  return partes.length > 1 ? `${partes[0]} ${partes[partes.length - 1]}` : partes[0] || nome;
}
const CORES = ['#6b40e7', '#1b7446', '#b0261c', '#a86200', '#2563a8', '#8a3fb3', '#0f766e', '#c2410c'];
const corDe = (s) => CORES[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % CORES.length];
const LIMITE = 12;

export default async function Organograma({ searchParams }) {
  const sp = await searchParams;
  const { supabase } = await exigirSessao();
  const est = await carregarEstrutura(supabase);
  const ativos = est.colaboradores.filter((c) => c.ativo);
  const filhos = (id) => est.filhosDe(id).filter((g) => g.ativo);
  const total = (id) => {
    const ids = new Set(est.subarvore(id));
    return ativos.filter((c) => ids.has(c.grupo_id)).length;
  };
  const canais = filhos(null);
  const canal = canais.find((c) => c.id === sp.c);
  const totalGeral = canal ? total(canal.id) : ativos.length;

  function Pessoa({ c }) {
    const t = tempoDeCasa(c.data_admissao);
    return (
      <li>
        <Link href={`/colaboradores/${c.id}`} className="org-pessoa" title={`${capitalizar(c.nome)}${t ? ` (${t.texto} de casa)` : ''}`}>
          <span className="org-avatar" style={{ background: corDe(c.nome) }}>{c.nome.trim().charAt(0).toUpperCase()}</span>
          <span className="org-pessoa-nome">{nomeCurto(c.nome)}</span>
          {t && t.meses < 3 && <span className="org-novo" title="Menos de 3 meses de casa">novo</span>}
        </Link>
      </li>
    );
  }

  function No({ g, nivel }) {
    const fs = filhos(g.id);
    const pessoas = ativos.filter((c) => c.grupo_id === g.id);
    const n = total(g.id);
    return (
      <li>
        <div className={`org-no org-nivel-${Math.min(nivel, 3)}${pessoas.length ? ' org-equipe' : ''}`}>
          <Link href={`/grupos/${g.id}`} className="org-titulo">
            <strong>{nivel >= 2 ? capitalizar(g.nome) : g.nome}</strong>
            <span>{n} {n === 1 ? 'pessoa' : 'pessoas'}</span>
          </Link>
          {pessoas.length > 0 && (
            <>
              <ul className="org-pessoas">{pessoas.slice(0, LIMITE).map((c) => <Pessoa key={c.id} c={c} />)}</ul>
              {pessoas.length > LIMITE && (
                <details className="org-mais">
                  <summary>+ {pessoas.length - LIMITE} pessoas</summary>
                  <ul className="org-pessoas">{pessoas.slice(LIMITE).map((c) => <Pessoa key={c.id} c={c} />)}</ul>
                </details>
              )}
            </>
          )}
        </div>
        {fs.length > 0 && <ul>{fs.map((f) => <No key={f.id} g={f} nivel={nivel + 1} />)}</ul>}
      </li>
    );
  }

  return (
    <>
      <div className="topo">
        <div>
          <h1>Organograma comercial</h1>
          <p className="sub">{totalGeral} colaboradores ativos. Clique numa equipe ou pessoa para ver as metas.</p>
        </div>
      </div>
      <div className="abas">
        <Link href="/organograma" className={!canal ? 'aba ativa' : 'aba'}>Todos</Link>
        {canais.map((c) => <Link key={c.id} href={`/organograma?c=${c.id}`} className={canal?.id === c.id ? 'aba ativa' : 'aba'}>{c.nome}</Link>)}
      </div>
      {!canais.length ? (
        <div className="vazio" style={{ marginTop: 20 }}><h2>Nenhuma equipe cadastrada</h2><p>Cadastre em Cadastros &gt; Equipes e colaboradores.</p></div>
      ) : (
        <ZoomOrganograma key={canal?.id || 'todos'}>
          <div className="org">
            <ul>
              {canal ? <No g={canal} nivel={0} /> : (
                <li>
                  <div className="org-no org-raiz">
                    <img src="/simbolo-duomni.png" alt="" />
                    <div className="org-titulo"><strong>Comercial Duomni</strong><span>{totalGeral} pessoas</span></div>
                  </div>
                  <ul>{canais.map((g) => <No key={g.id} g={g} nivel={0} />)}</ul>
                </li>
              )}
            </ul>
          </div>
        </ZoomOrganograma>
      )}
    </>
  );
}
