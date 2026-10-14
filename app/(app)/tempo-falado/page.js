import Link from 'next/link';
import { exigirSessao, podeEditar } from '@/lib/auth';
import { hojeSP } from '@/lib/datas';
import { hms } from '@/lib/tempoFalado';
import ImportarTempoFalado from '@/components/ImportarTempoFalado';
import BaixarTempoFalado from '@/components/BaixarTempoFalado';
import FormAcao from '@/components/FormAcao';
import { excluirMesTempoFalado } from '@/app/actions/tempoFalado';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const rotMes = (m) => `${MESES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const NIVEIS = ['Canal', 'Unidade', 'Coordenação', 'Equipe', 'Nível 5', 'Nível 6'];

// soma de um conjunto de pessoas: média por dia = falando ÷ dias; TMA = falando ÷ ligações
function resumo(lista) {
  const falando = lista.reduce((s, l) => s + l.falando, 0);
  const dias = lista.reduce((s, l) => s + l.dias, 0);
  const lig = lista.reduce((s, l) => s + l.ligacoes, 0);
  return { pessoas: lista.length, falando, media: dias ? falando / dias : 0, tma: lig ? falando / lig : 0, alertas: lista.filter((l) => (l.alertas || []).length).length };
}

export default async function TempoFalado({ searchParams }) {
  const sp = await searchParams;
  const { perfil, supabase } = await exigirSessao();
  const editor = podeEditar(perfil);
  const [meses, { data: grupos }, { data: colabs }, apel] = await Promise.all([
    supabase.from('tempo_falado').select('mes').order('mes', { ascending: false }).limit(5000),
    supabase.from('grupos').select('id, nome, parent_id, ordem'),
    supabase.from('colaboradores').select('id, nome, grupo_id, ativo'),
    editor ? supabase.from('colaborador_apelidos').select('apelido, colaborador_id') : Promise.resolve({ data: [] }),
  ]);
  if (meses.error) return <><div className="topo"><h1>Tempo falado</h1></div><p className="msg msg-erro">Rode o arquivo 028_tempo_falado.sql no Supabase.</p></>;
  const lista = [...new Set((meses.data || []).map((m) => m.mes))];
  const mes = lista.includes(sp.mes) ? sp.mes : lista[0];
  const { data: linhas = [] } = mes ? await supabase.from('tempo_falado').select('*').eq('mes', mes).order('falando', { ascending: false }) : { data: [] };

  // equipes: cadeia de cada colaborador no organograma (canal → … → equipe)
  const porId = new Map((grupos || []).map((g) => [g.id, g]));
  const cadeia = (id) => { const l = []; let g = porId.get(id); while (g) { l.unshift(g); g = porId.get(g.parent_id); } return l; };
  const grupoDe = new Map((colabs || []).map((c) => [c.id, c.grupo_id]));
  const pessoas = (linhas || []).map((l) => {
    const cad = cadeia(grupoDe.get(l.colaborador_id));
    return { ...l, cadeia: cad, equipe: cad.map((g) => g.nome).join(' / '), equipeCurta: cad.at(-1)?.nome || '' };
  });
  const profundidade = Math.max(1, ...pessoas.map((p) => p.cadeia.length));
  const nivel = Math.min(Math.max(1, Number(sp.nivel) || profundidade), profundidade);

  // cartões: grupos do nível escolhido (quem não chega nesse nível fica no último grupo dele)
  const chaveNivel = (p) => (p.cadeia.length ? p.cadeia[Math.min(nivel, p.cadeia.length) - 1].id : 'sem');
  const cartoes = [...pessoas.reduce((m, p) => { const k = chaveNivel(p); (m.get(k) || m.set(k, []).get(k)).push(p); return m; }, new Map()).entries()]
    .map(([id, ps]) => ({ id, nome: id === 'sem' ? 'Sem equipe (não vinculados)' : porId.get(id)?.nome, caminho: id === 'sem' ? '' : cadeia(id).map((g) => g.nome).join(' / '), ...resumo(ps) }))
    .sort((a, b) => b.media - a.media);
  const maxMedia = Math.max(1, ...cartoes.map((c) => c.media));

  const filtroGrupo = sp.grupo || '';
  const filtradas = pessoas.filter((p) => (!filtroGrupo || (filtroGrupo === 'sem' ? !p.cadeia.length : p.cadeia.some((g) => g.id === filtroGrupo))) && (!sp.alerta || (p.alertas || []).length));
  const geral = resumo(pessoas);
  const sel = resumo(filtradas);
  const nomeSel = filtroGrupo ? cartoes.find((c) => c.id === filtroGrupo)?.nome || porId.get(filtroGrupo)?.nome : null;

  const i = lista.indexOf(mes);
  const anterior = lista[i + 1], proximo = lista[i - 1];
  const url = (extra) => { const q = new URLSearchParams({ ...(mes ? { mes } : {}), ...(sp.nivel ? { nivel: sp.nivel } : {}), ...(filtroGrupo ? { grupo: filtroGrupo } : {}), ...(sp.alerta ? { alerta: '1' } : {}), ...extra }); [...q.keys()].forEach((k) => !q.get(k) && q.delete(k)); return `/tempo-falado?${q}`; };

  return (
    <>
      <div className="assid-topo">
        <div>
          <h1 style={{ margin: 0 }}>Tempo falado</h1>
          <p className="sub" style={{ marginTop: 4 }}>
            {mes ? <>{geral.pessoas} pessoas · <b>{hms(geral.falando)}</b> falando no mês · média <b>{hms(geral.media)}</b> por dia trabalhado · TMA <b>{hms(geral.tma)}</b></> : 'LeadsBuilder + 3C + folhas de ponto'}
          </p>
        </div>
        <div className="assid-mes">
          {mes && <>
            {anterior ? <Link className="seta" href={url({ mes: anterior })} aria-label="Mês anterior">‹</Link> : <span className="seta" style={{ opacity: 0.35 }}>‹</span>}
            <b>{rotMes(mes)}</b>
            {proximo ? <Link className="seta" href={url({ mes: proximo })} aria-label="Próximo mês">›</Link> : <span className="seta" style={{ opacity: 0.35 }}>›</span>}
          </>}
          {editor && <a className="btn btn-sec" href="#subir" style={{ marginLeft: 6 }}>Subir relatórios</a>}
        </div>
      </div>

      {!mes ? <p className="dica">Nenhum mês gravado ainda. Use "Subir relatórios" no fim da página.</p> : (
        <>
          <div className="tf-agrupar">
            <span className="dica">Resumo por:</span>
            <div className="alternar-visao">
              {NIVEIS.slice(0, profundidade).map((n, k) => (
                <Link key={n} href={url({ nivel: String(k + 1), grupo: '' })} className={nivel === k + 1 ? 'ativo' : ''}>{k === profundidade - 1 ? 'Equipe' : n}</Link>
              ))}
            </div>
          </div>

          <nav className="equipes-assid" aria-label="Resumo por equipe">
            {cartoes.map((c) => (
              <Link key={c.id} href={url({ grupo: filtroGrupo === c.id ? '' : c.id })} className={`cartao-equipe${filtroGrupo === c.id ? ' sel' : ''}`} title={c.caminho} aria-current={filtroGrupo === c.id ? 'true' : undefined}>
                <span className="linha1"><span className="nome">{c.nome}</span><span className="dica">{c.pessoas} pessoas</span></span>
                <span className="pct">{hms(c.media)}</span>
                <span className="dica" style={{ marginTop: -4 }}>média falando por dia</span>
                <span className="barra-meta"><span style={{ width: `${Math.round((c.media / maxMedia) * 100)}%`, background: 'var(--acento)' }} /></span>
                <span className="dica">Total {hms(c.falando)} · TMA {hms(c.tma)}</span>
                {c.alertas > 0 && <span className="hoje-pend">{c.alertas} com alerta</span>}
              </Link>
            ))}
          </nav>

          <section className="assid-cartao">
            <div className="assid-cab">
              <div>
                <h2>{nomeSel || 'Todos os colaboradores'} <span className="dica" style={{ fontWeight: 400 }}>· {sel.pessoas} pessoas · média {hms(sel.media)}/dia · TMA {hms(sel.tma)}</span></h2>
                <p className="dica">"Copiar para o relatório" leva as 6 colunas do relatório oficial (Mês, Consultor, Falando, TMA, Dias trabalhados, Média Falando) desta lista, na ordem dela.</p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Link href={url({ alerta: sp.alerta ? '' : '1' })} className={`btn btn-peq ${sp.alerta ? '' : 'btn-sec'}`}>{sp.alerta ? '✓ ' : ''}Só com alerta</Link>
                {filtroGrupo && <Link href={url({ grupo: '' })} className="btn btn-sec btn-peq">Ver todos</Link>}
              </div>
            </div>
            <div style={{ marginBottom: 10 }}><BaixarTempoFalado mes={mes} linhas={filtradas} /></div>
            <div className="tabela-wrap tabela-fixa">
              <table>
                <thead><tr><th>#</th><th className="esq">Consultor</th><th className="esq">Equipe</th><th>Falando</th><th>TMA</th><th>Dias</th><th className="esq" style={{ minWidth: 150 }}>Média por dia</th><th className="esq">Origem</th><th className="esq">Alertas</th></tr></thead>
                <tbody>
                  {filtradas.map((l, k) => (
                    <tr key={l.id}>
                      <td className="dica">{k + 1}</td>
                      <td className="esq">{l.nome}{!l.colaborador_id && <span className="nome-sub">não vinculado</span>}</td>
                      <td className="esq" title={l.equipe}>{l.equipeCurta || <span className="fraco">—</span>}</td>
                      <td>{hms(l.falando)}</td>
                      <td>{hms(l.tma)}</td>
                      <td>{l.dias}</td>
                      <td className="esq">
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="barra-meta" style={{ flex: 1 }}><span style={{ width: `${Math.min(100, Math.round((l.media / Math.max(1, sel.media * 2)) * 100))}%`, background: l.media >= sel.media ? 'var(--ok)' : 'var(--atencao)' }} /></span>
                          <b style={{ minWidth: 56, textAlign: 'right' }}>{hms(l.media)}</b>
                        </span>
                      </td>
                      <td className="esq dica">{[l.lb_seg ? `LB ${hms(l.lb_seg)}` : null, l.c3_seg ? `3C ${hms(l.c3_seg)}` : null].filter(Boolean).join(' · ')}</td>
                      <td className="esq">{(l.alertas || []).map((a) => <span key={a} className="tag tag-atencao" style={{ marginRight: 4 }}>{a}</span>)}</td>
                    </tr>
                  ))}
                  {!filtradas.length && <tr><td colSpan={9} className="fraco" style={{ textAlign: 'center', padding: 24 }}>Ninguém com esses filtros.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="dica" style={{ marginTop: 6 }}>Barra da média: verde = acima da média da lista, laranja = abaixo.</p>
          </section>
        </>
      )}

      {editor && (
        <details id="subir" className="bloco secao recolhivel" style={{ marginTop: 20 }} open={!lista.length}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Subir relatórios de um mês</summary>
          <div style={{ marginTop: 10 }}>
            <ImportarTempoFalado
              mesPadrao={hojeSP().slice(0, 7)}
              colaboradores={(colabs || []).filter((c) => c.ativo).map((c) => ({ id: c.id, nome: c.nome }))}
              apelidos={apel.data || []}
            />
          </div>
          {mes && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--linha)' }}>
              <FormAcao acao={excluirMesTempoFalado} confirmar={`Apagar todo o tempo falado de ${rotMes(mes)}? Depois é só subir os relatórios de novo no mês certo.`}>
                <input type="hidden" name="mes" value={mes} />
                <button className="btn btn-perigo btn-peq" type="submit">Apagar {rotMes(mes)}</button>
                <span className="dica" style={{ marginLeft: 8 }}>Use se gravou no mês errado.</span>
              </FormAcao>
            </div>
          )}
        </details>
      )}
    </>
  );
}
