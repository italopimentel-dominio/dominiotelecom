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
