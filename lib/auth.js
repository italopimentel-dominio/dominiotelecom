import { redirect } from 'next/navigation';
import { criarClienteServidor } from './supabase/server';

export async function sessao() {
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, perfil: null };
  const { data: perfil } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return { supabase, user, perfil };
}

export async function exigirSessao() {
  const s = await sessao();
  if (!s.user) redirect('/login');
  if (!s.perfil?.ativo) redirect('/login?erro=inativo');
  return s;
}

export const podeEditar = (p) => !!p && p.ativo && (p.papel === 'admin' || p.papel === 'editor');
export const ehAdmin = (p) => !!p && p.ativo && p.papel === 'admin';
export const NOME_PAPEL = { admin: 'Administrador', editor: 'Editor', viewer: 'Visualizador' };

// Controle Indireto: permissão própria do módulo (administrador sempre pode tudo)
export const podeVerIndireto = (p) => !!p && p.ativo && (p.papel === 'admin' || ['ver', 'editar'].includes(p.perm_indireto ?? 'ver'));
export const podeEditarIndireto = (p) => !!p && p.ativo && (p.papel === 'admin' || p.perm_indireto === 'editar');
export const NOME_PERM_INDIRETO = { nenhum: 'Sem acesso', ver: 'Visualiza', editar: 'Ponto focal (edita)' };
