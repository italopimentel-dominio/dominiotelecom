import Link from 'next/link';
import { exigirSessao, podeEditar } from '@/lib/auth';
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
  const { supabase, perfil } = await exigirSessao();
  const [est, { data: lids }, { data: vinculos }] = await Promise.all([
    carregarEstrutura(supabase),
    supabase.from('liderancas').select('*').eq('ativo', true).order('ordem').order('nome'),
    supabase.from('lideranca_grupos').select('*'),
  ]);
  const liderancas = lids || [];
  const temLideranca = liderancas.length > 0;
  const visao = sp.v === 'canal' || !temLideranca ? 'canal' : 'lideranca';
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
          {c.foto_url ? <img src={c.foto_url} alt="" className="org-avatar org-foto" /> : <span className="org-avatar" style={{ background: corDe(c.nome) }}>{c.nome.trim().charAt(0).toUpperCase()}</span>}
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

  // ---------- visão por liderança ----------
  const gruposAtivos = new Map(est.grupos.filter((g) => g.ativo).map((g) => [g.id, g]));
  const gruposDe = (lid) => (vinculos || []).filter((v) => v.lideranca_id === lid && gruposAtivos.has(v.grupo_id)).map((v) => gruposAtivos.get(v.grupo_id));
  const raizesLid = liderancas.filter((l) => !l.superior_id || !liderancas.some((x) => x.id === l.superior_id));
  const totalLider = (l) => gruposDe(l.id).reduce((n, g) => n + ativos.filter((c) => c.grupo_id === g.id).length, 0)
    + liderancas.filter((x) => x.superior_id === l.id).reduce((n, x) => n + 1 + totalLider(x), 0);
  const comLider = new Set((vinculos || []).filter((v) => liderancas.some((l) => l.id === v.lideranca_id)).map((v) => v.grupo_id));
  const semLider = est.grupos.filter((g) => g.ativo && !comLider.has(g.id) && ativos.some((c) => c.grupo_id === g.id));
  const segundoNivel = raizesLid.length === 1 ? liderancas.filter((l) => l.superior_id === raizesLid[0].id) : raizesLid;
  const foco = liderancas.find((l) => l.id === sp.l);
  const nomeGrupo = (g) => capitalizar(est.caminho(g.id).slice(-2).map((x) => x.nome).join(' / '));

  function NoLider({ l, nivel }) {
    const subs = liderancas.filter((x) => x.superior_id === l.id);
    const equipes = gruposDe(l.id);
    const t = tempoDeCasa(l.data_admissao);
    const n = totalLider(l);
    return (
      <li>
        <div className={`org-no org-lider org-lider-${Math.min(nivel, 3)}${equipes.length ? ' org-equipe' : ''}`}>
          <div className="org-lider-cab" title={t ? `${t.texto} de casa` : undefined}>
            {nivel === 0 ? <img src="/simbolo-duomni.png" alt="" /> : <span className="org-avatar org-avatar-lider" style={{ background: corDe(l.nome) }}>{l.nome.trim().charAt(0).toUpperCase()}</span>}
            <div className="org-titulo">
              <em>{l.cargo}</em>
              <strong>{capitalizar(l.nome)}</strong>
              <span>{n} {n === 1 ? 'pessoa' : 'pessoas'} na equipe</span>
            </div>
          </div>
          {equipes.map((g) => {
            const pessoas = ativos.filter((c) => c.grupo_id === g.id);
            return (
              <div key={g.id} className="org-bloco-equipe">
                <Link href={`/grupos/${g.id}`} className="org-nome-equipe">{nomeGrupo(g)}</Link>
                {pessoas.length > 0 && <ul className="org-pessoas">{pessoas.slice(0, LIMITE).map((c) => <Pessoa key={c.id} c={c} />)}</ul>}
                {pessoas.length > LIMITE && (
                  <details className="org-mais">
                    <summary>+ {pessoas.length - LIMITE} pessoas</summary>
                    <ul className="org-pessoas">{pessoas.slice(LIMITE).map((c) => <Pessoa key={c.id} c={c} />)}</ul>
                  </details>
                )}
              </div>
            );
          })}
        </div>
        {subs.length > 0 && <ul>{subs.map((x) => <NoLider key={x.id} l={x} nivel={nivel + 1} />)}</ul>}
      </li>
    );
  }

  return (
    <>
      <div className="topo">
        <div>
          <h1>Organograma comercial</h1>
          <p className="sub">{ativos.length} colaboradores ativos{temLideranca ? ` e ${liderancas.length} lideranças` : ''}. Clique numa equipe ou pessoa para ver as metas.</p>
        </div>
        <div className="linha-acoes">
          {temLideranca && (
            <div className="alternar-visao">
              <Link href="/organograma" className={visao === 'lideranca' ? 'ativo' : ''}>Por liderança</Link>
              <Link href="/organograma?v=canal" className={visao === 'canal' ? 'ativo' : ''}>Por canal</Link>
            </div>
          )}
          {podeEditar(perfil) && <Link href="/organograma/editar" className="btn btn-sec">Editar cargos</Link>}
        </div>
      </div>
      {visao === 'lideranca' ? (
        <>
          {segundoNivel.length > 1 && (
            <div className="abas">
              <Link href="/organograma" className={!foco ? 'aba ativa' : 'aba'}>Todos</Link>
              {segundoNivel.map((l) => <Link key={l.id} href={`/organograma?l=${l.id}`} className={foco?.id === l.id ? 'aba ativa' : 'aba'}>{capitalizar(l.nome)}</Link>)}
            </div>
          )}
          <ZoomOrganograma key={foco?.id || 'todos-lid'}>
            <div className="org">
              <ul>
                {foco ? <NoLider l={foco} nivel={1} />
                  : raizesLid.length === 1 ? <NoLider l={raizesLid[0]} nivel={0} />
                  : (
                    <li>
                      <div className="org-no org-raiz">
                        <img src="/simbolo-duomni.png" alt="" />
                        <div className="org-titulo"><strong>Comercial Duomni</strong><span>{ativos.length + liderancas.length} pessoas</span></div>
                      </div>
                      <ul>{raizesLid.map((l) => <NoLider key={l.id} l={l} nivel={1} />)}</ul>
                    </li>
                  )}
              </ul>
            </div>
          </ZoomOrganograma>
          {!foco && semLider.length > 0 && (
            <section className="secao">
              <h2 style={{ marginBottom: 6 }}>Equipes ainda sem líder no organograma</h2>
              <p className="dica" style={{ marginBottom: 10 }}>Vincule essas equipes a um cargo em Editar cargos para elas aparecerem no desenho.</p>
              <div className="linha-acoes">{semLider.map((g) => <Link key={g.id} href={`/grupos/${g.id}`} className="tag">{nomeGrupo(g)} ({ativos.filter((c) => c.grupo_id === g.id).length})</Link>)}</div>
            </section>
          )}
        </>
      ) : (
      <>
      {!temLideranca && podeEditar(perfil) && (
        <p className="dica" style={{ marginBottom: 10 }}>Este desenho segue a estrutura de metas. Para montar Diretor, Gerentes, Coordenadores e Supervisores, use <Link href="/organograma/editar">Editar cargos</Link>.</p>
      )}
      <div className="abas">
        <Link href="/organograma?v=canal" className={!canal ? 'aba ativa' : 'aba'}>Todos</Link>
        {canais.map((c) => <Link key={c.id} href={`/organograma?v=canal&c=${c.id}`} className={canal?.id === c.id ? 'aba ativa' : 'aba'}>{c.nome}</Link>)}
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
      )}
    </>
  );
}
