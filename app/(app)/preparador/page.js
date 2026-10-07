import { redirect } from 'next/navigation';
import { exigirSessao, ehAdmin } from '@/lib/auth';
import Preparador from '@/components/Preparador';
import { listarEquipes } from '../materiais/dados';

export default async function PaginaPreparador() {
  const { perfil, supabase } = await exigirSessao();
  if (!ehAdmin(perfil)) redirect('/');
  const equipes = await listarEquipes(supabase);
  return (
    <>
      <div className="topo">
        <div>
          <h1>Preparador de material</h1>
          <p className="sub">Suba a base de clientes, combine filtros e baixe o material pronto em Excel. Só administradores veem esta página.</p>
        </div>
      </div>
      <Preparador equipes={equipes} />
    </>
  );
}
