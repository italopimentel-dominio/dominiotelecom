import Link from 'next/link';
import { exigirSessao, podeEditar } from '@/lib/auth';
import { listarPeriodos, escolherPeriodo, carregarBase, analisar } from '@/lib/dados';
import { fmtValor, fmtData } from '@/lib/formato';
import { lerMedida } from '@/lib/medidaServidor';
import { buscarTodas } from '@/lib/buscarTodas';
import { projetar } from '@/lib/projecao';
import AlternarMedida from '@/components/AlternarMedida';
import SeletorPeriodo from '@/components/SeletorPeriodo';
import SemPeriodo from '@/components/SemPeriodo';
import InfoBalao from '@/components/InfoBalao';

export const dynamic = 'force-dynamic';

const pctTxt = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const COR = { 'em-dia': 'var(--ok)', atencao: 'var(--atencao)', risco: 'var(--risco)', 'sem-meta': '#8f88a8' };
const COR_SIT = { exec: 'var(--ok)', tram: 'var(--atencao)', canc: '#b9b4c8' };
const zero = () => ({ exec: 0, tram: 0, canc: 0 });

// barra do funil: executado | tramitando | pendente/cancelado
function Funil({ x, un }) {
  const tot = x.pedidos || 0;
  const w = (v) => `${tot ? (v / tot) * 100 : 0}%`;
  return (
    <div style={{ minWidth: 150 }}>
      <b>{fmtValor(tot, un)}</b>
      <div aria-hidden="true" style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: '#ece9f3', margin: '3px 0 2px' }}>
        <span style={{ width: w(x.exec), background: COR_SIT.exec }} />
        <span style={{ width: w(x.tram), background: COR_SIT.tram }} />
        <span style={{ width: w(x.canc), background: COR_SIT.canc }} />
      </div>
      <span className="nome-sub">{fmtValor(x.exec, un)} exec. · {fmtValor(x.tram, un)} tram. · {fmtValor(x.canc, un)} pend./canc.</span>
    </div>
  );
}

function BarraMeta({ pct, status }) {
  if (pct == null) return <span className="fraco">sem meta</span>;
  return (
    <div style={{ minWidth: 110 }}>
      <b style={{ color: COR[status] }}>{pctTxt(pct)}</b>
      <div aria-hidden="true" style={{ position: 'relative', height: 8, borderRadius: 4, background: '#ece9f3', marginTop: 3 }}>
        <span style={{ position: 'absolute', inset: 0, width: `${Math.min(pct, 1.2) / 1.2 * 100}%`, background: COR[status], borderRadius: 4 }} />
        <i style={{ position: 'absolute', top: -2, bottom: -2, left: `${100 / 1.2}%`, width: 2, background: 'var(--texto, #2b2540)' }} title="Meta" />
      </div>
    </div>
  );
}

function ContaProjecao({ x, un }) {
  const a = pctTxt(x.aprov);
  return (
    <InfoBalao titulo="Como chegamos neste número" rotulo="Ver a conta da projeção">
      <span style={{ display: 'block' }}>Já executado: <b>{fmtValor(x.exec, un)}</b></span>
      <span style={{ display: 'block' }}>Tramitando: {fmtValor(x.tram, un)} × {a} aprovação = <b>{fmtValor(x.tram * (x.aprov || 0), un, 1)}</b></span>
      {x.ritmo != null && x.restantes > 0 && (
        <span style={{ display: 'block' }}>
          Pedidos que ainda devem entrar: {fmtValor(x.ritmo, un, 1)}/dia × {x.restantes} dias úteis = {fmtValor(x.novos, un, 1)} × {a} = <b>{fmtValor(x.novos * (x.aprov || 0), un, 1)}</b>
        </span>
      )}
      <span style={{ display: 'block', borderTop: '1px solid rgba(255,255,255,.25)', marginTop: 4, paddingTop: 4 }}>Projeção: <b>{fmtValor(x.projecao, un)}</b></span>
      {x.projecao3 != null && <span style={{ display: 'block', opacity: 0.85 }}>Com a aprovação dos últimos 3 meses ({pctTxt(x.aprov3)}): {fmtValor(x.projecao3, un)}</span>}
    </InfoBalao>
  );
}

export default async function PainelProjecao({ searchParams }) {
  const sp = await searchParams;
  const { supabase, perfil } = await exigirSessao();
  const periodos = await listarPeriodos(supabase);
  const periodo = escolherPeriodo(periodos, sp.p);
  if (!periodo) return <SemPeriodo podeEditar={podeEditar(perfil)} />;

  const medida = await lerMedida(sp);
  const anteriores = periodos.filter((p) => p.referencia < periodo.referencia).slice(0, 3); // listarPeriodos vem do mais novo
  const [base, atual, ant] = await Promise.all([
    carregarBase(supabase, periodo, medida),
    buscarTodas(() => supabase.from('pedidos_situacao').select('colaborador_id, grupo_id, produto_id, situacao, qtd, valor').eq('periodo_id', periodo.id).order('id')),
    anteriores.length
      ? buscarTodas(() => supabase.from('pedidos_situacao').select('colaborador_id, grupo_id, produto_id, situacao, qtd, valor').in('periodo_id', anteriores.map((p) => p.id)).order('id'))
      : Promise.resolve({ data: [] }),
  ]);
  const an = analisar(base);
  const raizes = base.raizes.filter((g) => g.ativo);
  const canal = raizes.find((r) => r.id === sp.c) || raizes[0];
  const produtos = base.produtos.filter((p) => p.ativo);
  const q = (extra) => `?p=${periodo.id}${extra}`;

  // soma por equipe (subárvore) e produto; produto "soma" = soma das partes com peso
  const grupoDoColab = new Map(base.colaboradores.map((c) => [c.id, c.grupo_id]));
  const indexar = (rows) => {
    const m = new Map();
    (rows || []).forEach((r) => {
      const g = r.grupo_id || grupoDoColab.get(r.colaborador_id);
      if (!g) return;
      const k = `${g}|${r.produto_id}`;
      const e = m.get(k) || zero();
      e[r.situacao] += Number(medida === 'brl' ? r.valor : r.qtd) || 0;
      m.set(k, e);
    });
    return m;
  };
  const idx = indexar(atual.data), idx3 = indexar(ant.data);
  const compsDe = new Map(base.produtos.filter((p) => p.tipo === 'composto').map((p) => [p.id, p.componentes || []]));
  const funil = (ix, g, pid, prof = 0) => {
    if (compsDe.has(pid) && prof < 5) {
      return compsDe.get(pid).reduce((acc, c) => {
        const x = funil(ix, g, c.componente_id, prof + 1);
        acc.exec += x.exec * c.peso; acc.tram += x.tram * c.peso; acc.canc += x.canc * c.peso;
        return acc;
      }, zero());
    }
    return base.subarvore(g).reduce((acc, id) => {
      const e = ix.get(`${id}|${pid}`);
      if (e) { acc.exec += e.exec; acc.tram += e.tram; acc.canc += e.canc; }
      return acc;
    }, zero());
  };
  const linhaDe = (g, p) => {
    const ciclo = an.cicloDe(p);
    if (!ciclo) return null;
    const res = an.resumo(ciclo, g);
    const f3 = funil(idx3, g, p.id);
    const aprov3 = f3.exec + f3.canc > 0 ? f3.exec / (f3.exec + f3.canc) : null;
    const meta = an.meta(g, p.id);
    return { produto: p, temMeta: meta !== null, ...projetar(funil(idx, g, p.id), res, meta, aprov3) };
  };

  const grupos = canal ? [{ ...canal, nivel: 0 }, ...base.achatar(canal.id, 1, true)] : [];
  const secoes = grupos.map((g) => ({
    grupo: g,
    linhas: produtos.map((p) => linhaDe(g.id, p)).filter((l) => l && (l.temMeta || l.pedidos > 0)),
  })).filter((s) => s.linhas.length);
  const res = base.ciclos[0] && canal ? an.resumo(base.ciclos[0], canal.id) : null;
  const semDados = !(atual.data || []).length;

  return (
    <>
      <div className="topo">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Painel – Projeção · {periodo.nome}
            <InfoBalao titulo="Como funciona a projeção" rotulo="Como funciona a projeção">
              <span style={{ display: 'block', fontWeight: 400, fontSize: 13 }}>
                Considera <b>todos os pedidos</b> que entraram no mês (pela data de entrada), não só os executados.<br />
                <b>Aprovação</b> = executados ÷ (executados + pendentes/cancelados). Quem ainda está tramitando não entra, porque não teve desfecho.<br />
                <b>Ritmo</b> = pedidos ÷ dias úteis que já passaram.<br />
                <b>Projeção</b> = executado + aprovação × (tramitando + ritmo × dias úteis que faltam).<br />
                <b>Precisa/dia</b> = quantos pedidos por dia, com a mesma aprovação, levam até a meta.
              </span>
            </InfoBalao>
          </h1>
          <p className="sub">Se o ritmo de vendas e a aprovação continuarem como estão, este é o resultado do mês. Hoje é {fmtData(an.hoje, true)}. <Link href={`/${q(canal ? `&c=${canal.id}` : '')}`}>Ver o executado →</Link></p>
        </div>
        <div className="linha-acoes">
          <AlternarMedida atual={medida} />
          <SeletorPeriodo periodos={periodos} atual={periodo.id} />
        </div>
      </div>

      {atual.error && <p className="msg msg-erro">Rode o arquivo 040_painel_projecao.sql no Supabase.</p>}
      {!atual.error && semDados && (
        <div className="vazio" style={{ marginBottom: 16 }}>
          <h2>Ainda não há pedidos deste mês</h2>
          <p>A projeção é gravada pela fonte de dados. Em Fonte de dados, clique em <b>Rodar agora</b> (mês atual) ou em <b>Ler planilha</b> e grave os meses que quiser.</p>
        </div>
      )}

      {!raizes.length ? (
        <div className="vazio"><h2>Nenhum canal cadastrado</h2></div>
      ) : (
        <>
          <div className="abas" role="tablist">
            {raizes.map((r) => (
              <Link key={r.id} href={q(`&c=${r.id}`)} className={r.id === canal.id ? 'aba ativa' : 'aba'} role="tab" aria-selected={r.id === canal.id}>{r.nome}</Link>
            ))}
          </div>

          {res && (
            <div className="calendario">
              <div><b>{res.total}</b><span>dias úteis no fechamento</span></div>
              <div><b>{res.decorridos}</b><span>já passaram</span></div>
              <div><b>{res.restantes}</b><span>restam (com hoje)</span></div>
            </div>
          )}
          <div className="legenda">
            <span><i style={{ background: COR_SIT.exec }} />Executado</span>
            <span><i style={{ background: COR_SIT.tram }} />Tramitando</span>
            <span><i style={{ background: COR_SIT.canc }} />Pendente/cancelado</span>
            <span><i className="marca-leg" />Meta</span>
          </div>

          {secoes.map(({ grupo, linhas }) => (
            <section key={grupo.id} className={grupo.nivel ? `recuo-${Math.min(grupo.nivel, 3)}` : ''}>
              <div className="grupo-cab">
                <h2>{grupo.nome}</h2>
                <span className="tag">{an.colabsAtivosSub(grupo.id)} colaboradores</span>
              </div>
              <div className="tabela-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Produto</th><th>Meta</th><th className="esq">Pedidos do mês</th><th>Aprovação</th>
                      <th>Ritmo/dia</th><th>Projeção</th><th className="esq">Projeção × meta</th><th>Precisa/dia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l) => {
                      const un = l.produto.unidade;
                      return (
                        <tr key={l.produto.id}>
                          <td>{l.produto.nome}{compsDe.has(l.produto.id) && <span className="tag-soma">soma</span>}</td>
                          <td>{l.temMeta ? fmtValor(l.meta, un) : '—'}</td>
                          <td className="esq"><Funil x={l} un={un} /></td>
                          <td>
                            {pctTxt(l.aprov)}
                            {l.aprov3 != null && <span className="nome-sub" title="Média dos últimos 3 meses">3 meses: {pctTxt(l.aprov3)}</span>}
                          </td>
                          <td>{l.ritmo != null ? fmtValor(l.ritmo, un, 1) : '—'}</td>
                          <td>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <b>{l.projecao != null ? fmtValor(l.projecao, un) : '—'}</b>
                              {l.projecao != null && <ContaProjecao x={l} un={un} />}
                            </span>
                          </td>
                          <td className="esq"><BarraMeta pct={l.pctMeta} status={l.status} /></td>
                          <td>{l.precisa == null ? '—' : l.projecao >= l.meta ? <span className="tag tag-ok">no ritmo</span> : fmtValor(l.precisa, un, 1)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </>
      )}
    </>
  );
}
