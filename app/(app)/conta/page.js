import { exigirSessao, NOME_PAPEL } from '@/lib/auth';
import FormAcao from '@/components/FormAcao';
import { trocarSenha } from '@/app/actions/auth';

export default async function Conta() {
  const { perfil } = await exigirSessao();
  return (
    <>
      <div className="topo">
        <div>
          <h1>Minha senha</h1>
          <p className="sub">{perfil.nome} ({perfil.usuario}), {NOME_PAPEL[perfil.papel]}.</p>
        </div>
      </div>
      <FormAcao acao={trocarSenha} className="bloco" >
        <div className="campos">
          <label className="campo">Nova senha<input type="password" name="senha" autoComplete="new-password" required minLength={8} /></label>
          <label className="campo">Repita a nova senha<input type="password" name="confirmar" autoComplete="new-password" required /></label>
          <button className="btn" type="submit">Trocar senha</button>
        </div>
      </FormAcao>
    </>
  );
}
