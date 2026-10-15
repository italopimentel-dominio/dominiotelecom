import Link from 'next/link';
import { redirect } from 'next/navigation';
import { exigirSessao, podeVerIndireto } from '@/lib/auth';
import { hojeSP } from '@/lib/datas';
import { fmtData } from '@/lib/formato';
import { TIPOS_TREINAMENTO, situacaoAtivacao, ROTULO_ATIVACAO, classeStatus, documentoDe } from '@/lib/indireto';
import { nomesDosPerfis, listarStatus } from '../dados';

const TIPOS = Object.keys(TIPOS_TREINAMENTO); // onboarding, telecom, servicos
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const COR_CHIP = { 'tag-ok': 'var(--ok)', 'tag-acento': 'var(--acento)', 'tag-atencao': 'var(--atencao)', 'tag-risco': 'var(--risco)' };
const dataSP = (ts) => new Date(new Date(ts).getTime() - 3 * 3600000).toISOString().slice(0, 10);
const somarMes = (m, n) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1)).toISOString().slice(0, 7);

export default async function AcompanhamentoIndireto({ searchParams }) {
  const sp = await searchParams;
  const { supabase, perfil } = await exigirSessao();
  if (!podeVerIndireto(perfil)) redirect('/');
  const hoje = hojeSP();
  const mes = /^\d{4}-\d{2}$/.test(sp.mes || '') ? sp.mes : hoje.slice(0, 7);
  const VER = ['cadastros', 'ativacoes', ...TIPOS];
  const ver = VER.includes(sp.ver) ? sp.ver : 'ativacoes';
  const focal = sp.focal || '';

  const [{ data: parceiros = [] }, { data: treinos = [] }, nomes, statusLista] = await Promise.all([
    supabase.from('parceiros').select('id, nome_fantasia, cpf, cnpj, status, criado_em, data_ativacao, ponto_focal_id, venda_mes, venda_produto').limit(10000),
    supabase.from('parceiro_treinamentos').select('parceiro_id, tipo, data, status').eq('status', 'realizado').limit(20000),
    nomesDosPerfis(supabase),
    listarStatus(supabase),
  ]);
  const statusPor = new Map(statusLista.map((s) => [s.chave, s]));
  const noMes = (d) => !!d && d.startsWith(mes);
  const doFocal = (p) => !focal || (focal === 'sem' ? !p.ponto_focal_id : p.ponto_focal_id === focal);

  // treinamentos: por parceiro e tipo (todos os tempos) e os feitos no mês
  const feitoAlgumaVez = new Map(); // pid|tipo -> data mais recente
  const noMesTreino = []; // { pid, tipo, data }
  (treinos || []).forEach((t) => {
    const k = `${t.parceiro_id}|${t.tipo}`;
    if (!feitoAlgumaVez.has(k) || t.data > feitoAlgumaVez.get(k)) feitoAlgumaVez.set(k, t.data);
    if (noMes(t.data)) noMesTreino.push({ pid: t.parceiro_id, tipo: t.tipo, data: t.data });
  });
  const porId = new Map((parceiros || []).map((p) => [p.id, p]));
  const resumoDe = (lista) => {
    const ids = new Set(lista.map((p) => p.id));
    const cad = lista.filter((p) => p.criado_em && noMes(dataSP(p.criado_em)));
    const atv = lista.filter((p) => noMes(p.data_ativacao));
    const r = { cadastros: cad.length, ativacoes: atv.length, boas: atv.filter((p) => situacaoAtivacao(p, hoje)?.estado === 'boa').length };
    TIPOS.forEach((t) => { r[t] = noMesTreino.filter((x) => x.tipo === t && ids.has(x.pid)).length; });
    return r;
  };

  // cartões dos pontos focais (no topo)
  const idsFocais = [...new Set((parceiros || []).map((p) => p.ponto_focal_id || 'sem'))];
  const cartoes = idsFocais.map((f) => {
    const lista = (parceiros || []).filter((p) => (p.ponto_focal_id || 'sem') === f);
    return { f, nome: f === 'sem' ? 'Sem ponto focal' : nomes.get(f) || '—', parceiros: lista.length, ...resumoDe(lista) };
  }).sort((a, b) => (a.f === 'sem') - (b.f === 'sem') || b.ativacoes - a.ativacoes || a.nome.localeCompare(b.nome));
  const doRecorte = (parceiros || []).filter(doFocal);
  const tot = resumoDe(doRecorte);
  const nomeFocal = focal ? cartoes.find((c) => c.f === focal)?.nome : null;

  const url = (extra) => {
    const q = new URLSearchParams({ mes, ver, ...(focal ? { focal } : {}), ...(sp.f ? { f: sp.f } : {}), ...extra });
    [...q.keys()].forEach((k) => !q.get(k) && q.delete(k));
    return `/indireto/acompanhamento?${q}`;
  };

  // ---------- detalhe do indicador escolhido ----------
  let titulo = '', chips = [], linhas = [], colunas = [];
  const filtro = sp.f || '';
  if (ver === 'cadastros') {
    titulo = 'Cadastros realizados no mês';
    linhas = doRecorte.filter((p) => p.criado_em && noMes(dataSP(p.criado_em))).sort((a, b) => b.criado_em.localeCompare(a.criado_em))
      .map((p) => ({ p, data: dataSP(p.criado_em) }));
    colunas = ['Cadastrado em'];
  } else if (ver === 'ativacoes') {
    titulo = 'Ativações do mês';
    const todas = doRecorte.filter((p) => noMes(p.data_ativacao)).map((p) => ({ p, data: p.data_ativacao, sit: situacaoAtivacao(p, hoje) }));
    const conta = (e) => todas.filter((x) => x.sit?.estado === e).length;
    chips = [['', `Todas (${todas.length})`], ...Object.entries(ROTULO_ATIVACAO).map(([e, r]) => [e, `${r.texto} (${conta(e)})`, r.classe])];
    linhas = todas.filter((x) => !filtro || x.sit?.estado === filtro).sort((a, b) => b.data.localeCompare(a.data));
    colunas = ['Ativado em', 'Situação'];
  } else {
    const tipo = ver;
    titulo = `Treinamento de ${TIPOS_TREINAMENTO[tipo].toLowerCase()}`;
    const fizeram = noMesTreino.filter((x) => x.tipo === tipo && porId.has(x.pid) && doFocal(porId.get(x.pid)))
      .map((x) => ({ p: porId.get(x.pid), data: x.data })).sort((a, b) => b.data.localeCompare(a.data));
    // quem ainda não fez: parceiros com status Ativo (ou ativados) que nunca fizeram este treinamento
    const naoFizeram = doRecorte.filter((p) => (p.status === 'ativo' || p.data_ativacao) && !statusPor.get(p.status)?.oculto && !feitoAlgumaVez.has(`${p.id}|${tipo}`))
      .map((p) => ({ p, data: p.data_ativacao })).sort((a, b) => (a.p.nome_fantasia || '').localeCompare(b.p.nome_fantasia || ''));
    const f = filtro === 'nao' ? 'nao' : 'sim';
    chips = [['sim', `Fizeram no mês (${fizeram.length})`, 'tag-ok'], ['nao', `Ainda não fizeram (${naoFizeram.length})`, 'tag-risco']];
    linhas = f === 'nao' ? naoFizeram : fizeram;
    colunas = [f === 'nao' ? 'Ativado em' : 'Feito em'];
  }
  const filtroAtivo = (k) => (TIPOS.includes(ver) ? (filtro || 'sim') === k : filtro === k);

  // ---------- dia a dia ----------
  const porDia = new Map();
  const soma = (d, k) => { if (!porDia.has(d)) porDia.set(d, { cadastros: 0, ativacoes: 0, ...Object.fromEntries(TIPOS.map((t) => [t, 0])) }); porDia.get(d)[k]++; };
  doRecorte.forEach((p) => {
    if (p.criado_em && noMes(dataSP(p.criado_em))) soma(dataSP(p.criado_em), 'cadastros');
    if (noMes(p.data_ativacao)) soma(p.data_ativacao, 'ativacoes');
  });
  noMesTreino.forEach((x) => { const p = porId.get(x.pid); if (p && doFocal(p) && TIPOS.includes(x.tipo)) soma(x.data, x.tipo); });
  const dias = [...porDia.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const COLS = [['cadastros', 'Cadastros'], ['ativacoes', 'Ativações'], ...TIPOS.map((t) => [t, TIPOS_TREINAMENTO[t]])];

  const tiles = [
    { k: 'cadastros', n: tot.cadastros, r: 'cadastros realizados' },
    { k: 'ativacoes', n: tot.ativacoes, r: `ativações · ${tot.boas} boas` },
    ...TIPOS.map((t) => ({ k: t, n: tot[t], r: `treinamentos de ${TIPOS_TREINAMENTO[t].toLowerCase()}` })),
  ];

  return (
    <>
      <div className="assid-topo">
        <div>
          <h1 style={{ margin: 0 }}>Acompanhamento{nomeFocal ? ` · ${nomeFocal}` : ''}</h1>
          <p className="sub" style={{ marginTop: 4 }}>Cadastros, ativações e treinamentos do mês, por ponto focal. Clique num número para ver quem é.</p>
        </div>
        <div className="assid-mes">
          <Link className="seta" href={url({ mes: somarMes(mes, -1) })} aria-label="Mês anterior">‹</Link>
          <b>{MESES[Number(mes.slice(5)) - 1]} {mes.slice(0, 4)}</b>
          <Link className="seta" href={url({ mes: somarMes(mes, 1) })} aria-label="Próximo mês">›</Link>
        </div>
      </div>

      <nav className="equipes-assid" aria-label="Pontos focais">
        <Link href={url({ focal: '' })} className={`cartao-equipe${!focal ? ' sel' : ''}`} aria-current={!focal ? 'true' : undefined}>
          <span className="linha1"><span className="nome">Todos</span><span className="dica">{(parceiros || []).length} parceiros</span></span>
          <span className="pct">{resumoDe(parceiros || []).ativacoes}</span>
          <span className="dica" style={{ marginTop: -4 }}>ativações no mês</span>
          <span className="dica">{resumoDe(parceiros || []).cadastros} cadastros · {TIPOS.reduce((s, t) => s + resumoDe(parceiros || [])[t], 0)} treinamentos</span>
        </Link>
        {cartoes.map((c) => (
          <Link key={c.f} href={url({ focal: focal === c.f ? '' : c.f })} className={`cartao-equipe${focal === c.f ? ' sel' : ''}`} aria-current={focal === c.f ? 'true' : undefined}>
            <span className="linha1"><span className="nome">{c.nome}</span><span className="dica">{c.parceiros} parceiros</span></span>
            <span className="pct">{c.ativacoes}</span>
            <span className="dica" style={{ marginTop: -4 }}>ativações · {c.boas} boas</span>
            <span className="dica">{c.cadastros} cadastros · {TIPOS.map((t) => `${c[t]} ${TIPOS_TREINAMENTO[t].slice(0, 3).toLowerCase()}.`).join(' · ')}</span>
          </Link>
        ))}
      </nav>

      <div className="tiles-acomp" role="tablist" aria-label="Indicadores">
        {tiles.map((t) => (
          <Link key={t.k} href={url({ ver: t.k, f: '' })} role="tab" aria-selected={ver === t.k} className={`tile-acomp${ver === t.k ? ' sel' : ''}`}>
            <b>{t.n}</b><span>{t.r}</span>
          </Link>
        ))}
      </div>

      <section className="assid-cartao" style={{ marginTop: 14 }}>
        <div className="assid-cab">
          <h2>{titulo}{nomeFocal ? ` · ${nomeFocal}` : ''}</h2>
          {chips.length > 0 && (
            <div className="chips-acomp">
              {chips.map(([k, rot, cls]) => (
                <Link key={k || 'todas'} href={url({ f: k })} className={`chip-acomp${filtroAtivo(k) ? ' sel' : ''}`}>
                  {cls && <i className="ponto-chip" style={{ background: COR_CHIP[cls] }} />}{rot}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="tabela-wrap tabela-fixa" style={{ maxHeight: 420 }}>
          <table>
            <thead><tr><th className="esq">Parceiro</th><th className="esq">Ponto focal</th><th className="esq">Status</th>{colunas.map((c) => <th key={c} className={c === 'Situação' ? 'esq' : ''}>{c}</th>)}</tr></thead>
            <tbody>
              {linhas.map(({ p, data, sit }, i) => (
                <tr key={`${p.id}-${i}`}>
                  <td className="esq"><Link href={`/indireto/${p.id}`}>{p.nome_fantasia}</Link>{documentoDe(p) && <span className="nome-sub">{documentoDe(p)}</span>}</td>
                  <td className="esq">{p.ponto_focal_id ? nomes.get(p.ponto_focal_id) : <span className="fraco">—</span>}</td>
                  <td className="esq"><span className={`tag ${classeStatus(statusPor.get(p.status))}`}>{statusPor.get(p.status)?.nome || p.status}</span></td>
                  <td>{data ? fmtData(data, true) : <span className="fraco">—</span>}</td>
                  {ver === 'ativacoes' && (
                    <td className="esq">
                      {sit ? <span className={`tag ${ROTULO_ATIVACAO[sit.estado].classe}`}>{ROTULO_ATIVACAO[sit.estado].texto}</span> : '—'}
                      {p.venda_mes ? <span className="nome-sub">{p.venda_produto} em {p.venda_mes.slice(5)}/{p.venda_mes.slice(2, 4)}</span> : sit?.estado === 'prazo' && <span className="nome-sub">prazo até {fmtData(sit.prazo, true)}</span>}
                    </td>
                  )}
                </tr>
              ))}
              {!linhas.length && <tr><td colSpan={3 + colunas.length} className="fraco" style={{ textAlign: 'center', padding: 24 }}>Ninguém aqui.</td></tr>}
            </tbody>
          </table>
        </div>
        {TIPOS.includes(ver) && (sp.f === 'nao') && <p className="dica" style={{ marginTop: 6 }}>"Ainda não fizeram": parceiros ativos (status Ativo ou com data de ativação) que nunca tiveram este treinamento realizado.</p>}
      </section>

      <section className="assid-cartao" style={{ marginTop: 16 }}>
        <h2 style={{ marginBottom: 10 }}>Dia a dia de {MESES[Number(mes.slice(5)) - 1].toLowerCase()}</h2>
        <div className="tabela-wrap">
          <table>
            <thead><tr><th className="esq">Dia</th>{COLS.map(([k, r]) => <th key={k}>{r}</th>)}</tr></thead>
            <tbody>
              {dias.map(([d, v]) => (
                <tr key={d}>
                  <td className="esq">{SEMANA[new Date(`${d}T12:00:00Z`).getUTCDay()]}, {fmtData(d, true)}</td>
                  {COLS.map(([k]) => <td key={k}>{v[k] || <span className="fraco">—</span>}</td>)}
                </tr>
              ))}
              {!dias.length && <tr><td colSpan={COLS.length + 1} className="fraco" style={{ textAlign: 'center', padding: 24 }}>Nada neste mês.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
