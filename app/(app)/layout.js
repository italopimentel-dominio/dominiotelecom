import { exigirSessao, ehAdmin, podeEditar, NOME_PAPEL } from '@/lib/auth';
import Navegacao from '@/components/Navegacao';
import { sair } from '@/app/actions/auth';

export const dynamic = 'force-dynamic';

export default async function LayoutApp({ children }) {
  const { perfil } = await exigirSessao();
  const itens = [
    { href: '/', rotulo: 'Painel' },
    { href: '/metas', rotulo: 'Metas' },
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
