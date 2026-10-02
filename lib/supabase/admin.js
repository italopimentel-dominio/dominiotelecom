import { createClient } from '@supabase/supabase-js';

// Cliente com a chave secreta: só pode ser usado no servidor (server actions).
export function criarClienteAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function emailInterno(usuario) {
  return `${usuario}@${process.env.LOGIN_EMAIL_DOMAIN || 'metas.local'}`;
}
