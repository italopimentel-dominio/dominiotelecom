import Link from 'next/link';
import { redirect } from 'next/navigation';
import { exigirSessao, podeValidarIndireto } from '@/lib/auth';
import ImportarParceiros from '@/components/ImportarParceiros';
import { listarFocais, listarStatus } from '../dados';

export default async function PaginaImportarParceiros() {
  const { perfil, supabase } = await exigirSessao();
  if (!podeValidarIndireto(perfil)) redirect('/indireto');
  const [focais, statusLista] = await Promise.all([listarFocais(supabase), listarStatus(supabase)]);
  return (
    <>
      <div className="topo">
        <div>
          <p className="sub"><Link href="/indireto">← Controle Indireto</Link></p>
          <h1>Importar lista de parceiros</h1>
          <p className="sub">
            Suba uma planilha ou cole uma lista. Só o nome é obrigatório; CPF/CNPJ, e-mail, telefone, cidade, UF e observações entram se existirem.
            O status, o ponto focal e a data de ativação valem para a lista toda.
          </p>
        </div>
      </div>
      <section className="bloco secao"><ImportarParceiros focais={focais} statusLista={statusLista} /></section>
    </>
  );
}
