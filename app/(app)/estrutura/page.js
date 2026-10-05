import Link from 'next/link';
import { exigirSessao, podeEditar } from '@/lib/auth';
import { carregarEstrutura } from '@/lib/dados';
import FormAcao from '@/components/FormAcao';
import TempoCasa from '@/components/TempoCasa';
import { hojeSP } from '@/lib/datas';
import { fmtData } from '@/lib/formato';
import { normalizar, capitalizar } from '@/lib/nomes';
import { criarGrupo, salvarGrupo, alternarGrupo, criarColaborador, salvarColaborador, alternarColaborador } from '@/app/actions/dados';

const COTAS = [['1', 'Cota cheia'], ['0.5', 'Meia cota'], ['0', 'Sem meta']];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// Seleção da cota (peso) com nomes fáceis; valores diferentes continuam possíveis em "Outro"
function CampoCota({ valor = 1 }) {
  const v = String(Number(valor));
  const padrao = COTAS.some(([k]) => k === v);
  return (
    <label className="campo">Cota da meta
      <select name="peso" defaultValue={padrao ? v : v}>
        {COTAS.map(([k, r]) => <option key={k} value={k}>{r}</option>)}
        {!padrao && <option value={v}>Outra ({v.replace('.', ',')})</option>}
      </select>
    </label>
  );
}

export default async function Estrutura({ searchParams }) {
  const sp = await searchParams;
  const { supabase, perfil } = await exigirSessao();
  const editar = podeEditar(perfil);
  const hoje = hojeSP();
  const mes = hoje.slice(0, 7);
  const est = await carregarEstrutura(supabase);
  const aba = sp.aba === 'equipes' ? 'equipes' : 'pessoas';
  const todos = est.achatar(null, 0, false);
  const caminho = (id) => est.caminho(id).map((g) => g.nome);
  const nomeCompleto = (id) => caminho(id).join(' / ');
  const opcoesGrupo = todos.filter((g) => g.ativo).map((g) => ({ id: g.id, nome: nomeCompleto(g.id), nivel: g.nivel }));

  const Abas = () => (
    <div className="topo">
      <div>
        <h1>Equipes e colaboradores</h1>
        <p className="sub">{aba === 'pessoas' ? 'Admita, transfira e desligue colaboradores. A meta de cada equipe é dividida entre os colaboradores dela.' : 'Organize canais, unidades e equipes em níveis.'}</p>
      </div>
      <div className="alternar-visao">
        <Link href="/estrutura" className={aba === 'pessoas' ? 'ativo' : ''}>Pessoas</Link>
        <Link href="/estrutura?aba=equipes" className={aba === 'equipes' ? 'ativo' : ''}>Estrutura das equipes</Link>
      </div>
    </div>
  );

  // =================== ESTRUTURA DAS EQUIPES ===================
  if (aba === 'equipes') {
    return (
      <>
        <Abas />
        {editar && (
          <FormAcao acao={criarGrupo} className="bloco">
            <h3 style={{ marginBottom: 10 }}>Novo canal, unidade ou equipe</h3>
            <div className="campos">
              <label className="campo">Nome<input type="text" name="nome" required placeholder="ex.: Equipe Hunter" /></label>
              <label className="campo">Fica dentro de
                <select name="parent_id" defaultValue="">
                  <option value="">Nenhum (é um canal)</option>
                  {opcoesGrupo.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              </label>
              <button className="btn" type="submit">Criar</button>
            </div>
          </FormAcao>
        )}
        <div className="tabela-wrap" style={{ marginTop: 16 }}>
          <table>
            <thead><tr><th>Canal / unidade / equipe</th><th>Pessoas ativas</th>{editar && <th></th>}</tr></thead>
            <tbody>
              {todos.map((g) => {
                const ativos = est.colaboradores.filter((c) => c.grupo_id === g.id && c.ativo).length;
                return (
                  <tr key={g.id} className={`nivel-${Math.min(g.nivel, 3)}${g.nivel === 0 ? ' linha-grupo' : ''}${g.ativo ? '' : ' inativo'}`}>
                    <td>
                      {g.nome}{!g.ativo && <span className="nome-sub">inativa</span>}
                      {editar && (
                        <details className="recolhivel" style={{ marginTop: 4 }}>
                          <summary>Editar</summary>
                          <div className="bloco" style={{ marginTop: 6, whiteSpace: 'normal' }}>
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
                                <button className="btn btn-sec" type="submit">Salvar</button>
                              </div>
                            </FormAcao>
                            <FormAcao acao={alternarGrupo} confirmar={g.ativo ? `Inativar ${g.nome}? Ela some do painel, mas o histórico fica guardado.` : undefined}>
                              <input type="hidden" name="id" value={g.id} />
                              <input type="hidden" name="ativar" value={g.ativo ? '0' : '1'} />
                              <button className={g.ativo ? 'btn btn-perigo btn-peq' : 'btn btn-sec btn-peq'} type="submit" style={{ marginTop: 10 }}>{g.ativo ? 'Inativar equipe' : 'Reativar equipe'}</button>
                            </FormAcao>
                          </div>
                        </details>
                      )}
                    </td>
                    <td>{ativos || <span className="fraco">—</span>}</td>
                    {editar && <td><Link href={`/estrutura?equipe=${g.id}`} className="dica">ver pessoas</Link></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  // =================== PESSOAS ===================
  const situacao = ['ativos', 'desligados', 'todos'].includes(sp.situacao) ? sp.situacao : 'ativos';
  const busca = normalizar(sp.q || '');
  const equipe = sp.equipe && est.porId.has(sp.equipe) ? sp.equipe : '';
  const idsEquipe = equipe ? new Set(est.subarvore(equipe)) : null;
  const lista = est.colaboradores.filter((c) => {
    if (situacao === 'ativos' && !c.ativo) return false;
    if (situacao === 'desligados' && c.ativo) return false;
    if (idsEquipe && !idsEquipe.has(c.grupo_id)) return false;
    if (busca && !normalizar(c.nome).includes(busca)) return false;
    return true;
  });
  const porEquipe = todos.map((g) => ({ g, pessoas: lista.filter((c) => c.grupo_id === g.id) })).filter((x) => x.pessoas.length);
  const ativosHoje = est.colaboradores.filter((c) => c.ativo).length;
  const admitidosMes = est.colaboradores.filter((c) => (c.data_admissao || '').startsWith(mes)).length;
  const desligadosMes = est.colaboradores.filter((c) => (c.data_desligamento || '').startsWith(mes)).length;
  const nomeMes = MESES[Number(mes.slice(5)) - 1];
  const filtrando = sp.q || equipe || situacao !== 'ativos';

  return (
    <>
      <Abas />

      <div className="hc-cartoes pessoas-cartoes">
        <div className="hc-cartao"><span>Ativos hoje</span><b>{ativosHoje}</b></div>
        <div className="hc-cartao hc-mais"><span>Admitidos em {nomeMes}</span><b>+{admitidosMes}</b></div>
        <div className="hc-cartao hc-menos"><span>Desligados em {nomeMes}</span><b>−{desligadosMes}</b></div>
      </div>

      {editar && (
        <details className="bloco admitir" open={sp.admitir === '1' || !est.colaboradores.length}>
          <summary><span className="admitir-mais">+</span> Admitir colaborador</summary>
          <FormAcao acao={criarColaborador}>
            <div className="campos" style={{ marginTop: 12 }}>
              <label className="campo" style={{ flex: '1 1 240px' }}>Nome completo<textarea name="nome" rows={2} required placeholder="Um nome por linha para admitir várias pessoas de uma vez" /></label>
              <label className="campo">Equipe
                <select name="grupo_id" required defaultValue={equipe}>
                  <option value="" disabled>Escolha a equipe</option>
                  {opcoesGrupo.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              </label>
              <label className="campo">Data de admissão<input type="date" name="data_admissao" defaultValue={hoje} required /></label>
              <CampoCota valor={1} />
              <button className="btn" type="submit">Admitir</button>
            </div>
            <p className="dica" style={{ marginTop: 8 }}>Quem entra no meio do mês recebe a meta proporcional aos dias úteis automaticamente. Use "Meia cota" só para casos especiais (ex.: meio período).</p>
          </FormAcao>
        </details>
      )}

      <form method="get" className="filtro-pessoas">
        <input type="text" name="q" defaultValue={sp.q || ''} placeholder="Buscar pelo nome" aria-label="Buscar pelo nome" />
        <select name="equipe" defaultValue={equipe} aria-label="Equipe">
          <option value="">Todas as equipes</option>
          {opcoesGrupo.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
        </select>
        <select name="situacao" defaultValue={situacao} aria-label="Situação">
          <option value="ativos">Ativos</option>
          <option value="desligados">Desligados</option>
          <option value="todos">Todos</option>
        </select>
        <button className="btn btn-sec" type="submit">Filtrar</button>
        {filtrando && <Link href="/estrutura" className="dica">Limpar</Link>}
      </form>

      {!porEquipe.length && <div className="vazio"><h2>Ninguém encontrado</h2><p>Mude o filtro ou admita um colaborador.</p></div>}

      {porEquipe.map(({ g, pessoas }) => (
        <section key={g.id} className="pessoas-equipe">
          <h2 className="pessoas-titulo">
            {caminho(g.id).map((n, i, arr) => <span key={i} className={i === arr.length - 1 ? 'ultimo' : ''}>{i > 0 && <i>›</i>}{n}</span>)}
            <span className="tag">{pessoas.length}</span>
          </h2>
          <ul className="pessoas-lista">
            {pessoas.map((c) => (
              <li key={c.id} className={c.ativo ? '' : 'desligado'}>
                <div className="pessoa-linha">
                  {c.foto_url ? <img src={c.foto_url} alt="" className="pessoa-avatar" /> : <span className="pessoa-avatar">{c.nome.trim().charAt(0).toUpperCase()}</span>}
                  <div className="pessoa-info">
                    <strong>{capitalizar(c.nome)}</strong>
                    <span>
                      {c.ativo
                        ? c.data_admissao ? <>Admitido em {fmtData(c.data_admissao, true)}, <TempoCasa admissao={c.data_admissao} /></> : <span className="fraco">Sem data de admissão</span>
                        : <span className="txt-risco">Desligado em {c.data_desligamento ? fmtData(c.data_desligamento, true) : '—'}</span>}
                      {Number(c.peso) !== 1 && <span className="tag" style={{ marginLeft: 6 }}>{Number(c.peso) === 0 ? 'sem meta' : Number(c.peso) === 0.5 ? 'meia cota' : `cota ${String(c.peso).replace('.', ',')}`}</span>}
                    </span>
                  </div>
                  {editar && (
                    <div className="pessoa-acoes">
                      <details className="acao-pessoa">
                        <summary>Editar</summary>
                        <div className="acao-painel">
                          <FormAcao acao={salvarColaborador}>
                            <input type="hidden" name="id" value={c.id} />
                            <div className="campos">
                              <label className="campo" style={{ flex: '1 1 220px' }}>Nome<input type="text" name="nome" defaultValue={c.nome} required /></label>
                              <label className="campo">Equipe (para transferir)
                                <select name="grupo_id" defaultValue={c.grupo_id}>
                                  {todos.map((o) => <option key={o.id} value={o.id}>{nomeCompleto(o.id)}</option>)}
                                </select>
                              </label>
                              <label className="campo">Data de admissão<input type="date" name="data_admissao" defaultValue={c.data_admissao || ''} /></label>
                              <CampoCota valor={c.peso} />
                              <button className="btn btn-sec" type="submit">Salvar</button>
                            </div>
                          </FormAcao>
                        </div>
                      </details>
                      {c.ativo ? (
                        <details className="acao-pessoa acao-desligar">
                          <summary>Desligar</summary>
                          <div className="acao-painel">
                            <FormAcao acao={alternarColaborador} confirmar={`Confirmar o desligamento de ${capitalizar(c.nome)}?`}>
                              <input type="hidden" name="id" value={c.id} />
                              <input type="hidden" name="ativar" value="0" />
                              <div className="campos">
                                <label className="campo">Data de desligamento<input type="date" name="data_desligamento" defaultValue={hoje} required /></label>
                                <button className="btn btn-perigo" type="submit">Confirmar desligamento</button>
                              </div>
                              <p className="dica" style={{ marginTop: 6 }}>Os resultados continuam no histórico dos meses em que a pessoa trabalhou.</p>
                            </FormAcao>
                          </div>
                        </details>
                      ) : (
                        <FormAcao acao={alternarColaborador} confirmar={`Reativar ${capitalizar(c.nome)}? A data de desligamento será apagada.`}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="ativar" value="1" />
                          <button className="btn btn-sec btn-peq" type="submit">Reativar</button>
                        </FormAcao>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
