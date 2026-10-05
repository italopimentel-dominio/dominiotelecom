import Link from 'next/link';
import { exigirSessao, podeEditar } from '@/lib/auth';
import { listarPeriodos, escolherPeriodo, carregarBase, analisar } from '@/lib/dados';
import { ultimoDiaDoMes } from '@/lib/datas';
import { fmtData, fmtPct } from '@/lib/formato';
import { calcularHeadcount } from '@/lib/headcount';
import { lerMedida } from '@/lib/medidaServidor';
import AlternarMedida from '@/components/AlternarMedida';
import SeletorPeriodo from '@/components/SeletorPeriodo';
import SemPeriodo from '@/components/SemPeriodo';

export default async function Headcount({ searchParams }) {
  const sp = await searchParams;
  const { supabase, perfil } = await exigirSessao();
  const periodos = await listarPeriodos(supabase);
  const periodo = escolherPeriodo(periodos, sp.p);
  if (!periodo) return <SemPeriodo podeEditar={podeEditar(perfil)} />;
  const medida = await lerMedida(sp);
  const base = await carregarBase(supabase, periodo, medida);
  const an = analisar(base);
  const inicio = periodo.referencia;
  const fim = ultimoDiaDoMes(inicio);

  const colabsDe = (gid) => {
    const ids = new Set(base.subarvore(gid));
    return base.colaboradores.filter((c) => ids.has(c.grupo_id));
  };
  const contar = (lista) => ({
    total: lista.length,
    dentro: lista.filter((x) => x.status !== 'fora').length,
    bateram: lista.filter((x) => x.status === 'batida').length,
  });

  // ---------- filtro por supervisor (equipes da ponta), com várias escolhas ----------
  const [{ data: lids }, { data: vinc }] = await Promise.all([
    supabase.from('liderancas').select('id, nome, ativo'),
    supabase.from('lideranca_grupos').select('*'),
  ]);
  const liderDe = new Map();
  (vinc || []).forEach((v) => { const l = (lids || []).find((x) => x.id === v.lideranca_id && x.ativo); if (l) liderDe.set(v.grupo_id, l.nome); });
  const opcoes = base.achatar(null, 0, true)
    .filter((g) => base.colaboradores.some((c) => c.grupo_id === g.id) || !base.filhosDe(g.id).some((f) => f.ativo))
    .map((g) => ({ id: g.id, rotulo: liderDe.get(g.id) || g.nome, caminho: base.caminho(g.id).slice(0, -1).map((x) => x.nome).join(' / ') }));
  const escolhidos = [].concat(sp.sup || []).filter((id) => opcoes.some((o) => o.id === id));
  const filtrando = escolhidos.length > 0;

  const raizes = base.raizes.filter((g) => g.ativo);
  const focoIds = filtrando ? escolhidos : raizes.map((g) => g.id);
  const todosIds = [...new Set(focoIds.flatMap((id) => base.subarvore(id)))];
  const idsSet = new Set(todosIds);
  const geralHc = calcularHeadcount(base.colaboradores.filter((c) => filtrando ? idsSet.has(c.grupo_id) : true), inicio, fim);
  const geralMeta = an.geralGrupos(focoIds);
  const geralPessoas = contar(an.geralColaboradores(todosIds));
  const gruposTabela = filtrando ? base.achatar(null, 0, true).filter((g) => escolhidos.includes(g.id)).map((g) => ({ ...g, nivel: 0 })) : base.achatar(null, 0, true);
  const linhas = gruposTabela.map((g) => ({
    g,
    hc: calcularHeadcount(colabsDe(g.id), inicio, fim),
    meta: an.geralGrupos([g.id]),
    pessoas: contar(an.geralColaboradores(base.subarvore(g.id))),
  })).filter((l) => l.hc.inicio || l.hc.admissoes.length || l.hc.desligamentos.length);
  const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');
  const nomeGrupo = (id) => base.caminho(id).map((g) => g.nome).join(' / ');
  const corAting = (m) => (m.produtos === 0 ? '' : m.atingimento >= 1 ? 'txt-ok' : m.atingimento >= m.esperado ? '' : 'txt-risco');

  return (
    <>
      <div className="topo">
        <div>
          <h1>Headcount de {periodo.nome}</h1>
          <p className="sub">Quem começou o mês, quem entrou e quem saiu entre {fmtData(inicio, true)} e {fmtData(fim, true)}, e como está a meta geral (todos os produtos juntos).</p>
        </div>
        <div className="linha-acoes">
          <details className="filtro-multi">
            <summary>{filtrando ? `${escolhidos.length} ${escolhidos.length === 1 ? 'supervisor' : 'supervisores'}` : 'Todos os supervisores'} ▾</summary>
            <form method="get" className="filtro-multi-caixa">
              <input type="hidden" name="p" value={periodo.id} />
              <p className="dica" style={{ marginBottom: 6 }}>Escolha um ou mais</p>
              <div className="filtro-multi-lista">
                {opcoes.map((o) => (
                  <label key={o.id} className="check">
                    <input type="checkbox" name="sup" value={o.id} defaultChecked={escolhidos.includes(o.id)} />
                    <span>{o.rotulo}{o.caminho && <span className="nome-sub">{o.caminho}</span>}</span>
                  </label>
                ))}
              </div>
              <div className="linha-acoes" style={{ marginTop: 10 }}>
                <button className="btn btn-peq" type="submit">Aplicar</button>
                <a className="dica" href={`/headcount?p=${periodo.id}`}>Limpar</a>
              </div>
            </form>
          </details>
          <AlternarMedida atual={medida} />
          <SeletorPeriodo periodos={periodos} atual={periodo.id} />
        </div>
      </div>

      {filtrando && (
        <p className="filtro-ativo">
          Mostrando: {escolhidos.map((id) => opcoes.find((o) => o.id === id)?.rotulo).join(', ')}
          <a href={`/headcount?p=${periodo.id}`}>× limpar filtro</a>
        </p>
      )}
      <div className="hc-cartoes">
        <div className="hc-cartao"><span>Começou o mês com</span><b>{geralHc.inicio}</b><small>colaboradores</small></div>
        <div className="hc-cartao hc-mais"><span>Admissões</span><b>+{geralHc.admissoes.length}</b><small>{fmtPct(geralHc.inicio ? geralHc.admissoes.length / geralHc.inicio : 0)} do início</small></div>
        <div className="hc-cartao hc-menos"><span>Desligamentos</span><b>−{geralHc.desligamentos.length}</b><small>{fmtPct(geralHc.pctPerdidos)} perdidos</small></div>
        <div className="hc-cartao"><span>Fecha o mês com</span><b>{geralHc.final}</b><small>{geralHc.variacao >= 0 ? '+' : ''}{fmtPct(geralHc.variacao)} no mês</small></div>
        <div className="hc-cartao hc-meta">
          <span>Meta geral atingida</span>
          <b>{fmtPct(geralMeta.atingimento)}</b>
          <small>o esperado até hoje era {fmtPct(geralMeta.esperado)}</small>
        </div>
        <div className="hc-cartao">
          <span>Colaboradores dentro da meta</span>
          <b>{geralPessoas.dentro}<em>{pct(geralPessoas.dentro, geralPessoas.total)}</em></b>
          <small>{geralPessoas.total - geralPessoas.dentro} ({pct(geralPessoas.total - geralPessoas.dentro, geralPessoas.total)}) fora, {geralPessoas.bateram} já bateram</small>
        </div>
      </div>

      <details className="recolhivel" style={{ marginTop: 10 }}>
        <summary>Como a meta geral é calculada</summary>
        <p className="bloco dica" style={{ marginTop: 6 }}>
          Para cada produto com meta, o sistema vê quanto % já foi atingido (realizado ÷ meta) e tira a média de todos os produtos.
          Assim, quantidade e R$ entram na mesma conta. O "esperado até hoje" é a parte do mês que já passou em dias úteis.
          Um colaborador está <b>dentro da meta</b> quando o % geral dele é igual ou maior que o esperado até hoje.
        </p>
      </details>

      <div className="tabela-wrap" style={{ marginTop: 14 }}>
        <table>
          <thead>
            <tr>
              <th>Canal / equipe</th><th>Início do mês</th><th>Admissões</th><th>Desligamentos</th><th>Fim do mês</th><th>% perdidos</th>
              <th>Meta geral</th><th>Dentro da meta</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ g, hc, meta, pessoas }) => (
              <tr key={g.id} className={`nivel-${Math.min(g.nivel, 3)}${g.nivel === 0 ? ' linha-grupo' : ''}`}>
                <td><Link href={`/grupos/${g.id}?p=${periodo.id}`}>{g.nome}</Link></td>
                <td>{hc.inicio}</td>
                <td className={hc.admissoes.length ? 'txt-ok' : 'fraco'}>{hc.admissoes.length ? `+${hc.admissoes.length}` : '0'}</td>
                <td className={hc.desligamentos.length ? 'txt-risco' : 'fraco'}>{hc.desligamentos.length ? `−${hc.desligamentos.length}` : '0'}</td>
                <td><strong>{hc.final}</strong></td>
                <td className={hc.pctPerdidos > 0.1 ? 'txt-risco' : ''}>{fmtPct(hc.pctPerdidos)}</td>
                <td className={corAting(meta)}>{meta.produtos ? fmtPct(meta.atingimento) : '—'}</td>
                <td>{pessoas.total ? `${pessoas.dentro} de ${pessoas.total} (${pct(pessoas.dentro, pessoas.total)})` : '—'}</td>
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
        Headcount calculado pelas datas de admissão e desligamento. Quem está sem data de admissão conta como já presente no início do mês. Se alguém mudou de equipe, aparece na equipe atual.
      </p>
    </>
  );
}
