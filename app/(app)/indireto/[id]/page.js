import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { exigirSessao, podeVerIndireto, podeEditarIndireto, ehAdmin } from '@/lib/auth';
import { hojeSP } from '@/lib/datas';
import { fmtData } from '@/lib/formato';
import { STATUS_PARCEIRO, TIPOS_TREINAMENTO, STATUS_TREINAMENTO, ROTULO_SITUACAO, situacaoTreinamento, fmtCnpj } from '@/lib/indireto';
import FormAcao from '@/components/FormAcao';
import FormParceiro from '@/components/FormParceiro';
import { criarTreinamento, atualizarTreinamento, excluirTreinamento, criarApontamento, excluirApontamento, excluirParceiro } from '@/app/actions/indireto';
import { listarFocais, nomesDosPerfis } from '../dados';

const dataHora = (iso) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

export default async function Parceiro({ params }) {
  const { id } = await params;
  const { supabase, perfil } = await exigirSessao();
  if (!podeVerIndireto(perfil)) redirect('/');
  const editar = podeEditarIndireto(perfil);
  const admin = ehAdmin(perfil);
  const hoje = hojeSP();

  const [{ data: p }, { data: treinos = [] }, { data: apont = [] }, nomes, focais] = await Promise.all([
    supabase.from('parceiros').select('*').eq('id', id).maybeSingle(),
    supabase.from('parceiro_treinamentos').select('*').eq('parceiro_id', id).order('data', { ascending: false }),
    supabase.from('parceiro_apontamentos').select('*').eq('parceiro_id', id).order('criado_em', { ascending: false }),
    nomesDosPerfis(supabase),
    listarFocais(supabase),
  ]);
  if (!p) notFound();

  const info = [
    ['Razão social', p.razao_social],
    ['CNPJ', p.cnpj && fmtCnpj(p.cnpj)],
    ['Código / PDV', p.codigo],
    ['Ponto focal', p.ponto_focal_id && nomes.get(p.ponto_focal_id)],
    ['Início da parceria', p.data_inicio && fmtData(p.data_inicio, true)],
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
            <span className={`tag ${p.status === 'ativo' ? 'tag-ok' : p.status === 'onboarding' ? 'tag-acento' : ''}`}>{STATUS_PARCEIRO[p.status]}</span>{' '}
            {[p.cnpj && fmtCnpj(p.cnpj), [p.cidade, p.uf].filter(Boolean).join('/'), p.ponto_focal_id && `ponto focal: ${nomes.get(p.ponto_focal_id)}`].filter(Boolean).join(', ')}
          </p>
        </div>
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
            <div style={{ marginTop: 14 }}><FormParceiro parceiro={p} focais={focais} /></div>
          </details>
        ) : (
          <dl className="bloco ficha">
            {info.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || '—'}</dd></div>)}
          </dl>
        )}
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
