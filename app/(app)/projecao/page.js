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
const COR_SIT = { exec: 'var(--ok)', tram: 'var(--atencao)', canc: '#b9b4c8', backlog: '#c98a3a' };
const zero = () => ({ tramMes: 0, backlog: 0, backlogPor: {}, safra: { exec: 0, tram: 0, canc: 0 }, safras3: { exec: 0, canc: 0 } });
const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotSafra = (m) => (m ? `${NOMES_MES[+m.slice(5, 7) - 1]}/${m.slice(2, 4)}` : 'sem data');
// mês 'AAAA-MM' menos n
const mesMenos = (m, n) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 - n, 1)).toISOString().slice(0, 7);

// Pedidos da safra do mês (entraram no mês): total e funil executado | tramitando | pendente/cancelado
function PedidosSafra({ x, un }) {
  const s = x.safra, tot = x.entradas;
  const w = (v) => `${tot ? (v / tot) * 100 : 0}%`;
  return (
    <div style={{ minWidth: 170 }}>
      <b>{fmtValor(tot, un)}</b> <span className="dica">pedidos</span>
      <div aria-hidden="true" style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: '#ece9f3', margin: '3px 0 2px' }}>
        <span style={{ width: w(s.exec), background: COR_SIT.exec }} />
        <span style={{ width: w(s.tram), background: COR_SIT.tram }} />
        <span style={{ width: w(s.canc), background: COR_SIT.canc }} />
      </div>
      <span className="nome-sub">
        {fmtValor(s.exec, un)} exec. · {fmtValor(s.tram, un)} tram. · {fmtValor(s.canc, un)} pend./canc. · aprovação <b>{pctTxt(x.aprovMes)}</b>
        {x.aprov3 != null && <> (3 meses: {pctTxt(x.aprov3)})</>}
      </span>
    </div>
  );
}

// Backlog: tramitando de safras anteriores, com o detalhe por safra
function Backlog({ x, un }) {
  if (x.encerrado) return <span className="fraco">—</span>;
  const partes = Object.entries(x.backlogPor || {}).filter(([, v]) => v > 0).sort((a, b) => b[0].localeCompare(a[0]));
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <b style={{ color: x.backlog ? COR_SIT.backlog : undefined }}>{fmtValor(x.backlog, un)}</b>
      {partes.length > 0 && (
        <InfoBalao titulo="Backlog por safra" rotulo="Ver o backlog por mês de entrada">
          {partes.map(([k, v]) => <span key={k} style={{ display: 'block' }}>Safra {rotSafra(k)}: <b>{fmtValor(v, un)}</b> tramitando</span>)}
        </InfoBalao>
      )}
    </span>
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

function ContaProjecao({ x, un, nomeSafra }) {
  const a = pctTxt(x.aprov);
  const linha = (t) => <span style={{ display: 'block' }}>{t}</span>;
  if (x.encerrado) return <InfoBalao titulo="Mês encerrado" rotulo="Ver a conta">{linha('O mês acabou: a projeção é o próprio executado.')}</InfoBalao>;
  return (
    <InfoBalao titulo="Como chegamos neste número" rotulo="Ver a conta da projeção">
      {linha(<>Executado no mês (igual ao Painel): <b>{fmtValor(x.executado, un)}</b></>)}
      {linha(<>Em aberto: {fmtValor(x.tramMes, un)} do mês + {fmtValor(x.backlog, un)} backlog = {fmtValor(x.aberto, un)} × {a} = <b>{fmtValor(x.aberto * (x.aprov || 0), un, 1)}</b></>)}
      {x.ritmo != null && x.restantes > 0 && linha(<>Ainda devem entrar: {fmtValor(x.ritmo, un, 1)}/dia × {x.restantes} dias úteis = {fmtValor(x.novos, un, 1)} × {a} = <b>{fmtValor(x.novos * (x.aprov || 0), un, 1)}</b></>)}
      <span style={{ display: 'block', borderTop: '1px solid rgba(255,255,255,.25)', marginTop: 4, paddingTop: 4 }}>Projeção: <b>{fmtValor(x.projecao, un)}</b></span>
      {x.usouTres && linha(<span style={{ opacity: 0.85 }}>A safra do mês ainda não tem pedidos resolvidos: usei a aprovação dos últimos 3 meses.</span>)}
      {x.projecao3 != null && linha(<span style={{ opacity: 0.85 }}>Com a aprovação dos últimos 3 meses ({pctTxt(x.aprov3)}): {fmtValor(x.projecao3, un)}</span>)}
      <span style={{ display: 'block', marginTop: 6, opacity: 0.85 }}>
        Safra de {nomeSafra}: {fmtValor(x.entradas, un)} pedidos · {fmtValor(x.safra.exec, un)} executados · {fmtValor(x.safra.tram, un)} tramitando · {fmtValor(x.safra.canc, un)} pend./canc.
      </span>
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
  const mes = String(periodo.referencia).slice(0, 7);
  const tres = new Set([1, 2, 3].map((n) => mesMenos(mes, n)));
  const [base, carteira] = await Promise.all([
    carregarBase(supabase, periodo, medida),
    buscarTodas(() => supabase.from('pedidos_carteira').select('colaborador_id, grupo_id, produto_id, situacao, safra, qtd, valor').order('id')),
  ]);
  const atual = carteira;
  const an = analisar(base);
  const raizes = base.raizes.filter((g) => g.ativo);
  const canal = raizes.find((r) => r.id === sp.c) || raizes[0];
  const produtos = base.produtos.filter((p) => p.ativo);
  const q = (extra) => `?p=${periodo.id}${extra}`;

  // soma por equipe (subárvore) e produto; produto "soma" = soma das partes com peso
  const grupoDoColab = new Map(base.colaboradores.map((c) => [c.id, c.grupo_id]));
  // cada pedido da carteira vira: tramitando do mês, backlog, safra do mês ou safra dos 3 meses anteriores
  const idx = new Map();
  (carteira.data || []).forEach((r) => {
    const g = r.grupo_id || grupoDoColab.get(r.colaborador_id);
    if (!g) return;
    const v = Number(medida === 'brl' ? r.valor : r.qtd) || 0;
    const k = `${g}|${r.produto_id}`;
    const e = idx.get(k) || zero();
    if (r.situacao === 'tram') {
      if (r.safra === mes) e.tramMes += v;
      else if (!r.safra || r.safra < mes) { e.backlog += v; e.backlogPor[r.safra || ''] = (e.backlogPor[r.safra || ''] || 0) + v; }
    }
    if (r.safra === mes) e.safra[r.situacao] += v;
    if (tres.has(r.safra) && r.situacao !== 'tram') e.safras3[r.situacao] += v;
    idx.set(k, e);
  });
  const somarEm = (acc, x, peso = 1) => {
    acc.tramMes += x.tramMes * peso; acc.backlog += x.backlog * peso;
    Object.entries(x.backlogPor).forEach(([k, v]) => { acc.backlogPor[k] = (acc.backlogPor[k] || 0) + v * peso; });
    ['exec', 'tram', 'canc'].forEach((s) => { acc.safra[s] += x.safra[s] * peso; });
    ['exec', 'canc'].forEach((s) => { acc.safras3[s] += x.safras3[s] * peso; });
    return acc;
  };
  const compsDe = new Map(base.produtos.filter((p) => p.tipo === 'composto').map((p) => [p.id, p.componentes || []]));
  const funil = (g, pid, prof = 0) => {
    if (compsDe.has(pid) && prof < 5) return compsDe.get(pid).reduce((acc, c) => somarEm(acc, funil(g, c.componente_id, prof + 1), c.peso), zero());
    return base.subarvore(g).reduce((acc, id) => { const e = idx.get(`${id}|${pid}`); return e ? somarEm(acc, e) : acc; }, zero());
  };
  const linhaDe = (g, p) => {
    const ciclo = an.cicloDe(p);
    if (!ciclo) return null;
    const res = an.resumo(ciclo, g);
    const meta = an.meta(g, p.id);
    const f = funil(g, p.id);
    return { produto: p, temMeta: meta !== null, backlogPor: f.backlogPor, ...projetar({ executado: an.realizado(g, p.id), ...f }, res, meta) };
  };

  const grupos = canal ? [{ ...canal, nivel: 0 }, ...base.achatar(canal.id, 1, true)] : [];
  const secoes = grupos.map((g) => ({
    grupo: g,
    linhas: produtos.map((p) => linhaDe(g.id, p)).filter((l) => l && (l.temMeta || l.executado > 0 || l.aberto > 0 || l.entradas > 0)),
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
                <b>Executado</b>: o mesmo do Painel – Executado (mês de conclusão).<br />
                <b>Em aberto</b>: tudo o que está tramitando, da safra do mês e o <b>backlog</b> (pedidos de meses anteriores ainda tramitando).<br />
                <b>Aprovação</b>: da safra do mês (pedidos que entraram no mês) = executados ÷ (executados + pendentes/cancelados). Quem ainda tramita não entra.<br />
                <b>Ritmo</b>: pedidos que entraram no mês ÷ dias úteis que já passaram.<br />
                <b>Projeção</b> = executado + aprovação × (em aberto + ritmo × dias úteis que faltam).<br />
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

      {atual.error && <p className="msg msg-erro">Rode o arquivo 041_carteira_pedidos.sql no Supabase.</p>}
      {!atual.error && semDados && (
        <div className="vazio" style={{ marginBottom: 16 }}>
          <h2>A carteira de pedidos ainda não foi lida</h2>
          <p>Em Fonte de dados, clique em <b>Rodar agora</b>. A partir daí, a rodada de hora em hora atualiza a carteira sozinha.</p>
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
            <span><i style={{ background: COR_SIT.backlog }} />Backlog (tramitando de meses anteriores)</span>
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
                      <th>Produto</th><th>Meta</th><th>Executado no mês</th><th className="esq">Pedidos do mês (safra)</th><th>Backlog</th>
                      <th>Entrada/dia</th><th>Projeção</th><th className="esq">Projeção × meta</th><th>Precisa/dia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l) => {
                      const un = l.produto.unidade;
                      return (
                        <tr key={l.produto.id}>
                          <td>{l.produto.nome}{compsDe.has(l.produto.id) && <span className="tag-soma">soma</span>}</td>
                          <td>{l.temMeta ? fmtValor(l.meta, un) : '—'}</td>
                          <td><b>{fmtValor(l.executado, un)}</b></td>
                          <td className="esq"><PedidosSafra x={l} un={un} /></td>
                          <td><Backlog x={l} un={un} /></td>
                          <td>{l.ritmo != null ? fmtValor(l.ritmo, un, 1) : '—'}</td>
                          <td>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <b>{l.projecao != null ? fmtValor(l.projecao, un) : '—'}</b>
                              {l.projecao != null && <ContaProjecao x={l} un={un} nomeSafra={periodo.nome} />}
                            </span>
                          </td>
                          <td className="esq"><BarraMeta pct={l.pctMeta} status={l.status} /></td>
                          <td>{l.precisa != null ? (l.projecao >= l.meta ? <span className="tag tag-ok">no ritmo</span> : fmtValor(l.precisa, un, 1))
                            : l.temMeta && !l.encerrado ? <span className="fraco" title="Sem aprovação na safra do mês: ainda não dá para calcular">sem aprovação</span> : '—'}</td>
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
