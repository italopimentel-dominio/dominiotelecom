import Link from 'next/link';
import { exigirSessao, ehAdmin } from '@/lib/auth';
import { hojeSP } from '@/lib/datas';
import { montarCalendario } from '@/lib/calc';
import { diasUteisDoMes, contar, ativoNoDia, META_ASSIDUIDADE } from '@/lib/assiduidade';
import GradeAssiduidade from '@/components/GradeAssiduidade';
import ImportarAssiduidade from '@/components/ImportarAssiduidade';

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const classePct = (v) => (v == null ? '' : v >= META_ASSIDUIDADE ? 'assid-ok' : 'assid-baixo');

export default async function Assiduidade({ searchParams }) {
  const sp = await searchParams;
  const { perfil, supabase } = await exigirSessao();
  const hoje = hojeSP();
  const mes = /^\d{4}-\d{2}$/.test(sp.mes || '') ? sp.mes : hoje.slice(0, 7);
  const inicio = `${mes}-01`;
  const fim = `${mes}-31`;

  const [{ data: grupos }, { data: colabs }, { data: feriados }, { data: config }, regs, lanc, { data: apelidos }] = await Promise.all([
    supabase.from('grupos').select('id, nome, parent_id, ativo, ordem').order('ordem').order('nome'),
    supabase.from('colaboradores').select('id, nome, grupo_id, ativo, data_admissao, data_desligamento').order('nome'),
    supabase.from('feriados').select('*'),
    supabase.from('config').select('*').eq('id', 1).maybeSingle(),
    supabase.from('assiduidade').select('colaborador_id, data, status, grupo_id').gte('data', inicio).lte('data', fim).limit(20000),
    supabase.rpc('grupos_lancaveis'),
    supabase.from('colaborador_apelidos').select('apelido, colaborador_id'),
  ]);
  if (regs.error) return <><div className="topo"><h1>Assiduidade</h1></div><p className="msg msg-erro">Rode o arquivo 032_assiduidade.sql no Supabase.</p></>;

  const admin = ehAdmin(perfil);
  const lancaveis = new Set((lanc.data || []).map((x) => (typeof x === 'string' ? x : x.grupos_lancaveis)));
  const podeLancar = (gid) => admin || lancaveis.has(gid);
  const cal = montarCalendario(config, feriados || []);
  const dias = diasUteisDoMes(mes, cal);
  const ultimoDia = dias.at(-1) || fim;

  const porId = new Map((grupos || []).map((g) => [g.id, g]));
  const caminho = (id) => { const l = []; let g = porId.get(id); while (g) { l.unshift(g.nome); g = porId.get(g.parent_id); } return l.join(' / '); };
  // colaborador está na lista do mês: ativo em algum dia útil do mês
  const noMes = (c) => dias.some((d) => ativoNoDia(c, d)) && (c.ativo || (c.data_desligamento && c.data_desligamento >= inicio));
  const registros = regs.data || [];

  // equipes com gente no mês (ou com marcações)
  const idsEquipes = new Set([...(colabs || []).filter(noMes).map((c) => c.grupo_id), ...registros.map((r) => r.grupo_id).filter(Boolean)]);
  const equipes = [...idsEquipes].filter((id) => porId.get(id)?.ativo !== false).map((id) => {
    const r = contar(registros.filter((x) => x.grupo_id === id).map((x) => x.status));
    return { id, nome: caminho(id), ...r };
  }).sort((a, b) => a.nome.localeCompare(b.nome));
  const minhas = equipes.filter((e) => podeLancar(e.id));
  const equipeSel = equipes.find((e) => e.id === sp.equipe) || minhas[0] || equipes[0];
  const geral = contar(registros.map((r) => r.status));

  // abaixo da meta: por colaborador no mês (todas as equipes)
  const porColab = new Map();
  registros.forEach((r) => { if (!porColab.has(r.colaborador_id)) porColab.set(r.colaborador_id, []); porColab.get(r.colaborador_id).push(r.status); });
  const abaixo = [...porColab.values()].filter((l) => { const c = contar(l); return c.pct != null && c.pct < META_ASSIDUIDADE; }).length;

  // grade da equipe escolhida: quem é da equipe no mês + quem tem marcação nela (transferências)
  let grade = null;
  if (equipeSel) {
    const comMarca = new Set(registros.filter((r) => r.grupo_id === equipeSel.id).map((r) => r.colaborador_id));
    const lista = (colabs || []).filter((c) => (c.grupo_id === equipeSel.id && noMes(c)) || comMarca.has(c.id));
    const mapa = {};
    registros.filter((r) => lista.some((c) => c.id === r.colaborador_id)).forEach((r) => { (mapa[r.colaborador_id] ||= {})[r.data] = r.status; });
    grade = { lista, mapa };
  }
  const meses = Array.from({ length: 6 }, (_, i) => { const d = new Date(Date.UTC(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)) - 1 - i, 1)); return d.toISOString().slice(0, 7); });
  const rotMes = (m) => `${m.slice(5)}/${m.slice(0, 4)}`;

  return (
    <>
      <div className="topo">
        <div>
          <h1>Assiduidade</h1>
          <p className="sub">
            Presença por dia útil (P presente, F falta, A atestado). Quem lança: o líder da equipe no organograma (supervisor, coordenador ou acima) e administradores.
          </p>
        </div>
      </div>

      <form className="bloco campos" style={{ margin: '0 0 14px', alignItems: 'flex-end' }} method="get">
        <label className="campo">Mês
          <select name="mes" defaultValue={mes}>{[...new Set([mes, ...meses])].map((m) => <option key={m} value={m}>{rotMes(m)}</option>)}</select>
        </label>
        <label className="campo">Equipe
          <select name="equipe" defaultValue={equipeSel?.id || ''}>
            {equipes.map((e) => <option key={e.id} value={e.id}>{e.nome}{podeLancar(e.id) ? '' : ' (só ver)'}</option>)}
          </select>
        </label>
        <button className="btn btn-sec" type="submit">Abrir</button>
      </form>

      <div className="calendario" style={{ marginTop: 0 }}>
        <div><b className={classePct(geral.pct)}>{pct(geral.pct)}</b><span>assiduidade geral do mês (meta {Math.round(META_ASSIDUIDADE * 100)}%)</span></div>
        {equipeSel && <div><b className={classePct(equipeSel.pct)}>{pct(equipeSel.pct)}</b><span>{equipeSel.nome}</span></div>}
        <div><b>{abaixo}</b><span>colaboradores abaixo de {Math.round(META_ASSIDUIDADE * 100)}%</span></div>
        <div><b>{geral.f}</b><span>faltas · {geral.a} atestados</span></div>
      </div>

      {(admin || lancaveis.size > 0) && (
        <details className="bloco secao recolhivel">
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>⇪ Importar ponto ou planilha antiga ({rotMes(mes)})</summary>
          <div style={{ marginTop: 10 }}>
            <ImportarAssiduidade mes={mes} colaboradores={(colabs || []).map((c) => ({ id: c.id, nome: c.nome, grupo_id: c.grupo_id, data_admissao: c.data_admissao, data_desligamento: c.data_desligamento }))} apelidos={apelidos || []} />
          </div>
        </details>
      )}
      {!admin && lancaveis.size === 0 && (
        <p className="dica" style={{ marginBottom: 10 }}>
          Você está vendo sem poder lançar. Para lançar, o seu usuário precisa estar ligado ao seu cargo em Organograma → Cargos de liderança.
        </p>
      )}

      {equipeSel && grade && (
        <section className="secao">
          <h2 style={{ marginBottom: 8 }}>{equipeSel.nome} <span className="dica">· {dias.length} dias úteis em {rotMes(mes)}</span></h2>
          {grade.lista.length ? (
            <GradeAssiduidade key={`${equipeSel.id}-${mes}`} grupoId={equipeSel.id} dias={dias} hoje={hoje} podeEditar={podeLancar(equipeSel.id)}
              colaboradores={grade.lista.map((c) => ({ id: c.id, nome: c.nome, data_admissao: c.data_admissao, data_desligamento: c.data_desligamento }))}
              registros={grade.mapa} />
          ) : <p className="dica">Ninguém nesta equipe no mês.</p>}
        </section>
      )}

      <section className="secao">
        <h2 style={{ marginBottom: 8 }}>Todas as equipes</h2>
        <div className="tabela-wrap">
          <table>
            <thead><tr><th>Equipe</th><th>Assiduidade</th><th>Presenças</th><th>Faltas</th><th>Atestados</th><th>Dias marcados</th></tr></thead>
            <tbody>
              {equipes.map((e) => (
                <tr key={e.id}>
                  <td><Link href={`/assiduidade?mes=${mes}&equipe=${e.id}`}>{e.nome}</Link></td>
                  <td className={classePct(e.pct)}><b>{pct(e.pct)}</b></td>
                  <td>{e.p}</td><td>{e.f}</td><td>{e.a}</td><td>{e.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="dica" style={{ marginTop: 6 }}>Último dia útil do mês: {ultimoDia.slice(8)}/{ultimoDia.slice(5, 7)}.</p>
      </section>
    </>
  );
}
