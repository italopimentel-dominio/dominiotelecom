import Link from 'next/link';
import { exigirSessao, ehAdmin } from '@/lib/auth';
import { hojeSP } from '@/lib/datas';
import { fmtData } from '@/lib/formato';
import { carregarConversao, somar, fmtN, fmtPct, fmtBRL } from './dados';
import Comparativo from './Comparativo';

export default async function PaginaConversao({ searchParams }) {
  const sp = await searchParams;
  const { perfil, supabase } = await exigirSessao();
  const hoje = hojeSP();
  const r = await carregarConversao(supabase, hoje);
  if (r.erro) return <><div className="topo"><h1>Conversão de materiais</h1></div><p className="msg msg-erro">{r.erro}</p></>;

  const equipes = [...new Map(r.materiais.filter((m) => m.grupo_id).map((m) => [m.grupo_id, m.nomeEquipe])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const lista = r.materiais.filter((m) => {
    if (sp.equipe && m.grupo_id !== sp.equipe) return false;
    if (sp.mes && !String(m.enviado_em).startsWith(sp.mes)) return false;
    if (sp.sit === 'andamento' && !m.andamento) return false;
    if (sp.sit === 'encerrado' && m.andamento) return false;
    return true;
  });
  const total = somar(lista);
  const porEquipe = equipes
    .map(([id, nome]) => ({ id, nome, ...somar(lista.filter((m) => m.grupo_id === id)) }))
    .filter((e) => e.materiais > 0)
    .sort((a, b) => b.leads - a.leads);

  return (
    <>
      <div className="topo">
        <div>
          <h1>Conversão de materiais</h1>
          <p className="sub">
            Quantos leads de cada material viraram venda em até 30 dias do envio (cruzamento pelo CNPJ), contra o % de fechamento esperado.
            Vale qualquer vendedor; o detalhe mostra quem vendeu.
          </p>
        </div>
        {ehAdmin(perfil) && <Link className="btn btn-sec" href="/materiais">Cadastrar materiais</Link>}
      </div>

      <div className="calendario" style={{ marginTop: 0 }}>
        <div><b>{fmtN(total.leads)}</b><span>leads enviados ({fmtN(total.materiais)} materiais)</span></div>
        <div><b>{fmtN(total.convertidos)}</b><span>leads que compraram</span></div>
        <div><b>{fmtPct(total.pct)}</b><span>conversão real{total.esperada != null ? ` · esperado ${fmtPct(total.esperada)}` : ''}</span></div>
        <div><b>{fmtN(total.qtd)}</b><span>vendas ({fmtBRL(total.valor)})</span></div>
      </div>

      <form className="bloco campos" style={{ margin: '14px 0', alignItems: 'flex-end' }} method="get">
        <>
          <label className="campo">Equipe
            <select name="equipe" defaultValue={sp.equipe || ''}>
              <option value="">Todas</option>
              {equipes.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </select>
          </label>
          <label className="campo">Mês de envio<input type="month" name="mes" defaultValue={sp.mes || ''} /></label>
          <label className="campo">Janela de 30 dias
            <select name="sit" defaultValue={sp.sit || ''}>
              <option value="">Todas</option>
              <option value="andamento">Em andamento</option>
              <option value="encerrado">Encerrada</option>
            </select>
          </label>
          <button className="btn btn-sec" type="submit">Filtrar</button>
          {(sp.equipe || sp.mes || sp.sit) && <Link href="/conversao" className="dica">Limpar</Link>}
        </>
      </form>

      {!r.materiais.length ? (
        <p className="dica secao">Nenhum material registrado ainda. {ehAdmin(perfil) ? <Link href="/materiais">Registre o primeiro em Materiais enviados.</Link> : 'Assim que um administrador registrar, os números aparecem aqui.'}</p>
      ) : (
        <>
          <section className="secao">
            <h2 style={{ marginBottom: 8 }}>Por equipe</h2>
            <div className="tabela-wrap">
              <table>
                <thead><tr><th>Equipe</th><th>Materiais</th><th>Leads</th><th>Compraram</th><th className="esq" style={{ minWidth: 220 }}>Conversão</th><th>Vendidos pela própria equipe</th><th>Vendas</th></tr></thead>
                <tbody>
                  {porEquipe.map((e) => (
                    <tr key={e.id}>
                      <td><Link href={`/conversao?equipe=${e.id}${sp.mes ? `&mes=${sp.mes}` : ''}`}>{e.nome}</Link></td>
                      <td>{fmtN(e.materiais)}</td>
                      <td>{fmtN(e.leads)}</td>
                      <td>{fmtN(e.convertidos)}</td>
                      <td className="esq"><Comparativo pct={e.pct} esperada={e.esperada} andamento={e.andamento} /></td>
                      <td>{e.convertidos ? `${fmtN(e.convertidosPropria)} de ${fmtN(e.convertidos)}` : '—'}</td>
                      <td>{fmtN(e.qtd)}<span className="nome-sub">{fmtBRL(e.valor)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="secao">
            <h2 style={{ marginBottom: 8 }}>Por material</h2>
            <div className="tabela-wrap">
              <table>
                <thead><tr><th>Material</th><th>Enviado</th><th className="esq">Equipe</th><th>Leads</th><th>Compraram</th><th className="esq" style={{ minWidth: 220 }}>Conversão</th><th>Vendas</th></tr></thead>
                <tbody>
                  {lista.map((m) => (
                    <tr key={m.id}>
                      <td><Link href={`/conversao/${m.id}`}>{m.nome}</Link><span className="nome-sub">foco: {m.foco}</span></td>
                      <td>{fmtData(m.enviado_em, true)}<span className="nome-sub">{m.andamento ? `janela até ${fmtData(m.prazo, true)}` : 'janela encerrada'}</span></td>
                      <td className="esq">{m.nomeEquipe}</td>
                      <td>{fmtN(m.leads)}</td>
                      <td>{fmtN(m.convertidos)}</td>
                      <td className="esq"><Comparativo pct={m.pct} esperada={m.esperada} andamento={m.andamento} /></td>
                      <td>{fmtN(m.qtd)}<span className="nome-sub">{fmtBRL(m.valor)}</span></td>
                    </tr>
                  ))}
                  {!lista.length && <tr><td colSpan={7} className="fraco" style={{ textAlign: 'center', padding: 24 }}>Nenhum material com esses filtros.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
          <p className="dica">
            As planilhas de vendas trazem só o mês da venda: conta a venda do mês do envio até o mês em que terminam os 30 dias.
            Vendas do mesmo mês do envio aparecem marcadas no detalhe (podem ter acontecido antes do envio).
          </p>
        </>
      )}
    </>
  );
}
