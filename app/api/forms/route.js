import { NextResponse } from 'next/server';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { extrairIdentificacao } from '@/lib/indireto';

// Recebe as respostas do Formulário Google (enviadas pelo Apps Script).
export async function POST(request) {
  const segredo = process.env.FORMS_WEBHOOK_SECRET;
  if (!segredo || request.headers.get('x-webhook-secret') !== segredo) {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  }
  let corpo;
  try { corpo = await request.json(); } catch { return NextResponse.json({ erro: 'JSON inválido' }, { status: 400 }); }
  const { resposta_id, formulario, tipo, respondido_em, respostas } = corpo || {};
  if (!resposta_id || typeof respostas !== 'object') return NextResponse.json({ erro: 'faltam dados' }, { status: 400 });

  const db = criarClienteAdmin();
  const { data: existente } = await db.from('parceiro_respostas_form').select('id, parceiro_id').eq('resposta_id', resposta_id).maybeSingle();
  if (existente) return NextResponse.json({ ok: true, repetida: true, vinculada: !!existente.parceiro_id });

  const { documento, email, nome } = extrairIdentificacao(respostas);
  let parceiro_id = null;
  if (documento) {
    const col = documento.length === 14 ? 'cnpj' : 'cpf';
    const { data } = await db.from('parceiros').select('id').eq(col, documento).limit(1);
    parceiro_id = data?.[0]?.id || null;
  }
  if (!parceiro_id && email) {
    const { data } = await db.from('parceiros').select('id').ilike('contato_email', email).limit(2);
    if (data?.length === 1) parceiro_id = data[0].id;
  }

  const { data: nova, error } = await db.from('parceiro_respostas_form').insert({
    resposta_id: String(resposta_id),
    formulario: formulario || null,
    tipo_treinamento: ['onboarding', 'telecom', 'servicos'].includes(tipo) ? tipo : 'onboarding',
    respondido_em: respondido_em || new Date().toISOString(),
    documento, email, nome, respostas, parceiro_id,
  }).select('id').single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  if (parceiro_id) {
    const { error: e2 } = await db.rpc('aplicar_resposta_form', { p_resposta: nova.id });
    if (e2) return NextResponse.json({ erro: e2.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, vinculada: !!parceiro_id });
}
