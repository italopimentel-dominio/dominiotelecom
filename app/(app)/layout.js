import { exigirSessao, ehAdmin, podeEditar, NOME_PAPEL } from '@/lib/auth';
import Navegacao from '@/components/Navegacao';
import ArvoreMenu from '@/components/ArvoreMenu';
import { sair } from '@/app/actions/auth';

export const dynamic = 'force-dynamic';

export default async function LayoutApp({ children }) {
  const { supabase, perfil } = await exigirSessao();
  const [{ data: grupos }, { data: colaboradores }] = await Promise.all([
    supabase.from('grupos').select('id, parent_id, nome').eq('ativo', true).order('ordem').order('nome'),
    supabase.from('colaboradores').select('id, nome, grupo_id').eq('ativo', true).order('nome'),
  ]);
  const itens = [
    { href: '/', rotulo: 'Painel' },
    { href: '/metas', rotulo: 'Metas' },
    ...(podeEditar(perfil) ? [{ href: '/importar', rotulo: 'Importar resultados' }] : []),
    { href: '/estrutura', rotulo: 'Equipes e colaboradores' },
    { href: '/produtos', rotulo: 'Produtos' },
    { href: '/periodos', rotulo: 'Períodos e fechamentos' },
    { href: '/feriados', rotulo: 'Feriados' },
  ];
  if (ehAdmin(perfil)) itens.push({ href: '/usuarios', rotulo: 'Usuários' });
  itens.push({ href: '/conta', rotulo: 'Minha senha' });
  return (
    <div className="app">
      <aside className="lateral">
        <div className="marca">Metas<small>da equipe</small></div>
        <Navegacao itens={itens} />
        <ArvoreMenu grupos={grupos || []} colaboradores={colaboradores || []} />
        <div className="quem">
          <strong>{perfil.nome || perfil.usuario}</strong>
          {NOME_PAPEL[perfil.papel]}{!podeEditar(perfil) && ' (só leitura)'}
          <form action={sair}><button type="submit">Sair</button></form>
        </div>
      </aside>
      <main className="conteudo">{children}</main>
    </div>
  );
}
