import { exigirSessao, podeEditar } from '@/lib/auth';
import { carregarEstrutura } from '@/lib/dados';
import FormAcao from '@/components/FormAcao';
import TempoCasa from '@/components/TempoCasa';
import { hojeSP } from '@/lib/datas';
import { fmtData } from '@/lib/formato';
import { criarGrupo, salvarGrupo, alternarGrupo, criarColaborador, salvarColaborador, alternarColaborador } from '@/app/actions/dados';

export default async function Estrutura({ searchParams }) {
  const sp = await searchParams;
  const { supabase, perfil } = await exigirSessao();
  const editar = podeEditar(perfil);
  const hoje = hojeSP();
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
              <label className="campo">Admissão<input type="date" name="data_admissao" /></label>
              <button className="btn" type="submit">Adicionar</button>
            </div>
            <p className="dica" style={{ marginTop: 8 }}>Peso 1 = cota cheia. Use 0,5 para meia cota (ex.: quem entrou no meio do mês) ou 0 para quem não recebe meta. A data de admissão vale para todos os nomes da lista.</p>
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
                  <thead><tr><th>Colaborador</th>{editar ? <><th className="esq">Equipe</th><th>Peso</th><th className="esq">Admissão</th><th className="esq">Tempo de casa</th><th></th><th></th></> : <><th>Peso</th><th className="esq">Tempo de casa</th></>}</tr></thead>
                  <tbody>
                    {colabs.map((c) => (
                      <tr key={c.id} className={c.ativo ? '' : 'inativo'}>
                        {editar ? (
                          <>
                            <td colSpan={6} style={{ padding: '6px 12px' }}>
                              <FormAcao acao={salvarColaborador}>
                                <div className="campos" style={{ flexWrap: 'nowrap' }}>
                                  <input type="hidden" name="id" value={c.id} />
                                  <input type="text" name="nome" defaultValue={c.nome} aria-label="Nome" style={{ width: 220 }} />
                                  <select name="grupo_id" defaultValue={c.grupo_id} aria-label="Equipe" style={{ width: 230 }}>
                                    {opcoesGrupo.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                                  </select>
                                  <input type="text" name="peso" defaultValue={String(c.peso).replace('.', ',')} aria-label="Peso" style={{ width: 64, textAlign: 'right' }} />
                                  <input type="date" name="data_admissao" defaultValue={c.data_admissao || ''} aria-label="Data de admissão" />
                                  <span style={{ minWidth: 150, fontSize: 13.5 }}><TempoCasa admissao={c.data_admissao} /></span>
                                  <button className="btn btn-sec btn-peq" type="submit">Salvar</button>
                                </div>
                              </FormAcao>
                            </td>
                            <td>
                              {c.ativo ? (
                                <details className="recolhivel desligar">
                                  <summary className="texto-perigo">Desligar</summary>
                                  <FormAcao acao={alternarColaborador}>
                                    <div className="campos" style={{ flexWrap: 'nowrap', marginTop: 6 }}>
                                      <input type="hidden" name="id" value={c.id} />
                                      <input type="hidden" name="ativar" value="0" />
                                      <input type="date" name="data_desligamento" defaultValue={hoje} required aria-label="Data de desligamento" />
                                      <button className="btn btn-perigo btn-peq" type="submit">Confirmar</button>
                                    </div>
                                  </FormAcao>
                                </details>
                              ) : (
                                <FormAcao acao={alternarColaborador} confirmar={`Reativar ${c.nome}? A data de desligamento será apagada.`}>
                                  <input type="hidden" name="id" value={c.id} />
                                  <input type="hidden" name="ativar" value="1" />
                                  <span className="nome-sub" style={{ marginBottom: 4 }}>{c.data_desligamento ? `desligado em ${fmtData(c.data_desligamento, true)}` : 'inativo'}</span>
                                  <button className="btn btn-sec btn-peq" type="submit">Reativar</button>
                                </FormAcao>
                              )}
                            </td>
                          </>
                        ) : (
                          <><td>{c.nome}{!c.ativo && <span className="nome-sub">{c.data_desligamento ? `desligado em ${fmtData(c.data_desligamento, true)}` : 'inativo'}</span>}</td><td>{String(c.peso).replace('.', ',')}</td><td className="esq"><TempoCasa admissao={c.data_admissao} comData /></td></>
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
