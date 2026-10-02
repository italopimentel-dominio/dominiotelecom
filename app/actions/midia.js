'use server';
import { revalidatePath } from 'next/cache';
import { sessao, podeEditar } from '@/lib/auth';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { PERSONAGENS } from '@/lib/campanhas';

const SEM_PERMISSAO = { erro: 'Seu usuário só tem permissão para visualizar.' };
const TIPOS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const txt = (fd, k) => String(fd.get(k) ?? '').trim();
const atualizar = () => { revalidatePath('/campanhas', 'layout'); revalidatePath('/tv', 'layout'); revalidatePath('/organograma'); };

async function editor() {
  const s = await sessao();
  return podeEditar(s.perfil) ? s.supabase : null;
}

// Envia a imagem para a pasta pública "midia" do Supabase e devolve o endereço
async function enviar(arquivo, pasta) {
  if (!arquivo || typeof arquivo === 'string' || !arquivo.size) return { erro: 'Escolha uma imagem.' };
  const ext = TIPOS[arquivo.type];
  if (!ext) return { erro: 'Use uma imagem PNG, JPG, WEBP ou GIF.' };
  if (arquivo.size > 5 * 1024 * 1024) return { erro: 'A imagem pode ter no máximo 5 MB.' };
  const caminho = `${pasta}-${Date.now()}.${ext}`;
  const admin = criarClienteAdmin();
  const { error } = await admin.storage.from('midia').upload(caminho, arquivo, { contentType: arquivo.type, upsert: true });
  if (error) return { erro: `Não foi possível enviar: ${error.message}` };
  return { url: admin.storage.from('midia').getPublicUrl(caminho).data.publicUrl };
}

export async function enviarImagemCampanha(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const id = txt(fd, 'campanha_id');
  const campo = txt(fd, 'campo') === 'premio' ? 'premio_url' : 'capa_url';
  const r = await enviar(fd.get('arquivo'), `campanhas/${id}/${campo}`);
  if (r.erro) return r;
  const { error } = await db.from('campanhas').update({ [campo]: r.url }).eq('id', id);
  if (error) return { erro: error.message };
  atualizar();
  return { ok: 'Imagem atualizada.' };
}

export async function removerImagemCampanha(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const campo = txt(fd, 'campo') === 'premio' ? 'premio_url' : 'capa_url';
  const { error } = await db.from('campanhas').update({ [campo]: null }).eq('id', txt(fd, 'campanha_id'));
  if (error) return { erro: error.message };
  atualizar();
  return { ok: 'Imagem removida.' };
}

export async function salvarVisualCampanha(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const cor = txt(fd, 'cor');
  let personagem = txt(fd, 'personagem');
  if (personagem === 'proprio') personagem = txt(fd, 'emoji').slice(0, 16) || null;
  else if (!PERSONAGENS[personagem]) personagem = null;
  const { error } = await db.from('campanhas').update({
    cor: /^#[0-9a-f]{6}$/i.test(cor) ? cor : null,
    personagem,
    frase: txt(fd, 'frase') || null,
  }).eq('id', txt(fd, 'campanha_id'));
  if (error) return { erro: error.message };
  atualizar();
  return { ok: 'Visual salvo.' };
}

export async function enviarFotoColaborador(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const id = txt(fd, 'colaborador_id');
  if (fd.get('remover') === '1') {
    const { error } = await db.from('colaboradores').update({ foto_url: null }).eq('id', id);
    if (error) return { erro: error.message };
    atualizar();
    return { ok: 'Foto removida.' };
  }
  const r = await enviar(fd.get('arquivo'), `colaboradores/${id}`);
  if (r.erro) return r;
  const { error } = await db.from('colaboradores').update({ foto_url: r.url }).eq('id', id);
  if (error) return { erro: error.message };
  atualizar();
  return { ok: 'Foto atualizada.' };
}
