import { redirect } from 'next/navigation';
import { exigirSessao, podeEditar } from '@/lib/auth';
import { MODELOS } from '@/lib/fontes';
import { sugerirProduto } from '@/lib/relatorio';
import FormAcao from '@/components/FormAcao';
import FonteDados from '@/components/FonteDados';
import { salvarFonte, excluirFonte, lerFonte, aplicarFonte, desfazerSincronizacao, alternarMesFechado } from '@/app/actions/fontes';

const dataHora = (iso) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

function FormFonte({ f = {}, produtos, botao }) {
  const modelo = MODELOS[f.modelo] || MODELOS.pedidos_movel;
  return (
    <FormAcao acao={salvarFonte}>
      {f.id && <input type="hidden" name="id" value={f.id} />}
      <input type="hidden" name="modelo" value="pedidos_movel" />
      <div className="grade-form">
        <label className="campo">Nome<input type="text" name="nome" defaultValue={f.nome || 'Planilha gerencial móvel'} required /></label>
        <label className="campo campo-largo">Link da planilha do Google<input type="url" name="url" defaultValue={f.url || ''} required placeholder="https://docs.google.com/spreadsheets/d/..." /></label>
        {Object.entries(modelo.destinos).map(([d, rotulo]) => (
          <label key={d} className="campo">{rotulo} da planilha entra em
            <select name={`produto_${d}`} defaultValue={f.config?.[d] || sugerirProduto(rotulo, produtos)}>
              <option value="">Não gravar</option>
              {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </label>
        ))}
      </div>
      <p className="dica" style={{ marginTop: 8 }}>
        Regras: só GRUPO STATUS = EXECUTADO, no mês de MÊS/ANO CONCLUSÃO. Alta = ALTA ou MIGRAÇÃO PRÉ/PÓS; Renovação = RENOVAÇÃO ou RENOVAÇÃO POSITIVA (quantidade em QUANTIDADE LINHAS, receita em VALOR TERMO SMP);
        Aparelhos = QTD APARELHOS e VALOR APARELHO. "NÃO CONTABILIZA" nunca conta. A equipe de cada pessoa vem do sistema, não da planilha.
      </p>
      <button className="btn" type="submit" style={{ marginTop: 10 }}>{botao}</button>
    </FormAcao>
  );
}

export default async function Fontes() {
  const { supabase, perfil } = await exigirSessao();
  if (!podeEditar(perfil)) redirect('/');
  const [{ data: fontes, error }, { data: produtos }, { data: sincs }, { data: periodos }, { data: perfis }] = await Promise.all([
    supabase.from('fontes_dados').select('*').order('criado_em'),
    supabase.from('produtos').select('id, nome, ativo, tipo').order('ordem'),
    supabase.from('sincronizacoes').select('id, fonte_id, url, executado_em, executado_por, meses, resumo, desfeita_em').order('executado_em', { ascending: false }).limit(30),
    supabase.from('periodos').select('*').order('referencia', { ascending: false }).limit(12),
    supabase.from('profiles').select('id, nome, usuario'),
  ]);
  if (error) {
    return <div className="vazio"><h2>Falta preparar o banco</h2><p>Rode o arquivo 017_fonte_dados.sql no Supabase para usar a fonte de dados.</p></div>;
  }
  const prods = (produtos || []).filter((p) => p.ativo && p.tipo !== 'composto');
  const nomePerfil = new Map((perfis || []).map((p) => [p.id, p.nome || p.usuario]));

  return (
    <>
      <div className="topo">
        <div>
          <h1>Fonte de dados</h1>
          <p className="sub">Liga uma planilha do Google ao sistema. Você lê, confere a prévia e só então grava. Toda gravação pode ser desfeita.</p>
        </div>
      </div>

      {(fontes || []).map((f) => (
        <section key={f.id} className="secao bloco fonte-card">
          <div className="linha-acoes" style={{ justifyContent: 'space-between' }}>
            <div>
              <h2>{f.nome}</h2>
              <a href={f.url} target="_blank" rel="noreferrer" className="dica">abrir a planilha ↗</a>
            </div>
          </div>
          <details className="recolhivel" style={{ margin: '10px 0' }}>
            <summary>⚙ Configurar a fonte (link e produtos)</summary>
            <div style={{ marginTop: 8 }}><FormFonte f={f} produtos={prods} botao="Salvar" /></div>
            <FormAcao acao={excluirFonte} confirmar={`Excluir a fonte ${f.nome}? Os resultados já gravados continuam no sistema.`}>
              <input type="hidden" name="id" value={f.id} />
              <button className="btn btn-perigo btn-peq" type="submit" style={{ marginTop: 10 }}>Excluir fonte</button>
            </FormAcao>
          </details>
          <FonteDados fonte={{ id: f.id, url: f.url }} lerFonte={lerFonte} aplicarFonte={aplicarFonte} />

          {(sincs || []).some((x) => x.fonte_id === f.id) && (
            <details className="recolhivel" style={{ marginTop: 14 }}>
              <summary>Registro de gravações</summary>
              <div className="tabela-wrap" style={{ marginTop: 6 }}>
                <table>
                  <thead><tr><th>Quando</th><th className="esq">Quem</th><th className="esq">Meses</th><th>Valores alterados</th><th></th></tr></thead>
                  <tbody>
                    {(sincs || []).filter((x) => x.fonte_id === f.id).map((x, i, arr) => {
                      const ultimaAtiva = arr.find((y) => !y.desfeita_em)?.id === x.id;
                      return (
                        <tr key={x.id} className={x.desfeita_em ? 'inativo' : ''}>
                          <td>{dataHora(x.executado_em)}</td>
                          <td className="esq">{nomePerfil.get(x.executado_por) || '—'}</td>
                          <td className="esq">{(x.meses || []).join(', ')}</td>
                          <td>{x.resumo?.mudancas ?? '—'}</td>
                          <td>
                            {x.desfeita_em ? <span className="tag">desfeita</span> : ultimaAtiva && (
                              <FormAcao acao={desfazerSincronizacao} confirmar="Desfazer esta gravação? Os valores voltam a ser os de antes dela.">
                                <input type="hidden" name="id" value={x.id} />
                                <button className="btn btn-sec btn-peq" type="submit">Desfazer</button>
                              </FormAcao>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </section>
      ))}

      <details className="bloco secao" open={!(fontes || []).length}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>+ Ligar uma planilha</summary>
        <div style={{ marginTop: 12 }}><FormFonte produtos={prods} botao="Cadastrar fonte" /></div>
        <p className="dica" style={{ marginTop: 8 }}>A planilha precisa estar compartilhada como "Qualquer pessoa com o link pode ver". Se o link mudar no mês seguinte, é só colar o novo em Configurar a fonte.</p>
      </details>

      <section className="secao">
        <h2 style={{ marginBottom: 6 }}>Meses fechados</h2>
        <p className="dica" style={{ marginBottom: 10 }}>Feche o mês quando ele terminar: nenhuma leitura de planilha altera um mês fechado, mesmo que a planilha mude ou o link seja reaproveitado.</p>
        <div className="tabela-wrap">
          <table>
            <thead><tr><th>Mês</th><th className="esq">Situação</th><th></th></tr></thead>
            <tbody>
              {(periodos || []).map((p) => (
                <tr key={p.id}>
                  <td>{p.nome}</td>
                  <td className="esq">{p.fechado ? <span className="tag">🔒 fechado</span> : <span className="tag tag-ok">aberto</span>}</td>
                  <td>
                    <FormAcao acao={alternarMesFechado} confirmar={p.fechado ? `Reabrir ${p.nome}?` : `Fechar ${p.nome}? A planilha não poderá mais alterar este mês.`}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="fechar" value={p.fechado ? '0' : '1'} />
                      <button className="btn btn-sec btn-peq" type="submit">{p.fechado ? 'Reabrir' : 'Fechar mês'}</button>
                    </FormAcao>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
