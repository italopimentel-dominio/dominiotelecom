import Link from 'next/link';
import { redirect } from 'next/navigation';
import { exigirSessao, podeEditar } from '@/lib/auth';
import { carregarEstrutura } from '@/lib/dados';
import { hojeSP } from '@/lib/datas';
import FormAcao from '@/components/FormAcao';
import { CampoCota } from '@/components/Pessoas';
import { criarColaborador } from '@/app/actions/dados';

export default async function NovaPessoa({ searchParams }) {
  const sp = await searchParams;
  const { supabase, perfil } = await exigirSessao();
  if (!podeEditar(perfil)) redirect('/estrutura');
  const est = await carregarEstrutura(supabase);
  const opcoes = est.achatar(null, 0, true).map((g) => ({ id: g.id, nome: est.caminho(g.id).map((x) => x.nome).join(' / ') }));
  const equipe = opcoes.some((o) => o.id === sp.equipe) ? sp.equipe : '';
  return (
    <>
      <div className="topo">
        <div>
          <p className="dica"><Link href="/estrutura">Equipes</Link>{equipe && <> › <Link href={`/estrutura/${equipe}`}>voltar para a equipe</Link></>}</p>
          <h1 style={{ marginTop: 6 }}>Cadastrar pessoa</h1>
          <p className="sub">Preencha os dados de admissão. A meta da equipe é redividida automaticamente.</p>
        </div>
      </div>
      <div className="bloco form-pagina">
        <FormAcao acao={criarColaborador}>
          <input type="hidden" name="abrir" value="1" />
          <label className="campo">Nome completo
            <textarea name="nome" rows={3} required placeholder="Para cadastrar várias pessoas da mesma equipe, coloque um nome por linha" />
          </label>
          <label className="campo">Equipe
            <select name="grupo_id" required defaultValue={equipe}>
              <option value="" disabled>Escolha a equipe</option>
              {opcoes.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </label>
          <div className="campos">
            <label className="campo">Data de admissão<input type="date" name="data_admissao" defaultValue={hojeSP()} required /></label>
            <CampoCota valor={1} />
          </div>
          <p className="dica">Quem entra no meio do mês recebe a meta proporcional aos dias úteis automaticamente. "Meia cota" é só para casos especiais, como meio período.</p>
          <div className="linha-acoes">
            <button className="btn" type="submit">Cadastrar</button>
            <Link href={equipe ? `/estrutura/${equipe}` : '/estrutura'} className="dica">Cancelar</Link>
          </div>
        </FormAcao>
      </div>
    </>
  );
}
