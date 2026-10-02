import { cookies } from 'next/headers';
import { exigirSessao, ehAdmin, podeEditar, podeVerIndireto, NOME_PAPEL } from '@/lib/auth';
import MenuLateral from '@/components/MenuLateral';
import { sair } from '@/app/actions/auth';

export const dynamic = 'force-dynamic';

export default async function LayoutApp({ children }) {
  const { perfil } = await exigirSessao();
  const cookieStore = await cookies();

  const principais = [
    { href: '/', rotulo: 'Painel', icone: 'painel' },
    { href: '/metas', rotulo: 'Metas', icone: 'metas' },
  ];
  if (podeEditar(perfil)) principais.push({ href: '/importar', rotulo: 'Importar resultados', icone: 'importar' });
  if (podeVerIndireto(perfil)) principais.push({ href: '/indireto', rotulo: 'Controle Indireto', icone: 'indireto' });

  const cadastros = [
    { href: '/estrutura', rotulo: 'Equipes e colaboradores', icone: 'equipes' },
    { href: '/produtos', rotulo: 'Produtos', icone: 'produtos' },
    { href: '/periodos', rotulo: 'Períodos e fechamentos', icone: 'periodos' },
    { href: '/feriados', rotulo: 'Feriados', icone: 'feriados' },
  ];
  if (ehAdmin(perfil)) cadastros.push({ href: '/usuarios', rotulo: 'Usuários', icone: 'usuarios' });

  return (
    <div className="app">
      <MenuLateral
        principais={principais}
        cadastros={cadastros}
        perfil={{ nome: perfil.nome || perfil.usuario, papel: `${NOME_PAPEL[perfil.papel]}${podeEditar(perfil) ? '' : ' (só leitura)'}` }}
        recolhidoInicial={cookieStore.get('menu_recolhido')?.value === '1'}
        sair={sair}
      />
      <main className="conteudo">{children}</main>
    </div>
  );
}
