import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirSessao, podeEditar } from '@/lib/auth';
import { fmtValor } from '@/lib/formato';
import { TEMAS } from '@/lib/campanhas';
import { carregarCampanha } from '@/lib/campanhasDados';
import { capitalizar } from '@/lib/nomes';
import PainelCampanha from '@/components/PainelCampanha';
import FormCampanha from '@/components/FormCampanha';
import FormAcao from '@/components/FormAcao';
import CampoNumero from '@/components/CampoNumero';
import { salvarCampanha, excluirCampanha, salvarItem, excluirItem, adicionarParticipantes, removerParticipante, salvarResultadoCampanha } from '@/app/actions/campanhas';

export default async function Campanha({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, perfil } = await exigirSessao();
  const editar = podeEditar(perfil);
  const d = await carregarCampanha(supabase, id);
  if (!d) notFound();
  const { campanha: c, itens, participantes, resultados, calc, colabs, grupos } = d;
  const tema = TEMAS[sp.tema] ? sp.tema : c.tema;
  const valor = new Map(resultados.map((r) => [`${r.participante_id}|${r.item_id}`, Number(r.valor)]));
  const porId = new Map(grupos.map((g) => [g.id, g]));
  const caminho = (gid) => { const l = []; let g = porId.get(gid); while (g) { l.unshift(g.nome); g = porId.get(g.parent_id); } return l.join(' / '); };
  const gruposAtivos = grupos.filter((g) => g.ativo).map((g) => ({ id: g.id, nome: caminho(g.id) })).sort((a, b) => a.nome.localeCompare(b.nome));
  const jaEsta = new Set(participantes.map((p) => p.colaborador_id || p.grupo_id));
  const ordemPart = [...participantes].sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <>
      <div className="topo">
        <div>
          <p className="dica"><Link href="/campanhas">Campanhas</Link></p>
        </div>
        <div className="linha-acoes">
          <div className="alternar-visao">
            {Object.entries(TEMAS).map(([k, t]) => (
              <Link key={k} href={`/campanhas/${id}?tema=${k}`} className={tema === k ? 'ativo' : ''} title={`Ver como ${t.nome}`}>{t.emoji} {t.nome}</Link>
            ))}
          </div>
          <Link href={`/tv/campanha/${id}?tema=${tema}`} target="_blank" className="btn">📺 Modo TV</Link>
        </div>
      </div>

      <PainelCampanha campanha={c} calc={calc} tema={tema} />

      {c.regras && (
        <details className="recolhivel" style={{ marginTop: 12 }}>
          <summary>Regras da campanha</summary>
          <p className="bloco" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{c.regras}</p>
        </details>
      )}

      {editar && (
        <>
          <section className="secao">
            <h2 style={{ marginBottom: 6 }}>Lançar resultados</h2>
            <p className="dica" style={{ marginBottom: 10 }}>Digite o acumulado de cada participante e saia do campo para salvar. O visual atualiza na hora (e no Modo TV, a cada minuto).</p>
            {participantes.length && itens.length ? (
              <div className="tabela-wrap grade-metas">
                <table>
                  <thead><tr><th>{c.participacao === 'equipe' ? 'Equipe' : 'Participante'}</th>{itens.map((it) => <th key={it.id}>{it.nome}<span className="nome-sub">alvo {fmtValor(it.alvo, it.unidade)}{c.modo === 'coletiva' ? ' (total)' : ''}</span></th>)}<th></th></tr></thead>
                  <tbody>
                    {ordemPart.map((p) => (
                      <tr key={p.id}>
                        <td>{p.nomeCompleto}{p.equipe && <span className="nome-sub">{p.equipe}</span>}</td>
                        {itens.map((it) => (
                          <td key={it.id}><CampoNumero rotulo={`${it.nome} de ${p.nome}`} acao={salvarResultadoCampanha.bind(null, p.id, it.id)} valor={valor.has(`${p.id}|${it.id}`) ? valor.get(`${p.id}|${it.id}`) : null} placeholder="0" /></td>
                        ))}
                        <td>
                          <FormAcao acao={removerParticipante} confirmar={`Tirar ${p.nome} da campanha? Os resultados dele(a) serão apagados.`}>
                            <input type="hidden" name="id" value={p.id} />
                            <button type="submit" className="lt-apagar">remover</button>
                          </FormAcao>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="dica">Inclua participantes abaixo para lançar resultados.</p>}
          </section>

          <section className="secao">
            <h2 style={{ marginBottom: 10 }}>Participantes ({participantes.length})</h2>
            <div className="bloco" style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
              <FormAcao acao={adicionarParticipantes}>
                <input type="hidden" name="campanha_id" value={id} />
                <div className="campos">
                  <label className="campo" style={{ flex: '1 1 220px' }}>{c.participacao === 'equipe' ? 'Incluir equipe' : 'Incluir uma equipe inteira'}
                    <select name="grupo_id" defaultValue="" required>
                      <option value="" disabled>Escolha</option>
                      {gruposAtivos.filter((g) => c.participacao !== 'equipe' || !jaEsta.has(g.id)).map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                    </select>
                  </label>
                  <button className="btn btn-sec" type="submit">Incluir</button>
                </div>
                {c.participacao !== 'equipe' && <p className="dica" style={{ marginTop: 6 }}>Inclui todos os colaboradores ativos da equipe e das equipes abaixo dela.</p>}
              </FormAcao>
              {c.participacao !== 'equipe' && (
                <FormAcao acao={adicionarParticipantes}>
                  <input type="hidden" name="campanha_id" value={id} />
                  <div className="campos">
                    <label className="campo" style={{ flex: '1 1 220px' }}>Incluir uma pessoa
                      <select name="colaborador_id" defaultValue="" required>
                        <option value="" disabled>Escolha</option>
                        {colabs.filter((x) => x.ativo && !jaEsta.has(x.id)).sort((a, b) => a.nome.localeCompare(b.nome)).map((x) => <option key={x.id} value={x.id}>{capitalizar(x.nome)}</option>)}
                      </select>
                    </label>
                    <button className="btn btn-sec" type="submit">Incluir</button>
                  </div>
                </FormAcao>
              )}
            </div>
          </section>

          <section className="secao">
            <h2 style={{ marginBottom: 10 }}>Itens e alvos</h2>
            <div className="tabela-wrap">
              <table>
                <thead><tr><th>Item</th><th></th></tr></thead>
                <tbody>
                  {itens.map((it) => (
                    <tr key={it.id}>
                      <td>
                        <FormAcao acao={salvarItem}>
                          <div className="campos" style={{ flexWrap: 'nowrap' }}>
                            <input type="hidden" name="id" value={it.id} />
                            <input type="text" name="nome" defaultValue={it.nome} aria-label="Nome" style={{ width: 200 }} />
                            <input type="text" name="alvo" defaultValue={String(it.alvo).replace('.', ',')} aria-label="Alvo" style={{ width: 90 }} />
                            <select name="unidade" defaultValue={it.unidade} aria-label="Medida"><option value="qtd">quantidade</option><option value="brl">R$</option></select>
                            <input type="number" name="ordem" defaultValue={it.ordem} aria-label="Ordem" style={{ width: 64 }} />
                            <button className="btn btn-sec btn-peq" type="submit">Salvar</button>
                          </div>
                        </FormAcao>
                      </td>
                      <td>
                        <FormAcao acao={excluirItem} confirmar={`Excluir ${it.nome}? Os resultados lançados nele serão apagados.`}>
                          <input type="hidden" name="id" value={it.id} />
                          <button className="btn btn-perigo btn-peq" type="submit">Excluir</button>
                        </FormAcao>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <FormAcao acao={salvarItem} className="bloco" >
              <input type="hidden" name="campanha_id" value={id} />
              <div className="campos" style={{ marginTop: 4 }}>
                <label className="campo">Novo item<input type="text" name="nome" required placeholder="ex.: Combos" /></label>
                <label className="campo">Alvo<input type="text" name="alvo" required style={{ width: 90 }} /></label>
                <label className="campo">Medida<select name="unidade"><option value="qtd">quantidade</option><option value="brl">R$</option></select></label>
                <input type="hidden" name="ordem" value={itens.length} />
                <button className="btn" type="submit">Incluir item</button>
              </div>
            </FormAcao>
          </section>

          <section className="secao">
            <details className="recolhivel">
              <summary>Editar dados da campanha</summary>
              <div className="bloco" style={{ marginTop: 8 }}><FormCampanha acao={salvarCampanha} c={c} botao="Salvar campanha" /></div>
            </details>
            <FormAcao acao={excluirCampanha} confirmar={`Excluir a campanha ${c.nome} com todos os resultados? Não dá para desfazer.`}>
              <input type="hidden" name="id" value={id} />
              <button className="btn btn-perigo btn-peq" type="submit" style={{ marginTop: 14 }}>Excluir campanha</button>
            </FormAcao>
          </section>
        </>
      )}
    </>
  );
}
