'use server';
import { redirect } from 'next/navigation';
import { criarClienteServidor } from '@/lib/supabase/server';
import { criarClienteAdmin, emailInterno } from '@/lib/supabase/admin';

const USUARIO_OK = /^[a-z0-9._-]{3,30}$/;

export async function entrar(_prev, fd) {
  const login = String(fd.get('usuario') || '').trim().toLowerCase();
  const senha = String(fd.get('senha') || '');
  if (!login || !senha) return { erro: 'Informe usuário e senha.' };
  const supabase = await criarClienteServidor();
  let email = login;
  if (!login.includes('@')) {
    const { data } = await supabase.rpc('email_do_usuario', { p_usuario: login });
    if (!data) return { erro: 'Usuário ou senha incorretos.' };
    email = data;
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) {
    if (/banned/i.test(error.message)) return { erro: 'Este usuário está inativo. Fale com um administrador.' };
    return { erro: 'Usuário ou senha incorretos.' };
  }
  redirect('/');
}

export async function sair() {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function criarPrimeiroAdmin(_prev, fd) {
  const admin = criarClienteAdmin();
  const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true });
  if (count > 0) return { erro: 'O administrador já foi criado. Entre pela tela de login.' };
  const nome = String(fd.get('nome') || '').trim();
  const usuario = String(fd.get('usuario') || '').trim().toLowerCase();
  const senha = String(fd.get('senha') || '');
  if (!nome) return { erro: 'Informe o nome.' };
  if (!USUARIO_OK.test(usuario)) return { erro: 'Usuário: 3 a 30 caracteres, só letras minúsculas, números, ponto, hífen ou _.' };
  if (senha.length < 8) return { erro: 'A senha precisa ter pelo menos 8 caracteres.' };
  const email = String(fd.get('email') || '').trim().toLowerCase() || emailInterno(usuario);
  const { error } = await admin.auth.admin.createUser({
    email, password: senha, email_confirm: true,
    user_metadata: { usuario, nome }, app_metadata: { criado_pelo_painel: 'true' },
  });
  if (error) return { erro: `Não foi possível criar: ${error.message}` };
  const supabase = await criarClienteServidor();
  await supabase.auth.signInWithPassword({ email, password: senha });
  redirect('/');
}

export async function trocarSenha(_prev, fd) {
  const nova = String(fd.get('senha') || '');
  const conf = String(fd.get('confirmar') || '');
  if (nova.length < 8) return { erro: 'A senha precisa ter pelo menos 8 caracteres.' };
  if (nova !== conf) return { erro: 'As senhas não conferem.' };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.updateUser({ password: nova });
  if (error) return { erro: `Não foi possível trocar a senha: ${error.message}` };
  return { ok: 'Senha alterada.' };
}
