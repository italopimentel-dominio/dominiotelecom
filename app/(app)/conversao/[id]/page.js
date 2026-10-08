import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirSessao, ehAdmin } from '@/lib/auth';
import { hojeSP } from '@/lib/datas';
import { fmtData } from '@/lib/formato';
import { carregarConversao, fmtN, fmtPct, fmtBRL, fmtDoc } from '../dados';
import Comparativo from '../Comparativo';

const fmtMes = (m) => `${m.slice(5)}/${m.slice(2, 4)}`;

export default async function ConversaoMaterial({ params }) {
  const { id } = await params;
  const { perfil, supabase } = await exigirSessao();
  const r = await carregarConversao(supabase, hojeSP(), id);
  if (r.erro) return <p className="msg msg-erro">{r.erro}</p>;
  const m = r.materiais[0];
  if (!m) notFound();

  const { data: dests } = await supabase.from('material_leads').select('cnpj, destinatario').eq('material_id', id).in('cnpj', [...new Set(m.vendas.map((v) => v.cnpj))].slice(0, 1000));
  const destinatario = new Map((dests || []).map((d) => [d.cnpj, d.destinatario]));

  const porProduto = [...m.vendas.reduce((acc, v) => {
    const p = acc.get(v.produto) || { produto: v.produto, cnpjs: new Set(), qtd: 0, valor: 0 };
    p.cnpjs.add(v.cnpj); p.qtd += v.qtd; p.valor += v.valor;
    return acc.set(v.produto, p);
  }, new Map()).values()].sort((a, b) => b.qtd - a.qtd);
  const vendas = [...m.vendas].sort((a, b) => a.mes.localeCompare(b.mes) || a.cnpj.localeCompare(b.cnpj));

  return (
    <>
      <div className="topo">
        <div>
          <p className="sub"><Link href="/conversao">← Conversão de materiais</Link></p>
          <h1>{m.nome}</h1>
          <p className="sub">
            {m.nomeEquipe} · foco: {m.foco} · enviado em {fmtData(m.enviado_em, true)} · {m.andamento ? `janela de 30 dias até ${fmtData(m.prazo, true)}` : 'janela de 30 dias encerrada'}
            {m.observacao ? ` · ${m.observacao}` : ''}
          </p>
        </div>
        {ehAdmin(perfil) && <Link className="btn btn-sec" href={`/materiais/${m.id}`}>Editar material</Link>}
      </div>

      <div className="calendario" style={{ marginTop: 0 }}>
        <div><b>{fmtN(m.leads)}</b><span>leads enviados</span></div>
        <div><b>{fmtN(m.convertidos)}</b><span>compraram{m.esperadosLeads != null ? ` · esperado ≈ ${fmtN(Math.round(m.esperadosLeads))}` : ''}</span></div>
        <div style={{ minWidth: 240 }}><Comparativo pct={m.pct} esperada={m.esperada} andamento={m.andamento} /></div>
        <div><b>{fmtN(m.convertidosPropria)}</b><span>vendidos pela própria equipe ({fmtN(m.convertidos - m.convertidosPropria)} por outras)</span></div>
        <div><b>{fmtN(m.qtd)}</b><span>vendas ({fmtBRL(m.valor)})</span></div>
      </div>

      {porProduto.length > 0 && (
        <section className="secao">
          <h2 style={{ marginBottom: 8 }}>Por produto</h2>
          <div className="tabela-wrap">
            <table>
              <thead><tr><th>Produto</th><th>Clientes</th><th>% dos leads</th><th>Quantidade</th><th>Valor</th></tr></thead>
              <tbody>
                {porProduto.map((p) => (
                  <tr key={p.produto}><td>{p.produto}</td><td>{fmtN(p.cnpjs.size)}</td><td>{fmtPct(m.leads ? (p.cnpjs.size / m.leads) * 100 : null)}</td><td>{fmtN(p.qtd)}</td><td>{fmtBRL(p.valor)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="secao">
        <h2 style={{ marginBottom: 8 }}>Clientes que compraram</h2>
        <div className="tabela-wrap tabela-fixa">
          <table>
            <thead><tr><th className="esq">CNPJ/CPF</th><th className="esq">Recebido por</th><th>Mês</th><th className="esq">Produto</th><th className="esq">Quem vendeu</th><th className="esq">Equipe de quem vendeu</th><th>Qtd</th><th>Valor</th></tr></thead>
            <tbody>
              {vendas.map((v, i) => (
                <tr key={i}>
                  <td className="esq">{fmtDoc(v.cnpj)}</td>
                  <td className="esq">{destinatario.get(v.cnpj) || <span className="fraco">—</span>}</td>
                  <td>{fmtMes(v.mes)}{v.mesmo_mes && <span className="nome-sub" title="Venda no mesmo mês do envio: pode ter acontecido antes dele">mesmo mês</span>}</td>
                  <td className="esq">{v.produto}</td>
                  <td className="esq">{v.consultor}</td>
                  <td className="esq">
                    {v.nomeEquipeVendedor || <span className="fraco">não identificada</span>}
                    {' '}<span className={`tag ${v.propria ? 'tag-ok' : ''}`}>{v.propria ? 'própria equipe' : 'outra equipe'}</span>
                  </td>
                  <td>{fmtN(v.qtd)}</td>
                  <td>{fmtBRL(v.valor)}</td>
                </tr>
              ))}
              {!vendas.length && <tr><td colSpan={8} className="fraco" style={{ textAlign: 'center', padding: 24 }}>Nenhuma venda encontrada para os CNPJs deste material na janela de 30 dias.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
