import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirSessao, podeEditar } from '@/lib/auth';
import { carregarEstrutura } from '@/lib/dados';
import { hojeSP } from '@/lib/datas';
import { capitalizar } from '@/lib/nomes';
import FormAcao from '@/components/FormAcao';
import ListaPessoas from '@/components/Pessoas';
import { salvarGrupo, alternarGrupo } from '@/app/actions/dados';

export default async function Equipe({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, perfil } = await exigirSessao();
  const editar = podeEditar(perfil);
  const hoje = hojeSP();
  const est = await carregarEstrutura(supabase);
  const g = est.porId.get(id);
  if (!g) notFound();
  const caminho = est.caminho(id);
  const nomeCompleto = (gid) => est.caminho(gid).map((x) => x.nome).join(' / ');
  const opcoesEquipe = est.achatar(null, 0, true).map((x) => ({ id: x.id, nome: nomeCompleto(x.id) }));
  const situacao = sp.situacao === 'desligados' ? 'desligados' : 'ativos';
  const diretas = est.colaboradores.filter((c) => c.grupo_id === id);
  const lista = diretas.filter((c) => (situacao === 'ativos' ? c.ativo : !c.ativo));
  const filhas = est.filhosDe(id).filter((f) => f.ativo);
  const ativosSub = (gid) => { const ids = new Set(est.subarvore(gid)); return est.colaboradores.filter((c) => c.ativo && ids.has(c.grupo_id)).length; };

  return (
    <>
      <div className="topo">
        <div>
          <p className="dica">
            <Link href="/estrutura">Equipes</Link>
            {caminho.slice(0, -1).map((x) => <span key={x.id}> › <Link href={`/estrutura/${x.id}`}>{x.nome}</Link></span>)}
          </p>
          <h1 style={{ marginTop: 6 }}>{capitalizar(g.nome)}</h1>
          <p className="sub">
            {ativosSub(id)} {ativosSub(id) === 1 ? 'pessoa ativa' : 'pessoas ativas'}{filhas.length ? ', contando as equipes abaixo' : ''}.
            {!g.ativo && <span className="tag tag-risco" style={{ marginLeft: 8 }}>equipe inativa</span>}
          </p>
        </div>
        <div className="linha-acoes">
          {editar && <Link href={`/estrutura/nova-pessoa?equipe=${id}`} className="btn">+ Admitir nesta equipe</Link>}
          <Link href={`/grupos/${id}`} className="btn btn-sec">Ver metas</Link>
        </div>
      </div>

      {sp.criada === '1' && <p className="filtro-ativo">Equipe criada. Agora é só admitir as pessoas dela.</p>}
      {sp.admitidos && <p className="filtro-ativo">{sp.admitidos === '1' ? 'Pessoa cadastrada.' : `${sp.admitidos} pessoas cadastradas.`}</p>}

      {filhas.length > 0 && (
        <section className="secao">
          <h2 style={{ marginBottom: 8 }}>Equipes dentro de {capitalizar(g.nome)}</h2>
          <div className="equipes-grade">
            {filhas.map((f) => (
              <Link key={f.id} href={`/estrutura/${f.id}`} className="equipe-card">
                <strong>{capitalizar(f.nome)}</strong>
                <span className="equipe-numeros"><b>{ativosSub(f.id)}</b> pessoas</span>
                <span className="seta-card">›</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="secao">
        <div className="linha-acoes" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <h2>Pessoas{filhas.length ? ' ligadas direto aqui' : ''}</h2>
          <div className="alternar-visao">
            <Link href={`/estrutura/${id}`} className={situacao === 'ativos' ? 'ativo' : ''}>Ativos ({diretas.filter((c) => c.ativo).length})</Link>
            <Link href={`/estrutura/${id}?situacao=desligados`} className={situacao === 'desligados' ? 'ativo' : ''}>Desligados ({diretas.filter((c) => !c.ativo).length})</Link>
          </div>
        </div>
        {lista.length ? (
          <ListaPessoas pessoas={lista} editar={editar} hoje={hoje} opcoesEquipe={opcoesEquipe} />
        ) : (
          <div className="vazio">
            <p>{situacao === 'ativos' ? (filhas.length ? 'As pessoas estão nas equipes acima.' : 'Ninguém nesta equipe ainda.') : 'Ninguém desligado nesta equipe.'}</p>
            {editar && situacao === 'ativos' && !filhas.length && <Link href={`/estrutura/nova-pessoa?equipe=${id}`} className="btn">+ Admitir a primeira pessoa</Link>}
          </div>
        )}
      </section>

      {editar && (
        <section className="secao">
          <details className="bloco config-equipe">
            <summary>⚙ Configurar a equipe</summary>
            <FormAcao acao={salvarGrupo}>
              <div className="campos" style={{ marginTop: 12 }}>
                <input type="hidden" name="id" value={id} />
                <label className="campo">Nome<input type="text" name="nome" defaultValue={g.nome} required /></label>
                <label className="campo">Fica dentro de
                  <select name="parent_id" defaultValue={g.parent_id || ''}>
                    <option value="">Nenhum (é um canal)</option>
                    {opcoesEquipe.filter((o) => o.id !== id && !est.subarvore(id).includes(o.id)).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </select>
                </label>
                <label className="campo">Ordem na lista<input type="number" name="ordem" defaultValue={g.ordem} style={{ width: 80 }} /></label>
                <button className="btn" type="submit">Salvar</button>
              </div>
            </FormAcao>
            <div className="linha-acoes" style={{ marginTop: 14 }}>
              <Link href={`/estrutura/nova-equipe?dentro=${id}`} className="btn btn-sec btn-peq">+ Criar equipe dentro desta</Link>
              <FormAcao acao={alternarGrupo} confirmar={g.ativo ? `Inativar ${g.nome}? Ela some do painel, mas o histórico fica guardado.` : undefined}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="ativar" value={g.ativo ? '0' : '1'} />
                <button className={g.ativo ? 'btn btn-perigo btn-peq' : 'btn btn-sec btn-peq'} type="submit">{g.ativo ? 'Inativar equipe' : 'Reativar equipe'}</button>
              </FormAcao>
            </div>
          </details>
        </section>
      )}
    </>
  );
}
