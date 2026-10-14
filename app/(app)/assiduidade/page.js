import Link from 'next/link';
import { exigirSessao, ehAdmin } from '@/lib/auth';
import { hojeSP } from '@/lib/datas';
import { montarCalendario } from '@/lib/calc';
import { diasUteisDoMes, contar, ativoNoDia, META_ASSIDUIDADE } from '@/lib/assiduidade';
import PainelAssiduidade from '@/components/PainelAssiduidade';
import ImportarAssiduidade from '@/components/ImportarAssiduidade';

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const corPct = (v) => (v == null ? '#8f88a8' : v >= META_ASSIDUIDADE ? 'var(--ok)' : 'var(--risco)');
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const somarMes = (mes, n) => { const d = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1 + n, 1)); return d.toISOString().slice(0, 7); };

export default async function Assiduidade({ searchParams }) {
  const sp = await searchParams;
  const { perfil, supabase } = await exigirSessao();
  const hoje = hojeSP();
  const mes = /^\d{4}-\d{2}$/.test(sp.mes || '') ? sp.mes : hoje.slice(0, 7);
  const inicio = `${mes}-01`;
  // último dia de verdade do mês (setembro tem 30; "2026-09-31" não existe e o banco recusa)
  const fim = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).toISOString().slice(0, 10);

  const [{ data: grupos }, { data: colabs }, { data: feriados }, { data: config }, regs, lanc, { data: apelidos }] = await Promise.all([
    supabase.from('grupos').select('id, nome, parent_id, ativo, ordem').order('ordem').order('nome'),
    supabase.from('colaboradores').select('id, nome, grupo_id, ativo, data_admissao, data_desligamento').order('nome'),
    supabase.from('feriados').select('*'),
    supabase.from('config').select('*').eq('id', 1).maybeSingle(),
    supabase.from('assiduidade').select('colaborador_id, data, status, grupo_id').gte('data', inicio).lte('data', fim).limit(20000),
    supabase.rpc('grupos_lancaveis'),
    supabase.from('colaborador_apelidos').select('apelido, colaborador_id'),
  ]);
  if (regs.error) {
    const faltaTabela = /assiduidade|does not exist|schema cache/i.test(regs.error.message);
    return <><div className="topo"><h1>Assiduidade</h1></div><p className="msg msg-erro">{faltaTabela ? 'Rode o arquivo 032_assiduidade.sql no Supabase.' : `Não consegui carregar a assiduidade: ${regs.error.message}`}</p></>;
  }

  const admin = ehAdmin(perfil);
  const lancaveis = new Set((lanc.data || []).map((x) => (typeof x === 'string' ? x : x.grupos_lancaveis)));
  const podeLancar = (gid) => admin || lancaveis.has(gid);
  const cal = montarCalendario(config, feriados || []);
  const dias = diasUteisDoMes(mes, cal);
  const diaHoje = dias.includes(hoje) ? hoje : null;

  const porId = new Map((grupos || []).map((g) => [g.id, g]));
  const nomeCurto = (id) => porId.get(id)?.nome || '—';
  const caminho = (id) => { const l = []; let g = porId.get(id); while (g) { l.unshift(g.nome); g = porId.get(g.parent_id); } return l.join(' / '); };
  const noMes = (c) => dias.some((d) => ativoNoDia(c, d)) && (c.ativo || (c.data_desligamento && c.data_desligamento >= inicio));
  const registros = regs.data || [];
  const colabPorId = new Map((colabs || []).map((c) => [c.id, c]));

  // equipes do mês: quem é da equipe + quem tem marcação nela (transferências)
  const idsEquipes = new Set([...(colabs || []).filter(noMes).map((c) => c.grupo_id), ...registros.map((r) => r.grupo_id).filter(Boolean)]);
  const membros = (gid) => {
    const comMarca = new Set(registros.filter((r) => r.grupo_id === gid).map((r) => r.colaborador_id));
    return (colabs || []).filter((c) => (c.grupo_id === gid && noMes(c)) || comMarca.has(c.id));
  };
  const marcadosHoje = new Set(registros.filter((r) => r.data === diaHoje).map((r) => r.colaborador_id));
  const equipes = [...idsEquipes].filter((id) => porId.get(id)?.ativo !== false).map((id) => {
    const lista = membros(id);
    const r = contar(registros.filter((x) => x.grupo_id === id).map((x) => x.status));
    const pendHoje = diaHoje ? lista.filter((c) => ativoNoDia(c, diaHoje) && !marcadosHoje.has(c.id)).length : null;
    return { id, nome: nomeCurto(id), caminho: caminho(id), pessoas: lista.length, pendHoje, lista, ...r };
  }).sort((a, b) => Number(podeLancar(b.id)) - Number(podeLancar(a.id)) || a.caminho.localeCompare(b.caminho));
  const sel = equipes.find((e) => e.id === sp.equipe) || equipes.find((e) => podeLancar(e.id)) || equipes[0];
  const geral = contar(registros.map((r) => r.status));

  // abaixo da meta (todas as equipes), piores primeiro
  const porColab = new Map();
  registros.forEach((r) => { if (!porColab.has(r.colaborador_id)) porColab.set(r.colaborador_id, { lista: [], grupo: r.grupo_id }); porColab.get(r.colaborador_id).lista.push(r.status); });
  const alertas = [...porColab.entries()].map(([id, v]) => ({ id, ...contar(v.lista), nome: colabPorId.get(id)?.nome || '—', equipe: nomeCurto(v.grupo) }))
    .filter((x) => x.pct != null && x.pct < META_ASSIDUIDADE).sort((a, b) => a.pct - b.pct);

  let mapa = {};
  if (sel) registros.filter((r) => sel.lista.some((c) => c.id === r.colaborador_id)).forEach((r) => { (mapa[r.colaborador_id] ||= {})[r.data] = r.status; });
  const link = (m, e) => `/assiduidade?mes=${m}${e ? `&equipe=${e}` : ''}`;
  const rotMes = `${MESES[Number(mes.slice(5)) - 1]} ${mes.slice(0, 4)}`;
  const podeImportar = admin || lancaveis.size > 0;

  return (
    <>
      <div className="assid-topo">
        <div>
          <h1 style={{ margin: 0 }}>Assiduidade</h1>
          <p className="sub" style={{ marginTop: 4 }}>
            Presença por dia útil · geral do mês <b style={{ color: corPct(geral.pct) }}>{pct(geral.pct)}</b> · meta <b>{Math.round(META_ASSIDUIDADE * 100)}%</b> · {geral.f} faltas e {geral.a} atestados
          </p>
        </div>
        <div className="assid-mes">
          <Link className="seta" href={link(somarMes(mes, -1), sel?.id)} aria-label="Mês anterior">‹</Link>
          <b>{rotMes}</b>
          <Link className="seta" href={link(somarMes(mes, 1), sel?.id)} aria-label="Próximo mês">›</Link>
          {podeImportar && <a className="btn btn-sec" href="#importar" style={{ marginLeft: 6 }}>Importar ponto</a>}
        </div>
      </div>

      {!podeImportar && (
        <p className="dica" style={{ marginBottom: 12 }}>
          Você está vendo sem poder lançar. Para lançar, o seu usuário precisa estar ligado ao seu cargo em Organograma → Cargos de liderança.
        </p>
      )}

      {equipes.length === 0 ? <p className="dica">Nenhuma equipe com colaboradores neste mês.</p> : (
        <nav className="equipes-assid" aria-label="Equipes">
          {equipes.map((e) => (
            <Link key={e.id} href={link(mes, e.id)} className={`cartao-equipe${sel?.id === e.id ? ' sel' : ''}`} title={e.caminho} aria-current={sel?.id === e.id ? 'true' : undefined}>
              <span className="linha1"><span className="nome">{e.nome}</span><span className="dica">{e.pessoas} pessoas</span></span>
              <span className="pct" style={{ color: corPct(e.pct) }}>{pct(e.pct)}</span>
              <span className="barra-meta"><span style={{ width: `${Math.round((e.pct || 0) * 100)}%`, background: corPct(e.pct) }} /><i /></span>
              <span className="dica">{e.f} faltas · {e.a} atestados</span>
              {e.pendHoje != null && (e.pendHoje ? <span className="hoje-pend">Hoje: {e.pendHoje} {e.pendHoje === 1 ? 'pendente' : 'pendentes'}</span> : <span className="hoje-ok">Hoje: todos marcados</span>)}
            </Link>
          ))}
        </nav>
      )}

      {sel && (
        sel.lista.length ? (
          <PainelAssiduidade key={`${sel.id}-${mes}`} grupoId={sel.id} nomeEquipe={sel.nome} dias={dias} hoje={hoje} podeEditar={podeLancar(sel.id)}
            colaboradores={sel.lista.map((c) => ({ id: c.id, nome: c.nome, data_admissao: c.data_admissao, data_desligamento: c.data_desligamento }))}
            registros={mapa} />
        ) : <p className="dica">Ninguém nesta equipe no mês.</p>
      )}

      {alertas.length > 0 && (
        <section className="assid-cartao" style={{ marginTop: 20 }} aria-labelledby="alertas">
          <h2 id="alertas" style={{ marginBottom: 2 }}>Abaixo de {Math.round(META_ASSIDUIDADE * 100)}% no mês</h2>
          <p className="dica" style={{ marginBottom: 8 }}>{alertas.length} colaboradores, de todas as equipes, piores primeiro</p>
          <ul className="lista-alerta">
            {alertas.map((x) => (
              <li key={x.id}>
                <span style={{ flex: 1, minWidth: 0 }}><b style={{ fontWeight: 600 }}>{x.nome}</b> <span className="dica">· {x.equipe}</span></span>
                <span className="dica">{[x.f && `${x.f} ${x.f === 1 ? 'falta' : 'faltas'}`, x.a && `${x.a} ${x.a === 1 ? 'atestado' : 'atestados'}`].filter(Boolean).join(' · ')}</span>
                <b style={{ color: 'var(--risco)', width: 44, textAlign: 'right' }}>{pct(x.pct)}</b>
              </li>
            ))}
          </ul>
        </section>
      )}

      {podeImportar && (
        <details id="importar" className="bloco secao recolhivel" style={{ marginTop: 20 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Importar ponto ou planilha antiga ({rotMes})</summary>
          <div style={{ marginTop: 10 }}>
            <ImportarAssiduidade mes={mes} colaboradores={(colabs || []).map((c) => ({ id: c.id, nome: c.nome, grupo_id: c.grupo_id, data_admissao: c.data_admissao, data_desligamento: c.data_desligamento }))} apelidos={apelidos || []} />
          </div>
        </details>
      )}
    </>
  );
}
