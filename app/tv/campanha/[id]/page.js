import { notFound } from 'next/navigation';
import { exigirSessao } from '@/lib/auth';
import { TEMAS } from '@/lib/campanhas';
import { carregarCampanha } from '@/lib/campanhasDados';
import PainelCampanha from '@/components/PainelCampanha';
import AutoAtualizar from '@/components/AutoAtualizar';

export const dynamic = 'force-dynamic';

// Tela cheia para deixar numa TV da operação: atualiza sozinha a cada minuto
export default async function TvCampanha({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await exigirSessao();
  const d = await carregarCampanha(supabase, id);
  if (!d) notFound();
  const tema = TEMAS[sp.tema] ? sp.tema : d.campanha.tema;
  return (
    <main className="tv">
      <AutoAtualizar segundos={60} />
      <PainelCampanha campanha={d.campanha} calc={d.calc} tema={tema} grande />
      <img src="/logo-duomni-branco.png" alt="Duomni" className="tv-logo" />
    </main>
  );
}
