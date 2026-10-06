import { redirect } from 'next/navigation';
import { exigirSessao, ehAdmin } from '@/lib/auth';
import Preparador from '@/components/Preparador';

export default async function PaginaPreparador() {
  const { perfil } = await exigirSessao();
  if (!ehAdmin(perfil)) redirect('/');
  return (
    <>
      <div className="topo">
        <div>
          <h1>Preparador de material</h1>
          <p className="sub">Suba a base de clientes, combine filtros e baixe o material pronto em Excel. Só administradores veem esta página.</p>
        </div>
      </div>
      <Preparador />
    </>
  );
}
