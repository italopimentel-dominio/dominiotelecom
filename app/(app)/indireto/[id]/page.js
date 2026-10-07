import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { exigirSessao, podeVerIndireto, podeEditarIndireto, podeValidarIndireto, ehAdmin } from '@/lib/auth';
import { hojeSP } from '@/lib/datas';
import { fmtData } from '@/lib/formato';
import { classeStatus, situacaoAtivacao, ROTULO_ATIVACAO, ativacaoTravada, TIPOS_TREINAMENTO, STATUS_TREINAMENTO, ROTULO_SITUACAO, VALIDACAO, CAMPOS_HISTORICO, situacaoTreinamento, documentoDe, fmtCnpj, fmtCpf } from '@/lib/indireto';
import FormAcao from '@/components/FormAcao';
import FormParceiro from '@/components/FormParceiro';
import LinksFormulario from '@/components/LinksFormulario';
import { criarTreinamento, atualizarTreinamento, excluirTreinamento, criarApontamento, excluirApontamento, excluirParceiro, validarParceiro } from '@/app/actions/indireto';
import { listarFocais, nomesDosPerfis, listarStatus } from '../dados';

const dataHora = (iso) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

export default async function Parceiro({ params }) {
  const { id } = await params;
  const { supabase, perfil } = await exigirSessao();
  if (!podeVerIndireto(perfil)) redirect('/');
  const editar = podeEditarIndireto(perfil);
  const admin = ehAdmin(perfil);
  const validador = podeValidarIndireto(perfil);
  const hoje = hojeSP();

  const [{ data: p }, { data: treinos = [] }, { data: apont = [] }, nomes, focais, { data: respostas = [] }, { data: historico = [] }, statusLista] = await Promise.all([
    supabase.from('parceiros').select('*').eq('id', id).maybeSingle(),
    supabase.from('parceiro_treinamentos').select('*').eq('parceiro_id', id).order('data', { ascending: false }),
    supabase.from('parceiro_apontamentos').select('*').eq('parceiro_id', id).order('criado_em', { ascending: false }),
    nomesDosPerfis(supabase),
    listarFocais(supabase),
    supabase.from('parceiro_respostas_form').select('*').eq('parceiro_id', id).order('respondido_em', { ascending: false }),
    supabase.from('parceiro_historico').select('*').eq('parceiro_id', id).order('em', { ascending: false }).limit(300),
    listarStatus(supabase),
  ]);
  const { data: linksAbertos } = await supabase.from('form_links').select('token, tipo, expira_em')
    .eq('parceiro_id', id).is('respondido_em', null).gt('expira_em', new Date().toISOString());
  if (!p) notFound();
  const statusPor = new Map(statusLista.map((st) => [st.chave, st]));
  const st = statusPor.get(p.status);
  const ativ = situacaoAtivacao(p, hoje);

  const valorHist = (campo, v) => {
    if (v === null || v === undefined || v === '') return '—';
    if (campo === 'status') return statusPor.get(v)?.nome || v;
    if (campo === 'validacao') return VALIDACAO[v]?.texto || v;
    if (campo === 'ponto_focal_id') return nomes.get(v) || 'usuário removido';
    if (campo === 'cnpj') return fmtCnpj(v);
    if (campo === 'cpf') return fmtCpf(v);
    if (campo === 'form_respondido_em') return dataHora(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return fmtData(v, true);
    return v;
  };
  const quemHist = (h) => (h.origem === 'formulario' ? 'Formulário Google' : h.usuario_id ? nomes.get(h.usuario_id) || 'Usuário removido' : 'Sistema');

  const info = [
    ['Razão social', p.razao_social],
    [p.cpf ? 'CPF' : 'CNPJ', documentoDe(p)],
    ['Código / PDV', p.codigo],
    ['Ponto focal', p.ponto_focal_id && nomes.get(p.ponto_focal_id)],
    ['Início da parceria', p.data_inicio && fmtData(p.data_inicio, true)],
    ['Data de ativação', p.data_ativacao && `${fmtData(p.data_ativacao, true)}${ativacaoTravada(p, hoje) ? ' 🔒' : ''}`],
    ['Prazo para vender (30 dias)', ativ && `até ${fmtData(ativ.prazo, true)}`],
    ['Venda vinculada', p.venda_mes && `${p.venda_produto || 'venda'} em ${p.venda_mes.slice(5)}/${p.venda_mes.slice(0, 4)} (${p.venda_qtd ?? '—'}${p.venda_valor ? `, R$ ${Number(p.venda_valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''})`],
    ['Cidade', [p.cidade, p.uf].filter(Boolean).join('/')],
    ['Endereço', p.endereco],
    ['Contato', p.contato_nome],
    ['Telefone', p.contato_telefone],
    ['E-mail', p.contato_email],
    ['Observações', p.observacoes],
  ];

  return (
    <>
      <div className="topo">
        <div>
          <p className="dica"><Link href="/indireto">Controle Indireto</Link></p>
          <h1 style={{ marginTop: 6 }}>{p.nome_fantasia}</h1>
          <p className="sub">
            <span className={`tag ${classeStatus(st)}`}>{st?.nome || p.status}</span>{' '}
            {ativ && <><span className={`tag ${ROTULO_ATIVACAO[ativ.estado].classe}`}>{ROTULO_ATIVACAO[ativ.estado].texto}</span>{' '}</>}
            {[documentoDe(p), p.data_ativacao && `ativado em ${fmtData(p.data_ativacao, true)}`, [p.cidade, p.uf].filter(Boolean).join('/'), p.ponto_focal_id && `ponto focal: ${nomes.get(p.ponto_focal_id)}`].filter(Boolean).join(', ')}
          </p>
        </div>
      </div>

      <div className={`validacao validacao-${p.validacao}`}>
        <div>
          <span className={`tag ${VALIDACAO[p.validacao].classe}`}>{VALIDACAO[p.validacao].texto}</span>
          <p style={{ marginTop: 6 }}>
            {p.validacao === 'pendente' && (validador ? 'Confira os dados cadastrais abaixo e aprove ou reprove.' : 'O gerente ainda precisa validar este cadastro.')}
            {p.validacao === 'aprovado' && (p.validacao_automatica
              ? `Validado automaticamente em ${p.validado_em ? dataHora(p.validado_em) : '—'}: o parceiro respondeu o formulário de treinamento.`
              : `Validado por ${nomes.get(p.validado_por) || 'gerente'} em ${p.validado_em ? dataHora(p.validado_em) : '—'}.`)}
            {p.validacao === 'reprovado' && <>Reprovado por {nomes.get(p.validado_por) || 'gerente'}: <strong>{p.validacao_motivo}</strong>. {editar && 'Corrija os dados e salve para enviar de novo.'}</>}
          </p>
          {editar && !validador && p.validacao === 'aprovado' && <p className="dica" style={{ marginTop: 4 }}>Se você alterar os dados cadastrais, o cadastro volta para validação.</p>}
        </div>
        {validador && (
          <div className="validacao-acoes">
            {p.validacao !== 'aprovado' && (
              <FormAcao acao={validarParceiro}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="decisao" value="aprovado" />
                <button className="btn btn-peq" type="submit">Aprovar cadastro</button>
              </FormAcao>
            )}
            {p.validacao === 'aprovado' && (
              <FormAcao acao={validarParceiro} confirmar="Desfazer a validação? O cadastro volta para Aguardando validação.">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="decisao" value="pendente" />
                <button className="btn btn-sec btn-peq" type="submit">Desvalidar</button>
              </FormAcao>
            )}
            {p.validacao !== 'reprovado' && (
              <FormAcao acao={validarParceiro} className="validacao-reprovar">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="decisao" value="reprovado" />
                <input type="text" name="motivo" required placeholder="Motivo da reprovação" aria-label="Motivo da reprovação" />
                <button className="btn btn-perigo btn-peq" type="submit">Reprovar</button>
              </FormAcao>
            )}
          </div>
        )}
      </div>

      <div className="cartoes">
        {Object.entries(TIPOS_TREINAMENTO).map(([tipo, nome]) => {
          const s = situacaoTreinamento(treinos || [], tipo, hoje);
          return (
            <div key={tipo} className={`cartao cartao-${s.estado}`}>
              <h3>Treinamento de {nome.toLowerCase()}</h3>
              <span className={`tag ${ROTULO_SITUACAO[s.estado].classe}`}>{ROTULO_SITUACAO[s.estado].texto}</span>
              <p className="det">
                {s.estado === 'realizado' && `Realizado em ${fmtData(s.data, true)}`}
                {s.estado === 'agendado' && `Agendado para ${fmtData(s.data, true)}`}
                {s.estado === 'atrasado' && `Estava agendado para ${fmtData(s.data, true)}. Atualize o status.`}
                {s.estado === 'pendente' && 'Nenhum treinamento registrado.'}
              </p>
            </div>
          );
        })}
      </div>

      <section className="secao">
        <h2 style={{ marginBottom: 10 }}>Formulário de treinamento</h2>
        <LinksFormulario parceiroId={p.id} nome={p.contato_nome || p.nome_fantasia} telefone={p.contato_telefone} links={linksAbertos || []} podeEditar={editar} />
        {respostas?.length ? (
          <div className="tabela-wrap">
            <table>
              <thead><tr><th>Respondido em</th><th className="esq">Formulário</th><th className="esq">Treinamento</th><th className="esq">Respostas</th></tr></thead>
              <tbody>
                {respostas.map((r) => (
                  <tr key={r.id}>
                    <td>{dataHora(r.respondido_em)}</td>
                    <td className="esq">{r.formulario || '—'}</td>
                    <td className="esq">
                      {TIPOS_TREINAMENTO[r.tipo_treinamento]}
                      {r.total_pontuavel ? <span className="nome-sub">acertou {r.acertos} de {r.total_pontuavel}</span> : null}
                    </td>
                    <td className="esq" style={{ whiteSpace: 'normal' }}>
                      <details className="recolhivel">
                        <summary>Ver respostas</summary>
                        <dl className="ficha" style={{ marginTop: 8 }}>
                          {Object.entries(r.respostas || {}).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{String(v)}</dd></div>)}
                        </dl>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="dica">O parceiro ainda não respondeu nenhum formulário. Cada resposta marca o treinamento como realizado; o cadastro é validado sozinho quando todo treinamento realizado tem formulário e há venda vinculada.</p>}
      </section>

      <section className="secao">
        <h2 style={{ marginBottom: 10 }}>Treinamentos</h2>
        {editar && (
          <FormAcao acao={criarTreinamento} className="bloco">
            <input type="hidden" name="parceiro_id" value={id} />
            <div className="campos">
              <label className="campo">Tipo
                <select name="tipo" required defaultValue="">
                  <option value="" disabled>Escolha</option>
                  {Object.entries(TIPOS_TREINAMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="campo">Data<input type="date" name="data" required defaultValue={hoje} /></label>
              <label className="campo">Status
                <select name="status" defaultValue="agendado">
                  {Object.entries(STATUS_TREINAMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="campo">Quem aplicou / vai aplicar<input type="text" name="instrutor" /></label>
              <label className="campo" style={{ flex: '1 1 220px' }}>Observação<input type="text" name="observacao" /></label>
              <button className="btn" type="submit">Registrar</button>
            </div>
          </FormAcao>
        )}
        {treinos?.length ? (
          <div className="tabela-wrap" style={{ marginTop: 10 }}>
            <table>
              <thead><tr><th>Tipo</th><th className="esq">Data e status</th><th className="esq">Quem aplicou</th><th className="esq">Observação</th><th className="esq">Registrado por</th>{editar && <th></th>}</tr></thead>
              <tbody>
                {treinos.map((t) => (
                  <tr key={t.id} className={t.status === 'cancelado' ? 'inativo' : ''}>
                    <td>{TIPOS_TREINAMENTO[t.tipo]}</td>
                    <td className="esq">
                      {editar ? (
                        <FormAcao acao={atualizarTreinamento}>
                          <div className="campos" style={{ flexWrap: 'nowrap' }}>
                            <input type="hidden" name="id" value={t.id} />
                            <input type="date" name="data" defaultValue={t.data} aria-label="Data" />
                            <select name="status" defaultValue={t.status} aria-label="Status">
                              {Object.entries(STATUS_TREINAMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                            <button className="btn btn-sec btn-peq" type="submit">Salvar</button>
                          </div>
                        </FormAcao>
                      ) : <>{fmtData(t.data, true)} <span className="tag">{STATUS_TREINAMENTO[t.status]}</span></>}
                    </td>
                    <td className="esq">{t.instrutor || '—'}</td>
                    <td className="esq" style={{ whiteSpace: 'normal' }}>{t.observacao || '—'}</td>
                    <td className="esq fraco">{nomes.get(t.registrado_por) || '—'}</td>
                    {editar && (
                      <td>
                        <FormAcao acao={excluirTreinamento} confirmar="Excluir este treinamento?">
                          <input type="hidden" name="id" value={t.id} />
                          <button className="btn btn-perigo btn-peq" type="submit">Excluir</button>
                        </FormAcao>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="dica" style={{ marginTop: 10 }}>Nenhum treinamento registrado.</p>}
      </section>

      <section className="secao">
        <h2 style={{ marginBottom: 10 }}>Apontamentos</h2>
        {editar && (
          <FormAcao acao={criarApontamento} className="bloco">
            <input type="hidden" name="parceiro_id" value={id} />
            <label className="campo">Novo apontamento
              <textarea name="texto" rows={3} required placeholder="Ex.: visita feita, parceiro pediu material de fibra, contato mudou de telefone..." />
            </label>
            <button className="btn" type="submit" style={{ marginTop: 10 }}>Registrar apontamento</button>
          </FormAcao>
        )}
        {apont?.length ? (
          <ol className="linha-tempo">
            {apont.map((a) => (
              <li key={a.id}>
                <div className="lt-cab">
                  <strong>{nomes.get(a.autor_id) || 'Usuário removido'}</strong>
                  <span className="dica">{dataHora(a.criado_em)}</span>
                  {editar && (a.autor_id === perfil.id || admin) && (
                    <FormAcao acao={excluirApontamento} confirmar="Apagar este apontamento?">
                      <input type="hidden" name="id" value={a.id} />
                      <button className="lt-apagar" type="submit">apagar</button>
                    </FormAcao>
                  )}
                </div>
                <p>{a.texto}</p>
              </li>
            ))}
          </ol>
        ) : <p className="dica" style={{ marginTop: 10 }}>Nenhum apontamento ainda.</p>}
      </section>

      <section className="secao">
        <h2 style={{ marginBottom: 10 }}>Dados cadastrais</h2>
        {editar ? (
          <details className="bloco">
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Ver e editar os dados de {p.nome_fantasia}</summary>
            <div style={{ marginTop: 14 }}><FormParceiro parceiro={p} focais={focais} statusLista={statusLista} travarAtivacao={!validador && ativacaoTravada(p, hoje)} /></div>
          </details>
        ) : (
          <dl className="bloco ficha">
            {info.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || '—'}</dd></div>)}
          </dl>
        )}
        <details className="recolhivel" style={{ marginTop: 18 }}>
          <summary>Histórico de alterações ({historico?.length || 0})</summary>
          {historico?.length ? (
            <div className="tabela-wrap" style={{ marginTop: 8 }}>
              <table>
                <thead><tr><th>Quando</th><th className="esq">Quem</th><th className="esq">Campo</th><th className="esq">Antes</th><th className="esq">Depois</th></tr></thead>
                <tbody>
                  {historico.map((h) => (
                    <tr key={h.id}>
                      <td>{dataHora(h.em)}</td>
                      <td className="esq">{quemHist(h)}</td>
                      {h.acao === 'criado'
                        ? <td className="esq" colSpan={3}>Cadastro criado</td>
                        : <>
                            <td className="esq">{CAMPOS_HISTORICO[h.campo] || h.campo}</td>
                            <td className="esq fraco" style={{ whiteSpace: 'normal' }}>{valorHist(h.campo, h.antes)}</td>
                            <td className="esq" style={{ whiteSpace: 'normal' }}>{valorHist(h.campo, h.depois)}</td>
                          </>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="dica" style={{ marginTop: 8 }}>Sem alterações registradas. O histórico começa a contar a partir desta atualização.</p>}
        </details>
        {admin && (
          <FormAcao acao={excluirParceiro} confirmar={`Excluir ${p.nome_fantasia} com todos os treinamentos e apontamentos? Não dá para desfazer.`}>
            <input type="hidden" name="id" value={id} />
            <button className="btn btn-perigo btn-peq" type="submit" style={{ marginTop: 14 }}>Excluir parceiro</button>
          </FormAcao>
        )}
      </section>
    </>
  );
}
