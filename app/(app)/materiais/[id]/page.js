import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { exigirSessao, ehAdmin } from '@/lib/auth';
import FormAcao from '@/components/FormAcao';
import NovoMaterial from '@/components/NovoMaterial';
import { salvarMaterial, excluirMaterial } from '@/app/actions/materiais';
import { listarEquipes, listarProdutos, ORIGEM } from '../dados';

const fmtN = (n) => Number(n || 0).toLocaleString('pt-BR');
const fmtPct = (n) => `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
const fmtDoc = (d) => (d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4'));

export default async function PaginaMaterial({ params }) {
  const { id } = await params;
  const { perfil, supabase } = await exigirSessao();
  if (!ehAdmin(perfil)) redirect('/');
  const [{ data: m }, equipes, { data: amostra }, { count }, produtos] = await Promise.all([
    supabase.from('materiais').select('*').eq('id', id).maybeSingle(),
    listarEquipes(supabase),
    supabase.from('material_leads').select('cnpj, destinatario').eq('material_id', id).order('id').limit(50),
    supabase.from('material_leads').select('id', { count: 'exact', head: true }).eq('material_id', id),
    listarProdutos(supabase),
  ]);
  if (!m) notFound();

  return (
    <>
      <div className="topo">
        <div>
          <p className="sub"><Link href="/materiais">← Materiais enviados</Link></p>
          <h1>{m.nome}</h1>
          <p className="sub">
            {fmtN(count)} leads · origem: {ORIGEM[m.origem] || m.origem}
            {m.conversao_esperada != null && <> · fechamento esperado: {fmtPct(m.conversao_esperada)} (≈ {fmtN(Math.round((count * m.conversao_esperada) / 100))} vendas)</>}
          </p>
        </div>
        <Link className="btn btn-sec" href={`/conversao/${m.id}`}>Ver conversão</Link>
      </div>

      <section className="bloco secao">
        <h2 style={{ marginBottom: 8 }}>Dados do material</h2>
        <FormAcao acao={salvarMaterial}>
          <input type="hidden" name="id" value={m.id} />
          <div className="campos">
            <label className="campo" style={{ flex: '2 1 260px' }}>Nome<input type="text" name="nome" defaultValue={m.nome} required /></label>
            <label className="campo">Data de envio<input type="date" name="enviado_em" defaultValue={m.enviado_em} required /></label>
            <label className="campo" style={{ flex: '2 1 240px' }}>Equipe que recebeu
              <select name="grupo_id" defaultValue={m.grupo_id || ''} required>
                <option value="">Escolha…</option>
                {equipes.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </select>
            </label>
            <label className="campo">% de fechamento esperado
              <input type="text" inputMode="decimal" name="conversao_esperada" defaultValue={m.conversao_esperada ?? ''} placeholder="ex.: 2,5" style={{ width: 110 }} />
            </label>
            <label className="campo" style={{ flex: '3 1 300px' }}>Observação<input type="text" name="observacao" defaultValue={m.observacao || ''} /></label>
          </div>
          <div className="foco-produtos">
            <span className="dica"><b>Produto foco:</b> marque os produtos que contam para este material. Nenhum marcado = material geral (conta qualquer produto).</span>
            <div className="foco-lista">
              {produtos.map((p) => (
                <label key={p.id} className="check"><input type="checkbox" name="produtos_foco" value={p.id} defaultChecked={(m.produtos_foco || []).includes(p.id)} /> {p.nome}</label>
              ))}
            </div>
          </div>
          <button className="btn" type="submit" style={{ marginTop: 10 }}>Salvar</button>
        </FormAcao>
      </section>

      <details className="bloco secao recolhivel">
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>+ Adicionar leads a este material</summary>
        <div style={{ marginTop: 10 }}><NovoMaterial grupos={equipes} produtos={produtos} materialId={m.id} /></div>
      </details>

      <section className="secao">
        <h2 style={{ marginBottom: 8 }}>Leads {count > 50 && <span className="dica">(primeiros 50 de {fmtN(count)})</span>}</h2>
        <div className="tabela-wrap">
          <table>
            <thead><tr><th className="esq">CNPJ/CPF</th><th className="esq">Destinatário</th></tr></thead>
            <tbody>
              {(amostra || []).map((l) => <tr key={l.cnpj}><td className="esq">{fmtDoc(l.cnpj)}</td><td className="esq">{l.destinatario || <span className="fraco">—</span>}</td></tr>)}
              {!amostra?.length && <tr><td colSpan={2} className="fraco" style={{ textAlign: 'center', padding: 24 }}>Nenhum lead.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="secao">
        <FormAcao acao={excluirMaterial} confirmar={`Excluir o material "${m.nome}" e os ${fmtN(count)} leads dele? Isso não pode ser desfeito.`}>
          <input type="hidden" name="id" value={m.id} />
          <button className="btn btn-perigo" type="submit">Excluir material</button>
        </FormAcao>
      </section>
    </>
  );
}
