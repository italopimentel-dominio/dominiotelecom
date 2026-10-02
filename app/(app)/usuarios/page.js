import { redirect } from 'next/navigation';
import { exigirSessao, ehAdmin, NOME_PAPEL } from '@/lib/auth';
import FormAcao from '@/components/FormAcao';
import { criarUsuario, alterarPapel, alternarUsuario, redefinirSenha } from '@/app/actions/usuarios';

export default async function Usuarios() {
  const { supabase, perfil } = await exigirSessao();
  if (!ehAdmin(perfil)) redirect('/');
  const { data: usuarios = [] } = await supabase.from('profiles').select('*').order('ativo', { ascending: false }).order('nome');

  return (
    <>
      <div className="topo">
        <div>
          <h1>Usuários</h1>
          <p className="sub">Visualizador só consulta. Editor lança metas, realizado e cadastros. Administrador também gerencia usuários.</p>
        </div>
      </div>

      <FormAcao acao={criarUsuario} className="bloco">
        <h3 style={{ marginBottom: 10 }}>Novo usuário</h3>
        <div className="campos">
          <label className="campo">Nome<input type="text" name="nome" required /></label>
          <label className="campo">Usuário (login)<input type="text" name="usuario" autoCapitalize="none" required placeholder="ex.: maria.souza" /></label>
          <label className="campo">E-mail (opcional)<input type="email" name="email" /></label>
          <label className="campo">Senha inicial<input type="text" name="senha" required minLength={8} autoComplete="off" /></label>
          <label className="campo">Permissão
            <select name="papel" defaultValue="viewer">
              {Object.entries(NOME_PAPEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <button className="btn" type="submit">Criar usuário</button>
        </div>
      </FormAcao>

      <div className="tabela-wrap" style={{ marginTop: 22 }}>
        <table>
          <thead><tr><th>Nome</th><th className="esq">Usuário</th><th className="esq">Permissão</th><th className="esq">Nova senha</th><th></th></tr></thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className={u.ativo ? '' : 'inativo'}>
                <td>{u.nome || '—'}{!u.ativo && <span className="nome-sub">inativo</span>}{u.id === perfil.id && <span className="nome-sub">você</span>}</td>
                <td className="esq">{u.usuario}</td>
                <td className="esq">
                  <FormAcao acao={alterarPapel}>
                    <div className="campos" style={{ flexWrap: 'nowrap' }}>
                      <input type="hidden" name="id" value={u.id} />
                      <select name="papel" defaultValue={u.papel} aria-label={`Permissão de ${u.usuario}`}>
                        {Object.entries(NOME_PAPEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <button className="btn btn-sec btn-peq" type="submit">Salvar</button>
                    </div>
                  </FormAcao>
                </td>
                <td className="esq">
                  <FormAcao acao={redefinirSenha}>
                    <div className="campos" style={{ flexWrap: 'nowrap' }}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="text" name="senha" placeholder="mín. 8 caracteres" aria-label={`Nova senha de ${u.usuario}`} autoComplete="off" style={{ width: 150 }} />
                      <button className="btn btn-sec btn-peq" type="submit">Redefinir</button>
                    </div>
                  </FormAcao>
                </td>
                <td>
                  {u.id !== perfil.id && (
                    <FormAcao acao={alternarUsuario} confirmar={u.ativo ? `Inativar ${u.usuario}? Ele perde o acesso na hora.` : undefined}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="ativar" value={u.ativo ? '0' : '1'} />
                      <button className={u.ativo ? 'btn btn-perigo btn-peq' : 'btn btn-sec btn-peq'} type="submit">{u.ativo ? 'Inativar' : 'Reativar'}</button>
                    </FormAcao>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
