import Link from 'next/link';
import { redirect } from 'next/navigation';
import { exigirSessao, podeEditar } from '@/lib/auth';
import { carregarEstrutura } from '@/lib/dados';
import FormAcao from '@/components/FormAcao';
import { criarGrupo } from '@/app/actions/dados';

export default async function NovaEquipe({ searchParams }) {
  const sp = await searchParams;
  const { supabase, perfil } = await exigirSessao();
  if (!podeEditar(perfil)) redirect('/estrutura');
  const est = await carregarEstrutura(supabase);
  const opcoes = est.achatar(null, 0, true).map((g) => ({ id: g.id, nome: est.caminho(g.id).map((x) => x.nome).join(' / ') }));
  const dentro = opcoes.some((o) => o.id === sp.dentro) ? sp.dentro : '';
  return (
    <>
      <div className="topo">
        <div>
          <p className="dica"><Link href="/estrutura">Equipes</Link></p>
          <h1 style={{ marginTop: 6 }}>Nova equipe</h1>
          <p className="sub">Canal (ex.: Televendas), unidade (ex.: Campinas) ou equipe de um supervisor. Depois de criar, você já cadastra as pessoas dela.</p>
        </div>
      </div>
      <div className="bloco form-pagina">
        <FormAcao acao={criarGrupo}>
          <input type="hidden" name="abrir" value="1" />
          <label className="campo">Nome da equipe<input type="text" name="nome" required placeholder="ex.: Equipe Hunter" /></label>
          <label className="campo">Fica dentro de
            <select name="parent_id" defaultValue={dentro}>
              <option value="">Nenhuma (é um canal novo)</option>
              {opcoes.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </label>
          <p className="dica">A meta de quem fica "dentro" soma na equipe de cima automaticamente.</p>
          <div className="linha-acoes">
            <button className="btn" type="submit">Criar equipe</button>
            <Link href="/estrutura" className="dica">Cancelar</Link>
          </div>
        </FormAcao>
      </div>
    </>
  );
}
