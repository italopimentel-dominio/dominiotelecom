import { redirect } from 'next/navigation';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import FormAcao from '@/components/FormAcao';
import { criarPrimeiroAdmin } from '@/app/actions/auth';

export const dynamic = 'force-dynamic';

export default async function Setup() {
  const { count, error } = await criarClienteAdmin().from('profiles').select('id', { count: 'exact', head: true });
  if (error) {
    return (
      <main className="tela-login"><div className="cartao-login">
        <h1>Configuração incompleta</h1>
        <p className="msg msg-erro">Não foi possível acessar o banco: {error.message}</p>
        <p className="dica" style={{ marginTop: 10 }}>Confira as variáveis de ambiente na Vercel e se o arquivo 001_estrutura.sql foi executado no Supabase.</p>
      </div></main>
    );
  }
  if (count > 0) redirect('/login');
  return (
    <main className="tela-login">
      <div className="cartao-login">
        <h1>Primeiro acesso</h1>
        <p className="dica" style={{ marginTop: 6 }}>Crie o administrador. Depois, ele cadastra os demais usuários.</p>
        <FormAcao acao={criarPrimeiroAdmin}>
          <label className="campo">Nome<input type="text" name="nome" required /></label>
          <label className="campo">Usuário<input type="text" name="usuario" autoCapitalize="none" required placeholder="ex.: joao.silva" /></label>
          <label className="campo">E-mail (opcional)<input type="email" name="email" /></label>
          <label className="campo">Senha (mín. 8 caracteres)<input type="password" name="senha" autoComplete="new-password" required /></label>
          <button className="btn" type="submit">Criar administrador</button>
        </FormAcao>
      </div>
    </main>
  );
}
