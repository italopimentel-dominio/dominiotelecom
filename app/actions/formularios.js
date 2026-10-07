'use server';
import { revalidatePath } from 'next/cache';
import { sessao, podeEditarIndireto, podeValidarIndireto } from '@/lib/auth';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { normalizar } from '@/lib/nomes';

const TIPOS = ['onboarding', 'telecom', 'servicos'];
const RESPOSTAS = ['texto', 'escolha', 'sim_nao', 'nota'];
const txt = (v) => String(v ?? '').trim();
const erroTabela = (m) => (/form_(links|perguntas)/.test(m) ? 'Rode o arquivo 025_formulario_link.sql no Supabase.' : m);

// Gera (ou reaproveita) o link do formulário de um parceiro. Devolve o token.
export async function gerarLinkForm(parceiroId, tipo) {
  const s = await sessao();
  if (!podeEditarIndireto(s.perfil)) return { erro: 'Sem permissão.' };
  if (!TIPOS.includes(tipo)) return { erro: 'Tipo inválido.' };
  const db = s.supabase;
  const { data: aberto } = await db.from('form_links').select('token')
    .eq('parceiro_id', parceiroId).eq('tipo', tipo).is('respondido_em', null)
    .gt('expira_em', new Date().toISOString()).order('criado_em', { ascending: false }).limit(1);
  if (aberto?.length) return { token: aberto[0].token };
  const { data, error } = await db.from('form_links').insert({ parceiro_id: parceiroId, tipo }).select('token').single();
  if (error) return { erro: erroTabela(error.message) };
  revalidatePath(`/indireto/${parceiroId}`);
  return { token: data.token };
}

export async function cancelarLinkForm(token, parceiroId) {
  const s = await sessao();
  if (!podeEditarIndireto(s.perfil)) return { erro: 'Sem permissão.' };
  const { error } = await s.supabase.from('form_links').delete().eq('token', token).is('respondido_em', null);
  if (error) return { erro: error.message };
  revalidatePath(`/indireto/${parceiroId}`);
  return { ok: true };
}

// Perguntas (só gerente/admin)
export async function salvarPergunta(_prev, fd) {
  const s = await sessao();
  if (!podeValidarIndireto(s.perfil)) return { erro: 'Só o gerente edita as perguntas.' };
  const id = txt(fd.get('id'));
  const tipo_resposta = RESPOSTAS.includes(txt(fd.get('tipo_resposta'))) ? txt(fd.get('tipo_resposta')) : 'texto';
  const opcoes = tipo_resposta === 'escolha' ? txt(fd.get('opcoes')).split('\n').map((o) => o.trim()).filter(Boolean) : null;
  const reg = {
    texto: txt(fd.get('texto')),
    tipo_resposta,
    opcoes,
    correta: txt(fd.get('correta')) || null,
    ordem: Number(txt(fd.get('ordem'))) || 0,
    obrigatoria: fd.get('obrigatoria') === 'on',
  };
  if (!reg.texto) return { erro: 'Escreva a pergunta.' };
  if (tipo_resposta === 'escolha' && (!opcoes || opcoes.length < 2)) return { erro: 'Coloque pelo menos duas opções (uma por linha).' };
  if (reg.correta && tipo_resposta === 'escolha' && !opcoes.includes(reg.correta)) return { erro: 'A resposta certa precisa ser uma das opções.' };
  if (reg.correta && tipo_resposta === 'sim_nao' && !['Sim', 'Não'].includes(reg.correta)) return { erro: 'A resposta certa deve ser Sim ou Não.' };
  if (tipo_resposta === 'texto' || tipo_resposta === 'nota') reg.correta = null;
  const db = s.supabase;
  if (id) {
    reg.ativa = fd.get('ativa') === 'on';
    const { error } = await db.from('form_perguntas').update(reg).eq('id', id);
    if (error) return { erro: erroTabela(error.message) };
  } else {
    const tipo = txt(fd.get('tipo'));
    if (!TIPOS.includes(tipo)) return { erro: 'Tipo inválido.' };
    const { error } = await db.from('form_perguntas').insert({ ...reg, tipo });
    if (error) return { erro: erroTabela(error.message) };
  }
  revalidatePath('/indireto/perguntas');
  return { ok: id ? 'Pergunta salva.' : 'Pergunta criada.' };
}

// Resposta do parceiro (página pública, sem login): valida o link, grava e aplica.
export async function responderFormulario(token, respostas) {
  const db = criarClienteAdmin();
  const { data: link } = await db.from('form_links').select('*').eq('token', txt(token)).maybeSingle();
  if (!link) return { erro: 'Link inválido.' };
  if (link.respondido_em) return { erro: 'Este formulário já foi respondido. Obrigado!' };
  if (new Date(link.expira_em) < new Date()) return { erro: 'Este link expirou. Peça um novo para quem te atendeu.' };

  const [{ data: perguntas }, { data: parceiro }] = await Promise.all([
    db.from('form_perguntas').select('*').eq('tipo', link.tipo).eq('ativa', true).order('ordem').order('criado_em'),
    db.from('parceiros').select('id, nome_fantasia').eq('id', link.parceiro_id).maybeSingle(),
  ]);
  if (!parceiro) return { erro: 'Link inválido.' };

  const guardadas = {};
  let acertos = 0, total = 0;
  for (const p of perguntas || []) {
    const r = txt(respostas?.[p.id]);
    if (!r && p.obrigatoria) return { erro: `Responda: "${p.texto}"` };
    if (r && p.tipo_resposta === 'escolha' && !(p.opcoes || []).includes(r)) return { erro: `Resposta inválida em "${p.texto}".` };
    if (r && p.tipo_resposta === 'sim_nao' && !['Sim', 'Não'].includes(r)) return { erro: `Resposta inválida em "${p.texto}".` };
    if (r && p.tipo_resposta === 'nota' && !/^(10|[0-9])$/.test(r)) return { erro: `Dê uma nota de 0 a 10 em "${p.texto}".` };
    guardadas[p.texto] = r || '';
    if (p.correta) { total++; if (normalizar(r) === normalizar(p.correta)) acertos++; }
  }
  if (total) guardadas['Pontuação'] = `${acertos} de ${total}`;

  const agora = new Date().toISOString();
  // trava o link primeiro (evita duas respostas ao mesmo tempo)
  const { data: travado } = await db.from('form_links').update({ respondido_em: agora })
    .eq('id', link.id).is('respondido_em', null).select('id');
  if (!travado?.length) return { erro: 'Este formulário já foi respondido. Obrigado!' };

  const { data: nova, error } = await db.from('parceiro_respostas_form').insert({
    resposta_id: `link:${link.token}`,
    formulario: 'Formulário do sistema',
    tipo_treinamento: link.tipo,
    respondido_em: agora,
    nome: parceiro.nome_fantasia,
    respostas: guardadas,
    parceiro_id: parceiro.id,
    acertos: total ? acertos : null,
    total_pontuavel: total || null,
  }).select('id').single();
  if (error) {
    await db.from('form_links').update({ respondido_em: null }).eq('id', link.id);
    return { erro: 'Não consegui gravar agora. Tente de novo em alguns minutos.' };
  }
  await db.from('form_links').update({ resposta_id: nova.id }).eq('id', link.id);
  await db.rpc('aplicar_resposta_form', { p_resposta: nova.id });
  revalidatePath('/indireto', 'layout');
  return { ok: true };
}
