import Link from 'next/link';
import { redirect } from 'next/navigation';
import { exigirSessao, ehAdmin } from '@/lib/auth';
import { fmtData } from '@/lib/formato';
import NovoMaterial from '@/components/NovoMaterial';
import { listarEquipes, ORIGEM } from './dados';

const fmtN = (n) => Number(n || 0).toLocaleString('pt-BR');
const fmtPct = (n) => `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

export default async function PaginaMateriais() {
  const { perfil, supabase } = await exigirSessao();
  if (!ehAdmin(perfil)) redirect('/');
  const [{ data: materiais, error }, equipes] = await Promise.all([
    supabase.from('materiais_resumo').select('*').order('enviado_em', { ascending: false }).order('criado_em', { ascending: false }),
    listarEquipes(supabase),
  ]);
  const nomeEquipe = new Map(equipes.map((g) => [g.id, g.nome]));

  return (
    <>
      <div className="topo">
        <div>
          <h1>Materiais enviados</h1>
          <p className="sub">Bases de leads enviadas para as equipes. Servem para medir quantos leads viraram venda (cruzamento pelo CNPJ). Só administradores cadastram.</p>
        </div>
      </div>

      {error ? (
        <p className="msg msg-erro">Rode o arquivo 022_materiais.sql no Supabase para usar esta tela.</p>
      ) : (
        <>
          <details className="bloco secao recolhivel" open={!materiais?.length}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>+ Registrar material</summary>
            <p className="dica" style={{ margin: '8px 0 12px' }}>
              Suba o Excel/CSV que foi enviado (de qualquer origem) ou cole os CNPJs. Cada material vai para uma equipe; se a base foi dividida
              entre equipes, registre um material para cada parte. Do Preparador, use o botão "Registrar envio" depois de baixar o material.
            </p>
            <NovoMaterial grupos={equipes} />
          </details>

          <section className="secao">
            <div className="tabela-wrap">
              <table>
                <thead>
                  <tr><th>Material</th><th>Enviado em</th><th className="esq">Equipe</th><th className="esq">Origem</th><th>Leads</th><th>Fechamento esperado</th></tr>
                </thead>
                <tbody>
                  {(materiais || []).map((m) => (
                    <tr key={m.id}>
                      <td><Link href={`/materiais/${m.id}`}>{m.nome}</Link>{m.observacao && <span className="nome-sub">{m.observacao}</span>}</td>
                      <td>{fmtData(m.enviado_em, true)}</td>
                      <td className="esq">{nomeEquipe.get(m.grupo_id) || <span className="fraco">—</span>}</td>
                      <td className="esq"><span className="tag">{ORIGEM[m.origem] || m.origem}</span></td>
                      <td>{fmtN(m.leads)}</td>
                      <td>
                        {m.conversao_esperada != null
                          ? <>{fmtPct(m.conversao_esperada)}<span className="nome-sub">≈ {fmtN(Math.round((m.leads * m.conversao_esperada) / 100))} vendas</span></>
                          : <span className="fraco">—</span>}
                      </td>
                    </tr>
                  ))}
                  {!materiais?.length && <tr><td colSpan={6} className="fraco" style={{ textAlign: 'center', padding: 24 }}>Nenhum material registrado ainda.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
