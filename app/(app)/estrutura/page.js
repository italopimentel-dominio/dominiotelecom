import Link from 'next/link';
import { exigirSessao, podeEditar } from '@/lib/auth';
import { carregarEstrutura } from '@/lib/dados';
import { hojeSP } from '@/lib/datas';
import { normalizar, capitalizar } from '@/lib/nomes';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export default async function Equipes({ searchParams }) {
  const sp = await searchParams;
  const { supabase, perfil } = await exigirSessao();
  const editar = podeEditar(perfil);
  const mes = hojeSP().slice(0, 7);
  const est = await carregarEstrutura(supabase);
  const verInativas = sp.inativas === '1';
  const pessoasDe = (gid) => { const ids = new Set(est.subarvore(gid)); return est.colaboradores.filter((c) => ids.has(c.grupo_id)); };
  const contagem = (gid) => {
    const l = pessoasDe(gid);
    return {
      ativos: l.filter((c) => c.ativo).length,
      entrou: l.filter((c) => (c.data_admissao || '').startsWith(mes)).length,
      saiu: l.filter((c) => (c.data_desligamento || '').startsWith(mes)).length,
    };
  };
  const geral = { ativos: est.colaboradores.filter((c) => c.ativo).length, entrou: est.colaboradores.filter((c) => (c.data_admissao || '').startsWith(mes)).length, saiu: est.colaboradores.filter((c) => (c.data_desligamento || '').startsWith(mes)).length };
  const nomeMes = MESES[Number(mes.slice(5)) - 1];
  const canais = est.raizes.filter((g) => verInativas || g.ativo);
  const busca = normalizar(sp.q || '');
  const achados = busca ? est.colaboradores.filter((c) => normalizar(c.nome).includes(busca)) : [];
  const caminho = (id) => est.caminho(id).map((g) => g.nome);

  return (
    <>
      <div className="topo">
        <div>
          <h1>Equipes e colaboradores</h1>
          <p className="sub">Clique numa equipe para ver as pessoas e as configurações dela.</p>
        </div>
        {editar && (
          <div className="linha-acoes">
            <Link href="/estrutura/nova-pessoa" className="btn">+ Cadastrar pessoa</Link>
            <Link href="/estrutura/nova-equipe" className="btn btn-sec">+ Nova equipe</Link>
          </div>
        )}
      </div>

      <div className="hc-cartoes pessoas-cartoes">
        <div className="hc-cartao"><span>Ativos hoje</span><b>{geral.ativos}</b></div>
        <div className="hc-cartao hc-mais"><span>Admitidos em {nomeMes}</span><b>+{geral.entrou}</b></div>
        <div className="hc-cartao hc-menos"><span>Desligados em {nomeMes}</span><b>−{geral.saiu}</b></div>
      </div>

      <form method="get" className="filtro-pessoas">
        <input type="text" name="q" defaultValue={sp.q || ''} placeholder="Procurar uma pessoa pelo nome" aria-label="Procurar uma pessoa" />
        <button className="btn btn-sec" type="submit">Procurar</button>
        {sp.q && <Link href="/estrutura" className="dica">Limpar</Link>}
        <Link href={verInativas ? '/estrutura' : '/estrutura?inativas=1'} className="dica" style={{ marginLeft: 'auto' }}>{verInativas ? 'Esconder equipes inativas' : 'Mostrar equipes inativas'}</Link>
      </form>

      {busca && (
        <section className="secao">
          <h2 style={{ marginBottom: 8 }}>{achados.length ? `${achados.length} ${achados.length === 1 ? 'pessoa encontrada' : 'pessoas encontradas'}` : 'Ninguém encontrado'}</h2>
          {achados.length > 0 && (
            <ul className="pessoas-lista">
              {achados.slice(0, 30).map((c) => (
                <li key={c.id} className={c.ativo ? '' : 'desligado'}>
                  <Link href={`/estrutura/${c.grupo_id}?situacao=${c.ativo ? 'ativos' : 'desligados'}`} className="pessoa-linha pessoa-link">
                    <span className="pessoa-avatar">{c.nome.trim().charAt(0).toUpperCase()}</span>
                    <span className="pessoa-info"><strong>{capitalizar(c.nome)}</strong><span>{caminho(c.grupo_id).join(' › ')}{!c.ativo && ', desligado'}</span></span>
                    <span className="seta-card">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {canais.map((canal) => {
        const equipes = est.achatar(canal.id, 1, !verInativas);
        const cc = contagem(canal.id);
        return (
          <section key={canal.id} className="secao">
            <Link href={`/estrutura/${canal.id}`} className="canal-cab">
              <h2>{canal.nome}</h2>
              <span className="tag">{cc.ativos} ativos</span>
              {!canal.ativo && <span className="tag tag-risco">inativo</span>}
              <span className="seta-card">›</span>
            </Link>
            {equipes.length > 0 ? (
              <div className="equipes-grade">
                {equipes.map((g) => {
                  const c = contagem(g.id);
                  const acima = caminho(g.id).slice(1, -1);
                  return (
                    <Link key={g.id} href={`/estrutura/${g.id}`} className={`equipe-card${g.ativo ? '' : ' inativa'}`}>
                      {acima.length > 0 && <span className="equipe-acima">{acima.join(' › ')}</span>}
                      <strong>{capitalizar(g.nome)}</strong>
                      <span className="equipe-numeros">
                        <b>{c.ativos}</b> {c.ativos === 1 ? 'pessoa' : 'pessoas'}
                        {c.entrou > 0 && <em className="txt-ok">+{c.entrou}</em>}
                        {c.saiu > 0 && <em className="txt-risco">−{c.saiu}</em>}
                      </span>
                      <span className="seta-card">›</span>
                    </Link>
                  );
                })}
              </div>
            ) : <p className="dica">Sem equipes abaixo. Clique no canal para ver as pessoas dele.</p>}
          </section>
        );
      })}
    </>
  );
}
