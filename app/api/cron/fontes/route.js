// Atualização automática das fontes de dados.
// Chamada pelo agendamento do Supabase (pg_cron) com o cabeçalho Authorization: Bearer <CRON_SECRET>.
// ?n=0, ?n=1… processa uma fonte por chamada (cada uma tem seu próprio limite de tempo).
import { NextResponse } from 'next/server';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { rodarFonteAutomatica } from '@/lib/fontesAuto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  }
  const db = criarClienteAdmin();
  const { data: cfg } = await db.from('config_sistema').select('valor').eq('chave', 'fontes_auto').maybeSingle();
  if (cfg && cfg.valor?.ativo === false) return NextResponse.json({ ok: true, pausado: true });
  const { data: fontes, error } = await db.from('fontes_dados').select('*').eq('ativo', true).order('criado_em');
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  const n = new URL(req.url).searchParams.get('n');
  const lista = n === null ? fontes : fontes.slice(Number(n), Number(n) + 1);
  const resultados = [];
  for (const f of lista) {
    try {
      resultados.push(await rodarFonteAutomatica(db, f));
    } catch (e) {
      await db.from('fontes_dados').update({ auto_em: new Date().toISOString(), auto_status: 'erro', auto_msg: `Erro inesperado: ${e.message}` }).eq('id', f.id);
      resultados.push({ fonte: f.nome, status: 'erro', msg: e.message });
    }
  }
  return NextResponse.json({ ok: true, resultados });
}
