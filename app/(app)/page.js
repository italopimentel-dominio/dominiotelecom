import Link from 'next/link';
import { exigirSessao, podeEditar } from '@/lib/auth';
import { listarPeriodos, escolherPeriodo, carregarBase, analisar } from '@/lib/dados';
import { fmtValor, fmtData, fmtFator, STATUS } from '@/lib/formato';
import BarraRitmo from '@/components/BarraRitmo';
import Composicao from '@/components/Composicao';
import SeletorPeriodo from '@/components/SeletorPeriodo';
import SemPeriodo from '@/components/SemPeriodo';

export default async function Painel({ searchParams }) {
  const sp = await searchParams;
  const { supabase, perfil } = await exigirSessao();
  const periodos = await listarPeriodos(supabase);
  const periodo = escolherPeriodo(periodos, sp.p);
  if (!periodo) return <SemPeriodo podeEditar={podeEditar(perfil)} />;

  const base = await carregarBase(supabase, periodo);
  const an = analisar(base);
  const raizes = base.raizes.filter((g) => g.ativo);
  const canal = raizes.find((r) => r.id === sp.c) || raizes[0];
  const produtos = base.produtos.filter((p) => p.ativo);
  const fator = fmtFator(periodo.fator_bruto);

  const grupos = canal ? [{ ...canal, nivel: 0 }, ...base.achatar(canal.id, 1, true)] : [];
  const secoes = grupos.map((g) => ({
    grupo: g,
    linhas: produtos.map((p) => an.indicador(g.id, p)).filter((i) => i && (i.temMeta || i.realizado > 0)),
  })).filter((s) => s.linhas.length);

  const cicloGeral = base.ciclos[0];
  const res = cicloGeral && canal ? an.resumo(cicloGeral, canal.id) : null;
  const q = (extra) => `?p=${periodo.id}${extra}`;

  return (
    <>
      <div className="topo">
        <div>
          <h1>{periodo.nome}</h1>
          <p className="sub">Hoje é {fmtData(an.hoje, true)}. Necessidade bruta calculada com {fator}.</p>
        </div>
        <SeletorPeriodo periodos={periodos} atual={periodo.id} />
      </div>

      {!raizes.length ? (
        <div className="vazio"><h2>Nenhum canal cadastrado</h2><p>Cadastre Televendas, Consultivo e Indireto em Equipes e colaboradores.</p></div>
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
              <div><b>{res.semanasRestantes}</b><span>semanas com dias úteis</span></div>
            </div>
          )}
          <div className="legenda">
            <span><i style={{ background: 'var(--ok)' }} />No ritmo</span>
            <span><i style={{ background: 'var(--atencao)' }} />Atenção</span>
            <span><i style={{ background: 'var(--risco)' }} />Abaixo do ritmo</span>
            <span><i className="marca-leg" />Onde deveria estar hoje</span>
          </div>

          {!secoes.length && (
            <div className="vazio" style={{ marginTop: 20 }}>
              <h2>Sem metas neste período</h2>
              <p>As metas de {canal.nome} ainda não foram lançadas.</p>
              {podeEditar(perfil) && <Link className="btn" href={`/metas?p=${periodo.id}`}>Lançar metas</Link>}
            </div>
          )}

          {secoes.map(({ grupo, linhas }) => (
            <section key={grupo.id} className={grupo.nivel ? `recuo-${Math.min(grupo.nivel, 3)}` : ''}>
              <div className="grupo-cab">
                <h2>{grupo.nome}</h2>
                <span className="tag">{an.colabsAtivosSub(grupo.id)} colaboradores</span>
                <Link href={`/grupos/${grupo.id}?p=${periodo.id}`}>Ver semanas e colaboradores</Link>
              </div>
              <div className="tabela-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Produto</th><th>Meta</th><th>Realizado</th><th className="esq">Ritmo</th>
                      <th>Falta</th><th>Falta {fator}</th><th>Por dia útil</th><th>Nesta semana</th><th>Fecha em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l) => (
                      <tr key={l.produto.id}>
                        <td>{l.produto.nome}{an.ehComposto(l.produto.id) && <span className="tag-soma">soma</span>}</td>
                        <td>{l.temMeta ? fmtValor(l.meta, l.produto.unidade) : '—'}</td>
                        <td>
                          {fmtValor(l.realizado, l.produto.unidade)}
                          {an.ehComposto(l.produto.id) && <Composicao compacta itens={an.composicao(grupo.id, l.produto.id)} />}
                        </td>
                        <td className="esq"><BarraRitmo pct={l.pct} esperado={l.esperado} status={l.status} /></td>
                        <td>{l.status === 'batida' ? <span className="tag tag-acento">{STATUS.batida}</span> : fmtValor(l.falta, l.produto.unidade)}</td>
                        <td className="fraco">{fmtValor(l.faltaBruta, l.produto.unidade)}</td>
                        <td>{l.falta > 0 ? fmtValor(l.porDia, l.produto.unidade, 1) : '—'}</td>
                        <td>{l.semanaAtual && l.falta > 0 ? fmtValor(l.semanaAtual.necessario, l.produto.unidade) : '—'}</td>
                        <td className="fraco">{fmtData(l.ciclo.data_fim)}</td>
                      </tr>
                    ))}
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
