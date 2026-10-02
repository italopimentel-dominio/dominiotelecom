'use server';
import { revalidatePath } from 'next/cache';
import { sessao, ehAdmin } from '@/lib/auth';
import { criarClienteAdmin, emailInterno } from '@/lib/supabase/admin';

const USUARIO_OK = /^[a-z0-9._-]{3,30}$/;
const SEM_PERMISSAO = { erro: 'Só administradores podem gerenciar usuários.' };

async function exigirAdmin() {
  const s = await sessao();
  return ehAdmin(s.perfil) ? s : null;
}

export async function criarUsuario(_prev, fd) {
  const s = await exigirAdmin();
  if (!s) return SEM_PERMISSAO;
  const nome = String(fd.get('nome') || '').trim();
  const usuario = String(fd.get('usuario') || '').trim().toLowerCase();
  const senha = String(fd.get('senha') || '');
  const papel = String(fd.get('papel') || 'viewer');
  const perm_indireto = String(fd.get('perm_indireto') || 'ver');
  if (!nome) return { erro: 'Informe o nome.' };
  if (!USUARIO_OK.test(usuario)) return { erro: 'Usuário: 3 a 30 caracteres, só letras minúsculas, números, ponto, hífen ou _.' };
  if (senha.length < 8) return { erro: 'A senha precisa ter pelo menos 8 caracteres.' };
  if (!['admin', 'editor', 'viewer'].includes(papel)) return { erro: 'Permissão inválida.' };
  const admin = criarClienteAdmin();
  const { data: existe } = await admin.from('profiles').select('id').eq('usuario', usuario).maybeSingle();
  if (existe) return { erro: `O usuário "${usuario}" já existe.` };
  const email = String(fd.get('email') || '').trim().toLowerCase() || emailInterno(usuario);
  const { data, error } = await admin.auth.admin.createUser({
    email, password: senha, email_confirm: true,
    user_metadata: { usuario, nome }, app_metadata: { criado_pelo_painel: 'true' },
  });
  if (error) return { erro: `Não foi possível criar: ${error.message}` };
  await admin.from('profiles').update({ papel, ativo: true, perm_indireto: ['nenhum', 'ver', 'editar', 'validar'].includes(perm_indireto) ? perm_indireto : 'ver' }).eq('id', data.user.id);
  revalidatePath('/usuarios');
  return { ok: `Usuário ${usuario} criado.` };
}

export async function alterarPapel(_prev, fd) {
  const s = await exigirAdmin();
  if (!s) return SEM_PERMISSAO;
  const id = String(fd.get('id'));
  const papel = String(fd.get('papel'));
  const perm_indireto = String(fd.get('perm_indireto') || 'ver');
  if (!['nenhum', 'ver', 'editar', 'validar'].includes(perm_indireto)) return { erro: 'Permissão inválida.' };
  if (id === s.user.id && papel !== 'admin') return { erro: 'Você não pode tirar a sua própria permissão de administrador.' };
  if (!['admin', 'editor', 'viewer'].includes(papel)) return { erro: 'Permissão inválida.' };
  const { error } = await criarClienteAdmin().from('profiles').update({ papel, perm_indireto }).eq('id', id);
  if (error) return { erro: error.message };
  revalidatePath('/usuarios');
  return { ok: 'Permissões salvas.' };
}

export async function alternarUsuario(_prev, fd) {
  const s = await exigirAdmin();
  if (!s) return SEM_PERMISSAO;
  const id = String(fd.get('id'));
  const ativar = fd.get('ativar') === '1';
  if (id === s.user.id) return { erro: 'Você não pode inativar a si mesmo.' };
  const admin = criarClienteAdmin();
  const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: ativar ? 'none' : '876000h' });
  if (error) return { erro: error.message };
  await admin.from('profiles').update({ ativo: ativar }).eq('id', id);
  revalidatePath('/usuarios');
  return { ok: ativar ? 'Usuário reativado.' : 'Usuário inativado.' };
}

export async function redefinirSenha(_prev, fd) {
  const s = await exigirAdmin();
  if (!s) return SEM_PERMISSAO;
  const id = String(fd.get('id'));
  const senha = String(fd.get('senha') || '');
  if (senha.length < 8) return { erro: 'A senha precisa ter pelo menos 8 caracteres.' };
  const { error } = await criarClienteAdmin().auth.admin.updateUserById(id, { password: senha });
  if (error) return { erro: error.message };
  return { ok: 'Senha redefinida.' };
}
