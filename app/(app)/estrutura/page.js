import { exigirSessao, podeEditar } from '@/lib/auth';
import { carregarEstrutura } from '@/lib/dados';
import FormAcao from '@/components/FormAcao';
import { criarGrupo, salvarGrupo, alternarGrupo, criarColaborador, salvarColaborador, alternarColaborador } from '@/app/actions/dados';

export default async function Estrutura({ searchParams }) {
  const sp = await searchParams;
  const { supabase, perfil } = await exigirSessao();
  const editar = podeEditar(perfil);
  const est = await carregarEstrutura(supabase);
  const todos = est.achatar(null, 0, false);
  const nomeCompleto = (id) => est.caminho(id).map((g) => g.nome).join(' / ');
  const opcoesGrupo = todos.map((g) => ({ id: g.id, nome: nomeCompleto(g.id), ativo: g.ativo }));
  const verInativos = sp.inativos === '1';

  return (
    <>
      <div className="topo">
        <div>
          <h1>Equipes e colaboradores</h1>
          <p className="sub">Organize canal, regional e equipe em níveis. A meta de cada equipe é dividida entre os colaboradores dela.</p>
        </div>
        <a className="dica" href={verInativos ? '/estrutura' : '/estrutura?inativos=1'}>{verInativos ? 'Esconder inativos' : 'Mostrar inativos'}</a>
      </div>

      {editar && (
        <div className="bloco" style={{ display: 'grid', gap: 22, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <FormAcao acao={criarGrupo}>
            <h3 style={{ marginBottom: 10 }}>Novo canal ou equipe</h3>
            <div className="campos">
              <label className="campo">Nome<input type="text" name="nome" required /></label>
              <label className="campo">Fica dentro de
                <select name="parent_id" defaultValue="">
                  <option value="">Nenhum (é um canal)</option>
                  {opcoesGrupo.filter((g) => g.ativo).map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              </label>
              <button className="btn" type="submit">Criar</button>
            </div>
          </FormAcao>
          <FormAcao acao={criarColaborador}>
            <h3 style={{ marginBottom: 10 }}>Adicionar colaboradores</h3>
            <div className="campos">
              <label className="campo" style={{ flex: '1 1 200px' }}>Nomes (um por linha)<textarea name="nome" rows={3} required /></label>
              <label className="campo">Equipe
                <select name="grupo_id" required defaultValue="">
                  <option value="" disabled>Escolha</option>
                  {opcoesGrupo.filter((g) => g.ativo).map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              </label>
              <label className="campo">Peso<input type="text" name="peso" defaultValue="1" style={{ width: 70 }} /></label>
              <button className="btn" type="submit">Adicionar</button>
            </div>
            <p className="dica" style={{ marginTop: 8 }}>Peso 1 = cota cheia. Use 0,5 para meia cota (ex.: quem entrou no meio do mês) ou 0 para quem não recebe meta.</p>
          </FormAcao>
        </div>
      )}

      {todos.filter((g) => verInativos || g.ativo).map((g) => {
        const colabs = est.colaboradores.filter((c) => c.grupo_id === g.id && (verInativos || c.ativo));
        return (
          <section key={g.id} className={`secao ${g.nivel ? `recuo-${Math.min(g.nivel, 3)}` : ''}`}>
            <div className="grupo-cab" style={{ marginTop: 0 }}>
              <h2 style={{ color: g.ativo ? undefined : 'var(--suave)' }}>{g.nome}</h2>
              {!g.ativo && <span className="tag tag-risco">inativo</span>}
              <span className="tag">{colabs.filter((c) => c.ativo).length} ativos</span>
            </div>
            {editar && (
              <details className="recolhivel">
                <summary>Editar {g.nome}</summary>
                <div className="bloco" style={{ marginTop: 8 }}>
                  <FormAcao acao={salvarGrupo}>
                    <div className="campos">
                      <input type="hidden" name="id" value={g.id} />
                      <label className="campo">Nome<input type="text" name="nome" defaultValue={g.nome} required /></label>
                      <label className="campo">Fica dentro de
                        <select name="parent_id" defaultValue={g.parent_id || ''}>
                          <option value="">Nenhum (é um canal)</option>
                          {opcoesGrupo.filter((o) => o.id !== g.id && !est.subarvore(g.id).includes(o.id)).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                        </select>
                      </label>
                      <label className="campo">Ordem<input type="number" name="ordem" defaultValue={g.ordem} style={{ width: 70 }} /></label>
                      <button className="btn" type="submit">Salvar</button>
                    </div>
                  </FormAcao>
                  <FormAcao acao={alternarGrupo} confirmar={g.ativo ? `Inativar ${g.nome}? Ele some do painel, mas o histórico fica guardado.` : undefined}>
                    <input type="hidden" name="id" value={g.id} />
                    <input type="hidden" name="ativar" value={g.ativo ? '0' : '1'} />
                    <button className={g.ativo ? 'btn btn-perigo btn-peq' : 'btn btn-sec btn-peq'} type="submit" style={{ marginTop: 12 }}>{g.ativo ? 'Inativar' : 'Reativar'}</button>
                  </FormAcao>
                </div>
              </details>
            )}
            {colabs.length > 0 && (
              <details className="recolhivel" open={sp.abrir === g.id}>
                <summary>Colaboradores ({colabs.length})</summary>
              <div className="tabela-wrap" style={{ marginTop: 8 }}>
                <table>
                  <thead><tr><th>Colaborador</th>{editar ? <><th className="esq">Equipe</th><th>Peso</th><th></th><th></th></> : <th>Peso</th>}</tr></thead>
                  <tbody>
                    {colabs.map((c) => (
                      <tr key={c.id} className={c.ativo ? '' : 'inativo'}>
                        {editar ? (
                          <>
                            <td colSpan={4} style={{ padding: '6px 12px' }}>
                              <FormAcao acao={salvarColaborador}>
                                <div className="campos" style={{ flexWrap: 'nowrap' }}>
                                  <input type="hidden" name="id" value={c.id} />
                                  <input type="text" name="nome" defaultValue={c.nome} aria-label="Nome" style={{ width: 220 }} />
                                  <select name="grupo_id" defaultValue={c.grupo_id} aria-label="Equipe" style={{ width: 230 }}>
                                    {opcoesGrupo.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                                  </select>
                                  <input type="text" name="peso" defaultValue={String(c.peso).replace('.', ',')} aria-label="Peso" style={{ width: 64, textAlign: 'right' }} />
                                  <button className="btn btn-sec btn-peq" type="submit">Salvar</button>
                                </div>
                              </FormAcao>
                            </td>
                            <td>
                              <FormAcao acao={alternarColaborador}>
                                <input type="hidden" name="id" value={c.id} />
                                <input type="hidden" name="ativar" value={c.ativo ? '0' : '1'} />
                                <button className={c.ativo ? 'btn btn-perigo btn-peq' : 'btn btn-sec btn-peq'} type="submit">{c.ativo ? 'Inativar' : 'Reativar'}</button>
                              </FormAcao>
                            </td>
                          </>
                        ) : (
                          <><td>{c.nome}{!c.ativo && <span className="nome-sub">inativo</span>}</td><td>{String(c.peso).replace('.', ',')}</td></>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </details>
            )}
          </section>
        );
      })}
    </>
  );
}
