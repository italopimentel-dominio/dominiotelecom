import Link from 'next/link';
import { exigirSessao, podeEditar } from '@/lib/auth';
import { listarPeriodos, escolherPeriodo, carregarBase, carregarEstrutura, analisar } from '@/lib/dados';
import { fmtValor, fmtPct } from '@/lib/formato';
import { salvarMetaEmpresa, copiarMetasEmpresa, salvarIndicadoresResumo } from '@/app/actions/dados';
import CampoNumero from '@/components/CampoNumero';
import FormAcao from '@/components/FormAcao';
import { lerMedida } from '@/lib/medidaServidor';
import { produtosDaMedida } from '@/lib/medida';
import AlternarMedida from '@/components/AlternarMedida';
import SeletorPeriodo from '@/components/SeletorPeriodo';
import SemPeriodo from '@/components/SemPeriodo';

// Busca todas as linhas (o Supabase devolve no máximo 1000 por vez), filtrando pela medida.
// Se a coluna "medida" ainda não existe, busca sem filtro.
async function buscarTodos(consulta, medida) {
  const ler = async (filtrar) => {
    const tudo = [];
    for (let de = 0; ; de += 1000) {
      let q = consulta();
      if (filtrar) q = q.eq('medida', medida);
      const { data, error } = await q.range(de, de + 999);
      if (error) return null;
      tudo.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return tudo;
  };
  return (medida && (await ler(true))) || (await ler(false)) || [];
}

const corAting = (v, esperado) => (v === null ? '' : v >= 1 ? 'rz-ok' : v >= esperado * 0.85 ? 'rz-md' : 'rz-bx');

// Indicadores do resumo: os escolhidos (na ordem dos produtos) ou, se ninguém escolheu,
// as somas (classes) e os produtos que não fazem parte de nenhuma soma
function montarIndicadores(produtos, escolhidos) {
  const ativos = produtos.filter((p) => p.ativo);
  if (escolhidos?.length) {
    const sel = new Set(escolhidos);
    const lista = ativos.filter((p) => sel.has(p.id));
    if (lista.length) return lista;
  }
  const dentroDeSoma = new Set(ativos.filter((p) => p.tipo === 'composto').flatMap((p) => p.componentes.map((c) => c.componente_id)));
  return ativos.filter((p) => p.tipo === 'composto' || !dentroDeSoma.has(p.id));
}

function metaDistribuidaFn(an, produtos) {
  const porId = new Map(produtos.map((p) => [p.id, p]));
  return (g, p) => {
    const v = an.meta(g, p.id);
    if (v !== null || p.tipo !== 'composto') return v;
    const partes = p.componentes.map((c) => { const m = an.meta(g, c.componente_id); return m === null ? null : m * c.peso; }).filter((x) => x !== null);
    return partes.length && porId.size ? partes.reduce((s, x) => s + x, 0) : null;
  };
}

export default async function Resumo({ searchParams }) {
  const sp = await searchParams;
  const { supabase, perfil } = await exigirSessao();
  const editar = podeEditar(perfil);
  const periodos = await listarPeriodos(supabase);
  const periodo = escolherPeriodo(periodos, sp.p);
  if (!periodo) return <SemPeriodo podeEditar={editar} />;
  const aba = sp.aba === 'historico' ? 'historico' : 'mes';
  const medida = await lerMedida(sp);
  const { data: cfg } = await supabase.from('config').select('resumo_produtos').eq('id', 1).maybeSingle();
  const escolhidos = cfg?.resumo_produtos || null;
  const abrir = sp.nivel === '2';

  const Abas = () => (
    <div className="topo">
      <div>
        <h1>Resumo da empresa</h1>
        <p className="sub">Meta da empresa, meta distribuída aos canais, quem está atingindo e quem está trazendo mais resultado.</p>
      </div>
      <div className="linha-acoes">
        <div className="alternar-visao">
          <Link href={`/resumo?p=${periodo.id}`} className={aba === 'mes' ? 'ativo' : ''}>Mês</Link>
          <Link href={`/resumo?p=${periodo.id}&aba=historico`} className={aba === 'historico' ? 'ativo' : ''}>Histórico</Link>
        </div>
        <AlternarMedida atual={medida} />
        {aba === 'mes' && <SeletorPeriodo periodos={periodos} atual={periodo.id} />}
      </div>
    </div>
  );

  // ================= HISTÓRICO =================
  if (aba === 'historico') {
    const lista = [...periodos].sort((a, b) => a.referencia.localeCompare(b.referencia)).slice(-12);
    const ids = lista.map((p) => p.id);
    const [est, metas, realizados, realizadosGrupo, metasEmp] = await Promise.all([
      carregarEstrutura(supabase),
      buscarTodos(() => supabase.from('metas').select('*').in('periodo_id', ids), medida),
      buscarTodos(() => supabase.from('realizados').select('*').in('periodo_id', ids).order('periodo_id').order('colaborador_id').order('produto_id'), medida),
      buscarTodos(() => supabase.from('realizados_grupo').select('*').in('periodo_id', ids), medida),
      buscarTodos(() => supabase.from('metas_empresa').select('*').in('periodo_id', ids), medida),
    ]);
    const produtosM = produtosDaMedida(est.produtos, medida);
    const indicadores = montarIndicadores(produtosM, escolhidos);
    const raizes = est.raizes.filter((g) => g.ativo);
    const colunas = lista.map((per) => {
      const base = {
        ...est, produtos: produtosM, periodo: per, ciclos: [], metasIndividuais: [], feriados: [], config: null,
        metas: metas.filter((m) => m.periodo_id === per.id),
        realizados: realizados.filter((r) => r.periodo_id === per.id),
        realizadosGrupo: realizadosGrupo.filter((r) => r.periodo_id === per.id),
      };
      const an = analisar(base);
      const metaDist = metaDistribuidaFn(an, produtosM);
      const emp = new Map(metasEmp.filter((m) => m.periodo_id === per.id).map((m) => [m.produto_id, Number(m.valor)]));
      const valores = new Map(indicadores.map((p) => {
        const dist = raizes.map((g) => metaDist(g.id, p)).filter((x) => x !== null);
        const meta = emp.get(p.id) ?? (dist.length ? dist.reduce((s, x) => s + x, 0) : null);
        const real = raizes.reduce((s, g) => s + an.realizado(g.id, p.id), 0);
        return [p.id, { meta, real, pct: meta ? real / meta : null, daEmpresa: emp.has(p.id) }];
      }));
      return { per, valores };
    });
    return (
      <>
        <Abas />
        <p className="dica" style={{ marginBottom: 10 }}>
          % atingido de cada mês sobre a meta da empresa (ou sobre a meta distribuída, marcada com *, quando o mês não tem meta da empresa).
          Para ajustar um mês, clique nele: dá para corrigir a meta da empresa lá e os resultados no Quadro de metas ou na importação.
        </p>
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr><th>Indicador</th>{colunas.map(({ per }) => <th key={per.id}><Link href={`/resumo?p=${per.id}`}>{per.nome.replace(/ \d{4}$/, '').slice(0, 3)}/{per.referencia.slice(2, 4)}</Link></th>)}</tr>
            </thead>
            <tbody>
              {indicadores.map((p) => (
                <tr key={p.id}>
                  <td>{p.nome}</td>
                  {colunas.map(({ per, valores }) => {
                    const v = valores.get(p.id);
                    return (
                      <td key={per.id} className={v.pct === null ? 'fraco' : corAting(v.pct, 1)} title={v.meta ? `${fmtValor(v.real, p.unidade)} de ${fmtValor(v.meta, p.unidade)}` : undefined}>
                        {v.pct === null ? '—' : <>{fmtPct(v.pct)}{!v.daEmpresa && '*'}<span className="nome-sub">{fmtValor(v.real, p.unidade)}</span></>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  // ================= MÊS =================
  const base = await carregarBase(supabase, periodo, medida);
  const an = analisar(base);
  const me = await buscarTodos(() => supabase.from('metas_empresa').select('*').eq('periodo_id', periodo.id), medida);
  const metaEmp = new Map(me.map((m) => [m.produto_id, Number(m.valor)]));
  const produtos = base.produtos;
  const indicadores = montarIndicadores(produtos, escolhidos);
  const marcados = new Set(indicadores.map((p) => p.id));
  const metaDist = metaDistribuidaFn(an, produtos);
  const raizes = base.raizes.filter((g) => g.ativo);
  const linhasCanal = raizes.flatMap((g) => [{ g, nivel: 0 }, ...(abrir ? base.filhosDe(g.id).filter((f) => f.ativo).map((f) => ({ g: f, nivel: 1 })) : [])]);
  const soma = (l) => (l.length ? l.reduce((s, x) => s + x, 0) : null);
  const totais = new Map(produtos.filter((p) => p.ativo).map((p) => {
    const dist = soma(raizes.map((g) => metaDist(g.id, p)).filter((x) => x !== null));
    const real = raizes.reduce((s, g) => s + an.realizado(g.id, p.id), 0);
    const emp = metaEmp.has(p.id) ? metaEmp.get(p.id) : null;
    const ind = raizes.length ? an.indicador(raizes[0].id, p) : null;
    return [p.id, { dist, real, emp, esperado: ind?.esperado ?? 0 }];
  }));
  const outros = periodos.filter((x) => x.id !== periodo.id);
  const linhasDetalhe = indicadores.flatMap((p) => [{ p, sub: false }, ...(p.tipo === 'composto' ? p.componentes.map((c) => produtos.find((x) => x.id === c.componente_id)).filter((x) => x?.ativo).map((x) => ({ p: x, sub: true })) : [])]);

  return (
    <>
      <Abas />

      {editar && (
        <details className="recolhivel" style={{ marginBottom: 12 }}>
          <summary>⚙ Escolher os indicadores deste resumo</summary>
          <FormAcao acao={salvarIndicadoresResumo} className="bloco">
            <p className="dica" style={{ marginBottom: 8 }}>Marque o que deve aparecer nos cartões, nas tabelas por canal e no histórico. Vale para todos os usuários. A ordem segue a ordem dos produtos (Cadastros &gt; Produtos).</p>
            <div className="resumo-escolha">
              {produtos.filter((p) => p.ativo).map((p) => (
                <label key={p.id} className="check">
                  <input type="checkbox" name="ind" value={p.id} defaultChecked={marcados.has(p.id)} />
                  {p.nome}{p.tipo === 'composto' && <span className="tag-soma">soma</span>}
                </label>
              ))}
            </div>
            <div className="linha-acoes" style={{ marginTop: 10 }}>
              <button className="btn btn-peq" type="submit">Salvar escolha</button>
              <span className="dica">{escolhidos?.length ? 'Escolha personalizada.' : 'Hoje está automático (somas e produtos fora de soma). Desmarque tudo e salve para voltar ao automático.'}</span>
            </div>
          </FormAcao>
        </details>
      )}

      <div className="hc-cartoes">
        {indicadores.map((p) => {
          const t = totais.get(p.id);
          const meta = t.emp ?? t.dist;
          const pct = meta ? t.real / meta : null;
          return (
            <div key={p.id} className="hc-cartao">
              <span>{p.nome}</span>
              <b className={pct === null ? '' : corAting(pct, t.esperado)}>{fmtPct(pct)}</b>
              <div className="cp-barra" style={{ margin: '4px 0' }}><span style={{ width: `${Math.min(pct || 0, 1) * 100}%` }} /></div>
              <small>{fmtValor(t.real, p.unidade)} de {meta !== null ? fmtValor(meta, p.unidade) : '—'}{t.emp === null && meta !== null ? ' (distribuída)' : ''}</small>
              {t.emp !== null && t.dist !== null && <small>distribuída: {fmtValor(t.dist, p.unidade)} ({t.dist >= t.emp ? '+' : ''}{fmtPct(t.dist / t.emp - 1)})</small>}
            </div>
          );
        })}
      </div>
      <p className="dica" style={{ marginTop: 6 }}>Esperado até hoje: {fmtPct(totais.get(indicadores[0]?.id)?.esperado ?? 0)} do mês (dias úteis).</p>

      <section className="secao">
        <h2 style={{ marginBottom: 6 }}>% de atingimento por canal</h2>
        <p className="dica" style={{ marginBottom: 10 }}>Realizado do canal sobre a meta distribuída para ele.</p>
        <div className="tabela-wrap">
          <table className="rz-tabela">
            <thead><tr><th>Canal</th>{indicadores.map((p) => <th key={p.id}>{p.nome}</th>)}</tr></thead>
            <tbody>
              {linhasCanal.map(({ g, nivel }) => (
                <tr key={g.id} className={nivel ? 'nivel-1' : ''}>
                  <td><Link href={`/grupos/${g.id}?p=${periodo.id}`}>{g.nome}</Link></td>
                  {indicadores.map((p) => {
                    const m = metaDist(g.id, p);
                    const r = an.realizado(g.id, p.id);
                    const v = m ? r / m : null;
                    return <td key={p.id} className={corAting(v, totais.get(p.id).esperado)} title={`${fmtValor(r, p.unidade)} de ${m !== null ? fmtValor(m, p.unidade) : 'sem meta'}`}>{v === null ? '—' : fmtPct(v)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="secao">
        <h2 style={{ marginBottom: 6 }}>% de participação: quem é mais exigido e quem traz mais resultado</h2>
        <p className="dica" style={{ marginBottom: 10 }}>
          <span className="rz-leg rz-leg-meta" /> parte da meta da empresa que está com o canal (exigência)
          <span className="rz-leg rz-leg-real" style={{ marginLeft: 14 }} /> parte do resultado da empresa que veio do canal.
          ▲ = trazendo mais do que a parte dele na meta.
        </p>
        <div className="tabela-wrap">
          <table className="rz-tabela">
            <thead><tr><th>Canal</th>{indicadores.map((p) => <th key={p.id}>{p.nome}</th>)}</tr></thead>
            <tbody>
              {linhasCanal.map(({ g, nivel }) => (
                <tr key={g.id} className={nivel ? 'nivel-1' : ''}>
                  <td>{g.nome}</td>
                  {indicadores.map((p) => {
                    const t = totais.get(p.id);
                    const m = metaDist(g.id, p);
                    const r = an.realizado(g.id, p.id);
                    const pm = m !== null && t.dist ? m / t.dist : null;
                    const pr = t.real ? r / t.real : null;
                    if (pm === null && !pr) return <td key={p.id} className="fraco">—</td>;
                    return (
                      <td key={p.id} className="rz-part">
                        <div className="rz-par"><span className="rz-b rz-b-meta" style={{ width: `${(pm || 0) * 100}%` }} /><em>{fmtPct(pm || 0)}</em></div>
                        <div className="rz-par"><span className="rz-b rz-b-real" style={{ width: `${(pr || 0) * 100}%` }} /><em>{fmtPct(pr || 0)}{pr !== null && pm !== null && (pr > pm ? ' ▲' : pr < pm ? ' ▼' : '')}</em></div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ marginTop: 8 }}><Link href={`/resumo?p=${periodo.id}${abrir ? '' : '&nivel=2'}`} className="dica">{abrir ? 'Mostrar só os canais' : 'Abrir unidades e equipes de cada canal (Campinas, São Paulo, Inbound...)'}</Link></p>
      </section>

      <section className="secao">
        <h2 style={{ marginBottom: 6 }}>Detalhe por produto</h2>
        <p className="dica" style={{ marginBottom: 10 }}>{editar ? 'A meta da empresa é o único número lançado aqui; o resto vem do Quadro de metas e dos resultados.' : 'Meta da empresa, meta distribuída aos canais e realizado.'}</p>
        <div className="tabela-wrap">
          <table>
            <thead><tr><th>Indicador</th><th>Meta da empresa</th><th>Meta distribuída</th><th>Folga</th><th>Realizado</th><th>% da meta da empresa</th><th>% da distribuída</th></tr></thead>
            <tbody>
              {linhasDetalhe.map(({ p, sub }) => {
                const t = totais.get(p.id);
                return (
                  <tr key={`${p.id}-${sub}`} className={sub ? 'nivel-1' : 'linha-soma-leve'}>
                    <td>{p.nome}{p.tipo === 'composto' && <span className="tag-soma">soma</span>}</td>
                    <td>{editar ? <CampoNumero largo rotulo={`Meta da empresa ${p.nome}`} acao={salvarMetaEmpresa.bind(null, periodo.id, p.id, medida)} valor={t.emp} placeholder="—" /> : fmtValor(t.emp, p.unidade)}</td>
                    <td>{fmtValor(t.dist, p.unidade)}</td>
                    <td className="fraco">{t.emp && t.dist !== null ? `${t.dist >= t.emp ? '+' : ''}${fmtPct(t.dist / t.emp - 1)}` : '—'}</td>
                    <td>{fmtValor(t.real, p.unidade)}</td>
                    <td className={t.emp ? corAting(t.real / t.emp, t.esperado) : 'fraco'}>{t.emp ? fmtPct(t.real / t.emp) : '—'}</td>
                    <td className={t.dist ? corAting(t.real / t.dist, t.esperado) : 'fraco'}>{t.dist ? fmtPct(t.real / t.dist) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {editar && outros.length > 0 && (
          <FormAcao acao={copiarMetasEmpresa} className="bloco" confirmar={`Substituir a meta da empresa de ${periodo.nome}?`}>
            <div className="campos" style={{ marginTop: 4 }}>
              <input type="hidden" name="destino" value={periodo.id} />
              <label className="campo">Copiar a meta da empresa de
                <select name="origem">{outros.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select>
              </label>
              <button className="btn btn-sec" type="submit">Copiar</button>
            </div>
          </FormAcao>
        )}
      </section>
    </>
  );
}
