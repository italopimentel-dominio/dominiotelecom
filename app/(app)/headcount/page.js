import Link from 'next/link';
import { exigirSessao, podeEditar } from '@/lib/auth';
import { listarPeriodos, escolherPeriodo, carregarBase, analisar } from '@/lib/dados';
import { ultimoDiaDoMes } from '@/lib/datas';
import { fmtData, fmtPct } from '@/lib/formato';
import { calcularHeadcount } from '@/lib/headcount';
import SeletorPeriodo from '@/components/SeletorPeriodo';
import SemPeriodo from '@/components/SemPeriodo';

export default async function Headcount({ searchParams }) {
  const sp = await searchParams;
  const { supabase, perfil } = await exigirSessao();
  const periodos = await listarPeriodos(supabase);
  const periodo = escolherPeriodo(periodos, sp.p);
  if (!periodo) return <SemPeriodo podeEditar={podeEditar(perfil)} />;
  const base = await carregarBase(supabase, periodo);
  const an = analisar(base);
  const inicio = periodo.referencia;
  const fim = ultimoDiaDoMes(inicio);
  const produtos = base.produtos.filter((p) => p.ativo);
  const produto = produtos.find((p) => p.id === sp.prod) || produtos[0];

  const colabsDe = (gid) => {
    const ids = new Set(base.subarvore(gid));
    return base.colaboradores.filter((c) => ids.has(c.grupo_id));
  };
  const metaDe = (gid) => {
    const r = { bateram: 0, dentro: 0, comMeta: 0 };
    if (!produto) return r;
    base.subarvore(gid).forEach((g) => an.individuais(g, produto).linhas.forEach((l) => {
      if (!l.noPeriodo || l.status === 'sem-meta') return;
      r.comMeta++;
      if (l.status === 'batida') r.bateram++;
      if (['batida', 'em-dia', 'inicio'].includes(l.status)) r.dentro++;
    }));
    return r;
  };

  const raizes = base.raizes.filter((g) => g.ativo);
  const geralHc = calcularHeadcount(base.colaboradores, inicio, fim);
  const geralMeta = raizes.reduce((acc, g) => { const m = metaDe(g.id); return { bateram: acc.bateram + m.bateram, dentro: acc.dentro + m.dentro, comMeta: acc.comMeta + m.comMeta }; }, { bateram: 0, dentro: 0, comMeta: 0 });
  const linhas = base.achatar(null, 0, true).map((g) => ({ g, hc: calcularHeadcount(colabsDe(g.id), inicio, fim), meta: metaDe(g.id) }))
    .filter((l) => l.hc.inicio || l.hc.admissoes.length || l.hc.desligamentos.length);
  const pct = (n, d) => (d ? ` (${Math.round((n / d) * 100)}%)` : '');
  const nomeGrupo = (id) => base.caminho(id).map((g) => g.nome).join(' / ');

  return (
    <>
      <div className="topo">
        <div>
          <h1>Headcount de {periodo.nome}</h1>
          <p className="sub">Fotografia do mês: quem começou, quem entrou e quem saiu entre {fmtData(inicio, true)} e {fmtData(fim, true)}, ao lado de quantos atingiram a meta.</p>
        </div>
        <div className="linha-acoes">
          {produto && (
            <form method="get" className="seletor">
              <input type="hidden" name="p" value={periodo.id} />
              <select name="prod" defaultValue={produto.id} aria-label="Produto para a meta">
                {produtos.map((p) => <option key={p.id} value={p.id}>Meta de {p.nome}</option>)}
              </select>
              <button className="btn btn-sec btn-peq" type="submit" style={{ marginLeft: 6 }}>Ver</button>
            </form>
          )}
          <SeletorPeriodo periodos={periodos} atual={periodo.id} />
        </div>
      </div>

      <div className="hc-cartoes">
        <div className="hc-cartao"><span>Começou o mês com</span><b>{geralHc.inicio}</b><small>colaboradores</small></div>
        <div className="hc-cartao hc-mais"><span>Admissões</span><b>+{geralHc.admissoes.length}</b><small>{fmtPct(geralHc.inicio ? geralHc.admissoes.length / geralHc.inicio : 0)} do início</small></div>
        <div className="hc-cartao hc-menos"><span>Desligamentos</span><b>−{geralHc.desligamentos.length}</b><small>{fmtPct(geralHc.pctPerdidos)} perdidos</small></div>
        <div className="hc-cartao"><span>Fecha o mês com</span><b>{geralHc.final}</b><small>{geralHc.variacao >= 0 ? '+' : ''}{fmtPct(geralHc.variacao)} no mês</small></div>
        <div className="hc-cartao hc-meta"><span>Atingiram a meta de {produto?.nome}</span><b>{geralMeta.bateram}<em>{pct(geralMeta.bateram, geralMeta.comMeta)}</em></b><small>{geralMeta.dentro}{pct(geralMeta.dentro, geralMeta.comMeta)} dentro do ritmo</small></div>
      </div>

      <div className="tabela-wrap" style={{ marginTop: 18 }}>
        <table>
          <thead>
            <tr>
              <th>Canal / equipe</th><th>Início do mês</th><th>Admissões</th><th>Desligamentos</th><th>Fim do mês</th><th>% perdidos</th>
              <th>Bateram a meta</th><th>Dentro do ritmo</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ g, hc, meta }) => (
              <tr key={g.id} className={`nivel-${Math.min(g.nivel, 3)}${g.nivel === 0 ? ' linha-grupo' : ''}`}>
                <td><Link href={`/grupos/${g.id}?p=${periodo.id}`}>{g.nome}</Link></td>
                <td>{hc.inicio}</td>
                <td className={hc.admissoes.length ? 'txt-ok' : 'fraco'}>{hc.admissoes.length ? `+${hc.admissoes.length}` : '0'}</td>
                <td className={hc.desligamentos.length ? 'txt-risco' : 'fraco'}>{hc.desligamentos.length ? `−${hc.desligamentos.length}` : '0'}</td>
                <td><strong>{hc.final}</strong></td>
                <td className={hc.pctPerdidos > 0.1 ? 'txt-risco' : ''}>{fmtPct(hc.pctPerdidos)}</td>
                <td>{meta.comMeta ? `${meta.bateram}${pct(meta.bateram, meta.comMeta)}` : '—'}</td>
                <td>{meta.comMeta ? `${meta.dentro}${pct(meta.dentro, meta.comMeta)}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="hc-listas">
        <section className="bloco">
          <h3>Admissões no mês ({geralHc.admissoes.length})</h3>
          {geralHc.admissoes.length ? (
            <ul>{[...geralHc.admissoes].sort((a, b) => a.data_admissao.localeCompare(b.data_admissao)).map((c) => (
              <li key={c.id}><span className="txt-ok">{fmtData(c.data_admissao)}</span> <Link href={`/colaboradores/${c.id}?p=${periodo.id}`}>{c.nome}</Link> <span className="dica">{nomeGrupo(c.grupo_id)}</span></li>
            ))}</ul>
          ) : <p className="dica">Nenhuma admissão.</p>}
        </section>
        <section className="bloco">
          <h3>Desligamentos no mês ({geralHc.desligamentos.length})</h3>
          {geralHc.desligamentos.length ? (
            <ul>{[...geralHc.desligamentos].sort((a, b) => a.data_desligamento.localeCompare(b.data_desligamento)).map((c) => (
              <li key={c.id}><span className="txt-risco">{fmtData(c.data_desligamento)}</span> <Link href={`/colaboradores/${c.id}?p=${periodo.id}`}>{c.nome}</Link> <span className="dica">{nomeGrupo(c.grupo_id)}</span></li>
            ))}</ul>
          ) : <p className="dica">Nenhum desligamento.</p>}
        </section>
      </div>
      <p className="dica" style={{ marginTop: 12 }}>
        Calculado pelas datas de admissão e desligamento. Quem está sem data de admissão conta como já presente no início do mês. Se alguém mudou de equipe, aparece na equipe atual.
      </p>
    </>
  );
}
