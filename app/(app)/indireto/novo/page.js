import Link from 'next/link';
import { redirect } from 'next/navigation';
import { exigirSessao, podeEditarIndireto } from '@/lib/auth';
import FormParceiro from '@/components/FormParceiro';
import { listarFocais, listarStatus } from '../dados';

export default async function NovoParceiro() {
  const { supabase, perfil } = await exigirSessao();
  if (!podeEditarIndireto(perfil)) redirect('/indireto');
  const [focais, statusLista] = await Promise.all([listarFocais(supabase), listarStatus(supabase)]);
  return (
    <>
      <div className="topo">
        <div>
          <p className="dica"><Link href="/indireto">Controle Indireto</Link></p>
          <h1 style={{ marginTop: 6 }}>Novo parceiro</h1>
          <p className="sub">O cadastro vai para validação do gerente. Depois de salvar, você já pode registrar treinamentos e apontamentos.</p>
        </div>
      </div>
      <div className="bloco"><FormParceiro parceiro={{ ponto_focal_id: perfil.id }} focais={focais} statusLista={statusLista} textoBotao="Cadastrar parceiro" /></div>
    </>
  );
}
