import Link from 'next/link';
import { exigirSessao, podeEditar } from '@/lib/auth';
import { hojeSP } from '@/lib/datas';
import { hms } from '@/lib/tempoFalado';
import ImportarTempoFalado from '@/components/ImportarTempoFalado';
import BaixarTempoFalado from '@/components/BaixarTempoFalado';

export default async function TempoFalado({ searchParams }) {
  const sp = await searchParams;
  const { perfil, supabase } = await exigirSessao();
  const editor = podeEditar(perfil);
  const [meses, { data: grupos }, { data: colabs }, apel] = await Promise.all([
    supabase.from('tempo_falado').select('mes').order('mes', { ascending: false }).limit(5000),
    supabase.from('grupos').select('id, nome, parent_id'),
    supabase.from('colaboradores').select('id, nome, grupo_id, ativo'),
    editor ? supabase.from('colaborador_apelidos').select('apelido, colaborador_id') : Promise.resolve({ data: [] }),
  ]);
  if (meses.error) return <><div className="topo"><h1>Tempo falado</h1></div><p className="msg msg-erro">Rode o arquivo 028_tempo_falado.sql no Supabase.</p></>;
  const lista = [...new Set((meses.data || []).map((m) => m.mes))];
  const mes = lista.includes(sp.mes) ? sp.mes : lista[0];
  const { data: linhas = [] } = mes ? await supabase.from('tempo_falado').select('*').eq('mes', mes).order('falando', { ascending: false }) : { data: [] };

  const porId = new Map((grupos || []).map((g) => [g.id, g]));
  const caminho = (id) => { const l = []; let g = porId.get(id); while (g) { l.unshift(g.nome); g = porId.get(g.parent_id); } return l.join(' / '); };
  const grupoDe = new Map((colabs || []).map((c) => [c.id, c.grupo_id]));
  const comEquipe = (linhas || []).map((l) => ({ ...l, grupo_id: grupoDe.get(l.colaborador_id) || null, equipe: grupoDe.get(l.colaborador_id) ? caminho(grupoDe.get(l.colaborador_id)) : '' }));
  const equipes = [...new Map(comEquipe.filter((l) => l.grupo_id).map((l) => [l.grupo_id, l.equipe])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const filtradas = comEquipe.filter((l) => (!sp.equipe || l.grupo_id === sp.equipe) && (!sp.alerta || (l.alertas || []).length));
  const total = filtradas.reduce((s, l) => s + l.falando, 0);
  const dias = filtradas.reduce((s, l) => s + l.dias, 0);
  const fmtMes = (m) => `${m.slice(5)}/${m.slice(0, 4)}`;

  return (
    <>
      <div className="topo">
        <div>
          <h1>Tempo falado</h1>
          <p className="sub">Tempo falando, TMA e média por dia trabalhado de cada colaborador, juntando LeadsBuilder, 3C e as folhas de ponto.</p>
        </div>
        {mes && <BaixarTempoFalado mes={mes} linhas={filtradas} />}
      </div>

      {editor && (
        <details className="bloco secao recolhivel" open={!lista.length}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>+ Subir relatórios de um mês</summary>
          <div style={{ marginTop: 10 }}>
            <ImportarTempoFalado
              mesPadrao={hojeSP().slice(0, 7)}
              colaboradores={(colabs || []).filter((c) => c.ativo).map((c) => ({ id: c.id, nome: c.nome }))}
              apelidos={apel.data || []}
            />
          </div>
        </details>
      )}

      {!mes ? <p className="dica secao">Nenhum mês gravado ainda.</p> : (
        <>
          <form className="bloco campos" style={{ margin: '14px 0', alignItems: 'flex-end' }} method="get">
            <label className="campo">Mês
              <select name="mes" defaultValue={mes}>{lista.map((m) => <option key={m} value={m}>{fmtMes(m)}</option>)}</select>
            </label>
            <label className="campo">Equipe
              <select name="equipe" defaultValue={sp.equipe || ''}>
                <option value="">Todas</option>
                {equipes.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
              </select>
            </label>
            <label className="check"><input type="checkbox" name="alerta" value="1" defaultChecked={!!sp.alerta} /> só com alerta</label>
            <button className="btn btn-sec" type="submit">Filtrar</button>
            {(sp.equipe || sp.alerta) && <Link href={`/tempo-falado?mes=${mes}`} className="dica">Limpar</Link>}
          </form>

          <div className="calendario" style={{ marginTop: 0 }}>
            <div><b>{filtradas.length}</b><span>pessoas</span></div>
            <div><b>{hms(total)}</b><span>falando no total</span></div>
            <div><b>{hms(dias ? total / dias : 0)}</b><span>média falando por dia trabalhado</span></div>
          </div>

          <p className="dica" style={{ marginBottom: 6 }}>
            "Copiar para o relatório" copia as 6 colunas do relatório oficial (Mês, Consultor, Falando, TMA, Dias trabalhados, Média Falando),
            na ordem desta tabela e respeitando os filtros. É só colar na primeira célula vazia do relatório.
          </p>
          <div className="tabela-wrap tabela-fixa">
            <table>
              <thead><tr><th>Consultor</th><th className="esq">Equipe</th><th>Falando</th><th>TMA</th><th>Dias trabalhados</th><th>Média falando</th><th className="esq">Origem</th><th className="esq">Alertas</th></tr></thead>
              <tbody>
                {filtradas.map((l) => (
                  <tr key={l.id}>
                    <td>{l.nome}{!l.colaborador_id && <span className="nome-sub">não vinculado</span>}</td>
                    <td className="esq">{l.equipe || <span className="fraco">—</span>}</td>
                    <td>{hms(l.falando)}</td>
                    <td>{hms(l.tma)}</td>
                    <td>{l.dias}</td>
                    <td>{hms(l.media)}</td>
                    <td className="esq dica">{[l.lb_seg ? `LB ${hms(l.lb_seg)}` : null, l.c3_seg ? `3C ${hms(l.c3_seg)}` : null].filter(Boolean).join(' · ')}</td>
                    <td className="esq">{(l.alertas || []).map((a) => <span key={a} className="tag tag-atencao" style={{ marginRight: 4 }}>{a}</span>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
