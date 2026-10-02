import { redirect } from 'next/navigation';
import { sessao } from '@/lib/auth';
import FormAcao from '@/components/FormAcao';
import { entrar } from '@/app/actions/auth';

export default async function Login({ searchParams }) {
  const sp = await searchParams;
  const { perfil } = await sessao();
  if (perfil?.ativo) redirect('/');
  return (
    <main className="tela-login">
      <div className="cartao-login">
        <h1>Metas da Equipe</h1>
        <p className="dica" style={{ marginTop: 6 }}>Televendas, Consultivo e Indireto</p>
        {sp?.erro === 'inativo' && <p className="msg msg-erro">Seu acesso está inativo. Fale com um administrador.</p>}
        <FormAcao acao={entrar}>
          <label className="campo">Usuário
            <input type="text" name="usuario" autoComplete="username" autoCapitalize="none" required />
          </label>
          <label className="campo">Senha
            <input type="password" name="senha" autoComplete="current-password" required />
          </label>
          <button className="btn" type="submit">Entrar</button>
        </FormAcao>
      </div>
    </main>
  );
}
