import { cookies } from 'next/headers';
import { exigirSessao, ehAdmin, podeEditar, podeVerIndireto, NOME_PAPEL } from '@/lib/auth';
import MenuLateral from '@/components/MenuLateral';
import { sair } from '@/app/actions/auth';

export const dynamic = 'force-dynamic';

export default async function LayoutApp({ children }) {
  const { perfil } = await exigirSessao();
  const cookieStore = await cookies();

  const editor = podeEditar(perfil);
  const admin = ehAdmin(perfil);

  const metas = [
    { href: '/resumo', rotulo: 'Resumo da empresa', icone: 'resumo' },
    { href: '/', rotulo: 'Painel', icone: 'painel' },
    { href: '/metas', rotulo: 'Quadro de metas', icone: 'quadro' },
    { href: '/headcount', rotulo: 'Headcount', icone: 'headcount' },
  ];

  const materiais = [];
  if (admin) materiais.push({ href: '/preparador', rotulo: 'Preparador de material', icone: 'preparador' });
  if (admin) materiais.push({ href: '/materiais', rotulo: 'Materiais enviados', icone: 'materiais' });

  // Configurações: títulos de seção só aparecem se a pessoa tiver algum item daquela seção
  const configuracoes = [];
  const secao = (titulo, itens) => { if (itens.length) configuracoes.push({ secao: titulo }, ...itens); };
  secao('Dados', editor ? [
    { href: '/fontes', rotulo: 'Fonte de dados', icone: 'fonte' },
    { href: '/importar', rotulo: 'Importar resultados', icone: 'importar' },
  ] : []);
  secao('Pessoas', [
    { href: '/estrutura', rotulo: 'Equipes e colaboradores', icone: 'equipes' },
    ...(admin ? [{ href: '/usuarios', rotulo: 'Usuários', icone: 'usuarios' }] : []),
  ]);
  secao('Calendário', [
    { href: '/periodos', rotulo: 'Períodos e fechamentos', icone: 'periodos' },
    { href: '/feriados', rotulo: 'Feriados', icone: 'feriados' },
  ]);
  secao('Catálogo', [{ href: '/produtos', rotulo: 'Produtos', icone: 'produtos' }]);

  const menu = [
    { rotulo: 'Metas', icone: 'metas', itens: metas, aberto: true },
    { href: '/campanhas', rotulo: 'Campanhas', icone: 'campanhas' },
    { href: '/organograma', rotulo: 'Organograma', icone: 'organograma' },
  ];
  if (podeVerIndireto(perfil)) menu.push({ href: '/indireto', rotulo: 'Controle Indireto', icone: 'indireto' });
  if (materiais.length) menu.push({ rotulo: 'Materiais', icone: 'materiais', itens: materiais });
  menu.push({ rotulo: 'Configurações', icone: 'cadastros', itens: configuracoes });

  return (
    <div className="app">
      <MenuLateral
        menu={menu}
        perfil={{ nome: perfil.nome || perfil.usuario, papel: `${NOME_PAPEL[perfil.papel]}${editor ? '' : ' (só leitura)'}` }}
        recolhidoInicial={cookieStore.get('menu_recolhido')?.value === '1'}
        sair={sair}
      />
      <main className="conteudo">{children}</main>
    </div>
  );
}
