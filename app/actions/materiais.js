'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sessao, ehAdmin } from '@/lib/auth';
import { documentoDaVenda } from '@/lib/fontes';

const SO_ADMIN = { erro: 'Só administradores cadastram materiais.' };
const txt = (v) => String(v ?? '').trim();
const dataOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
// "2,5" ou "2.5" -> 2.5 (em %); vazio = sem expectativa
function percentual(v) {
  const t = txt(v).replace('%', '').replace(',', '.');
  if (!t) return { valor: null };
  const n = Number(t);
  return isFinite(n) && n >= 0 && n <= 100 ? { valor: n } : { erro: 'O % de fechamento esperado deve ser um número entre 0 e 100.' };
}
const focoDe = (v) => { const l = (Array.isArray(v) ? v : []).map(txt).filter(Boolean); return l.length ? [...new Set(l)] : null; };
const erroTabela = (m) => (m.includes('produtos_foco') ? 'Rode o arquivo 031_materiais_foco.sql no Supabase.' : m.includes('conversao_esperada') ? 'Rode o arquivo 023_materiais_meta.sql no Supabase.' : m.includes('materia') ? 'Rode o arquivo 022_materiais.sql no Supabase.' : m);

async function admin() {
  const s = await sessao();
  return ehAdmin(s.perfil) ? s : null;
}

// Cria o material (sem leads). Os leads vão depois, em blocos, por adicionarLeadsMaterial.
export async function criarMaterial(dados) {
  const s = await admin();
  if (!s) return SO_ADMIN;
  const reg = {
    nome: txt(dados?.nome),
    enviado_em: txt(dados?.enviado_em),
    grupo_id: txt(dados?.grupo_id) || null,
    origem: ['preparador', 'planilha', 'manual'].includes(dados?.origem) ? dados.origem : 'planilha',
    observacao: txt(dados?.observacao) || null,
  };
  if (!reg.nome) return { erro: 'Dê um nome para o material.' };
  if (!dataOk(reg.enviado_em)) return { erro: 'Informe a data de envio.' };
  if (!reg.grupo_id) return { erro: 'Escolha a equipe que recebeu o material.' };
  const pc = percentual(dados?.conversao_esperada);
  if (pc.erro) return { erro: pc.erro };
  if (pc.valor !== null) reg.conversao_esperada = pc.valor;
  const foco = focoDe(dados?.produtos_foco);
  if (foco) reg.produtos_foco = foco;
  const { data, error } = await s.supabase.from('materiais').insert(reg).select('id').single();
  if (error) return { erro: erroTabela(error.message) };
  return { id: data.id };
}

// leads: [{ cnpj, destinatario }] — até 5.000 por chamada. Repetidos no mesmo material são ignorados.
export async function adicionarLeadsMaterial(materialId, leads) {
  const s = await admin();
  if (!s) return SO_ADMIN;
  if (!Array.isArray(leads) || leads.length > 5000) return { erro: 'Envie no máximo 5.000 leads por vez.' };
  const vistos = new Set();
  const regs = [];
  let invalidos = 0;
  for (const l of leads) {
    const d = documentoDaVenda(l?.cnpj);
    if (!d.valido) { invalidos++; continue; }
    if (vistos.has(d.cnpj)) continue;
    vistos.add(d.cnpj);
    regs.push({ material_id: materialId, cnpj: d.cnpj, destinatario: txt(l?.destinatario) || null });
  }
  if (!regs.length) return { inseridos: 0, invalidos };
  const { data, error } = await s.supabase.from('material_leads')
    .upsert(regs, { onConflict: 'material_id,cnpj', ignoreDuplicates: true }).select('id');
  if (error) return { erro: erroTabela(error.message) };
  return { inseridos: data?.length || 0, invalidos };
}

export async function concluirMaterial() {
  revalidatePath('/materiais', 'layout');
  return { ok: true };
}

export async function salvarMaterial(_prev, fd) {
  const s = await admin();
  if (!s) return SO_ADMIN;
  const id = txt(fd.get('id'));
  const reg = {
    nome: txt(fd.get('nome')),
    enviado_em: txt(fd.get('enviado_em')),
    grupo_id: txt(fd.get('grupo_id')) || null,
    observacao: txt(fd.get('observacao')) || null,
  };
  if (!reg.nome) return { erro: 'Dê um nome para o material.' };
  if (!dataOk(reg.enviado_em)) return { erro: 'Informe a data de envio.' };
  if (!reg.grupo_id) return { erro: 'Escolha a equipe.' };
  const pc = percentual(fd.get('conversao_esperada'));
  if (pc.erro) return { erro: pc.erro };
  reg.conversao_esperada = pc.valor;
  reg.produtos_foco = focoDe(fd.getAll('produtos_foco'));
  const { error } = await s.supabase.from('materiais').update(reg).eq('id', id);
  if (error) return { erro: erroTabela(error.message) };
  revalidatePath('/materiais', 'layout');
  return { ok: 'Material salvo.' };
}

export async function excluirMaterial(_prev, fd) {
  const s = await admin();
  if (!s) return SO_ADMIN;
  const { error } = await s.supabase.from('materiais').delete().eq('id', txt(fd.get('id')));
  if (error) return { erro: erroTabela(error.message) };
  revalidatePath('/materiais', 'layout');
  redirect('/materiais');
}
