import { cookies } from 'next/headers';
import { exigirSessao, ehAdmin, podeEditar, podeVerIndireto, NOME_PAPEL } from '@/lib/auth';
import MenuLateral from '@/components/MenuLateral';
import { sair } from '@/app/actions/auth';

export const dynamic = 'force-dynamic';

export default async function LayoutApp({ children }) {
  const { perfil } = await exigirSessao();
  const cookieStore = await cookies();

  const metas = [
    { href: '/resumo', rotulo: 'Resumo da empresa', icone: 'resumo' },
    { href: '/', rotulo: 'Painel', icone: 'painel' },
    { href: '/metas', rotulo: 'Quadro de metas', icone: 'quadro' },
  ];
  if (podeEditar(perfil)) metas.push({ href: '/importar', rotulo: 'Importar resultados', icone: 'importar' });
  metas.push({ href: '/headcount', rotulo: 'Headcount', icone: 'headcount' });

  const cadastros = [
    { href: '/estrutura', rotulo: 'Equipes e colaboradores', icone: 'equipes' },
    { href: '/produtos', rotulo: 'Produtos', icone: 'produtos' },
    { href: '/periodos', rotulo: 'Períodos e fechamentos', icone: 'periodos' },
    { href: '/feriados', rotulo: 'Feriados', icone: 'feriados' },
  ];
  if (ehAdmin(perfil)) cadastros.push({ href: '/usuarios', rotulo: 'Usuários', icone: 'usuarios' });

  const menu = [
    { rotulo: 'Metas', icone: 'metas', itens: metas, aberto: true },
    { href: '/campanhas', rotulo: 'Campanhas', icone: 'campanhas' },
    { href: '/organograma', rotulo: 'Organograma', icone: 'organograma' },
  ];
  if (podeVerIndireto(perfil)) menu.push({ href: '/indireto', rotulo: 'Controle Indireto', icone: 'indireto' });
  if (ehAdmin(perfil)) menu.push({ href: '/preparador', rotulo: 'Preparador de material', icone: 'preparador' });
  menu.push({ rotulo: 'Cadastros', icone: 'cadastros', itens: cadastros });

  return (
    <div className="app">
      <MenuLateral
        menu={menu}
        perfil={{ nome: perfil.nome || perfil.usuario, papel: `${NOME_PAPEL[perfil.papel]}${podeEditar(perfil) ? '' : ' (só leitura)'}` }}
        recolhidoInicial={cookieStore.get('menu_recolhido')?.value === '1'}
        sair={sair}
      />
      <main className="conteudo">{children}</main>
    </div>
  );
}
