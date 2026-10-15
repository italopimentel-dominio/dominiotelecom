import Link from 'next/link';
import { redirect } from 'next/navigation';
import { exigirSessao, podeVerIndireto } from '@/lib/auth';
import { hojeSP, somarDias } from '@/lib/datas';
import { fmtData } from '@/lib/formato';
import { TIPOS_TREINAMENTO, situacaoAtivacao } from '@/lib/indireto';
import { nomesDosPerfis, listarFocais } from '../dados';

const TIPOS = Object.keys(TIPOS_TREINAMENTO); // onboarding, telecom, servicos
const COLUNAS = [
  { k: 'cadastros', rotulo: 'Cadastros' },
  { k: 'ativacoes', rotulo: 'Ativações' },
  ...TIPOS.map((t) => ({ k: t, rotulo: `Trein. ${TIPOS_TREINAMENTO[t]}` })),
];
const dataSP = (ts) => new Date(new Date(ts).getTime() - 3 * 3600000).toISOString().slice(0, 10);
const segunda = (iso) => { const d = new Date(`${iso}T12:00:00Z`); const dia = (d.getUTCDay() + 6) % 7; return somarDias(iso, -dia); };
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export default async function AcompanhamentoIndireto({ searchParams }) {
  const sp = await searchParams;
  const { supabase, perfil } = await exigirSessao();
  if (!podeVerIndireto(perfil)) redirect('/');
  const hoje = hojeSP();
  const ok = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
  const de = ok(sp.de) ? sp.de : `${hoje.slice(0, 7)}-01`;
  const ate = ok(sp.ate) ? sp.ate : hoje;
  const por = ['dia', 'semana', 'mes'].includes(sp.por) ? sp.por : 'dia';

  const [{ data: parceiros = [] }, { data: treinos = [] }, nomes, focais] = await Promise.all([
    supabase.from('parceiros').select('id, nome_fantasia, criado_em, data_ativacao, ponto_focal_id, venda_mes'),
    supabase.from('parceiro_treinamentos').select('parceiro_id, tipo, data, status').eq('status', 'realizado').gte('data', de).lte('data', ate),
    nomesDosPerfis(supabase),
    listarFocais(supabase),
  ]);
  const focalDe = new Map((parceiros || []).map((p) => [p.id, p.ponto_focal_id]));
  const passaFocal = (pid) => !sp.focal || (sp.focal === 'sem' ? !focalDe.get(pid) : focalDe.get(pid) === sp.focal);
  const dentro = (d) => d && d >= de && d <= ate;

  // eventos do período: { data, tipo (coluna), parceiro }
  const eventos = [];
  (parceiros || []).forEach((p) => {
    const cad = p.criado_em ? dataSP(p.criado_em) : null;
    if (dentro(cad) && passaFocal(p.id)) eventos.push({ data: cad, k: 'cadastros', pid: p.id });
    if (dentro(p.data_ativacao) && passaFocal(p.id)) eventos.push({ data: p.data_ativacao, k: 'ativacoes', pid: p.id, boa: situacaoAtivacao(p, hoje)?.estado === 'boa' });
  });
  (treinos || []).forEach((t) => { if (TIPOS.includes(t.tipo) && passaFocal(t.parceiro_id)) eventos.push({ data: t.data, k: t.tipo, pid: t.parceiro_id }); });

  const chaveData = (d) => (por === 'mes' ? d.slice(0, 7) : por === 'semana' ? segunda(d) : d);
  const rotData = (c) => (por === 'mes' ? `${MESES[Number(c.slice(5)) - 1]}/${c.slice(0, 4)}` : por === 'semana' ? `semana de ${fmtData(c, true)}` : fmtData(c, true));
  const vazio = () => Object.fromEntries(COLUNAS.map((c) => [c.k, 0]));
  const porData = new Map();
  const porFocal = new Map();
  const total = vazio();
  let boas = 0;
  eventos.forEach((e) => {
    const cd = chaveData(e.data);
    if (!porData.has(cd)) porData.set(cd, vazio());
    porData.get(cd)[e.k]++;
    const f = focalDe.get(e.pid) || 'sem';
    if (!porFocal.has(f)) porFocal.set(f, vazio());
    porFocal.get(f)[e.k]++;
    total[e.k]++;
    if (e.boa) boas++;
  });
  const linhasData = [...porData.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const linhasFocal = [...porFocal.entries()].map(([f, v]) => ({ f, nome: f === 'sem' ? 'Sem ponto focal' : nomes.get(f) || '—', v }))
    .sort((a, b) => COLUNAS.reduce((s, c) => s + b.v[c.k], 0) - COLUNAS.reduce((s, c) => s + a.v[c.k], 0));
  const maxCel = Math.max(1, ...linhasData.flatMap(([, v]) => COLUNAS.map((c) => v[c.k])));

  // atalhos de período
  const mesAtual = hoje.slice(0, 7);
  const ini = (m) => `${m}-01`;
  const fimMes = (m) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5)), 0)).toISOString().slice(0, 10);
  const mesPassado = new Date(Date.UTC(Number(mesAtual.slice(0, 4)), Number(mesAtual.slice(5)) - 2, 1)).toISOString().slice(0, 7);
  const atalhos = [
    ['Hoje', hoje, hoje], ['Últimos 7 dias', somarDias(hoje, -6), hoje], ['Este mês', ini(mesAtual), hoje],
    ['Mês passado', ini(mesPassado), fimMes(mesPassado)], ['Últimos 90 dias', somarDias(hoje, -89), hoje],
  ];
  const url = (extra) => { const q = new URLSearchParams({ de, ate, por, ...(sp.focal ? { focal: sp.focal } : {}), ...extra }); [...q.keys()].forEach((k) => !q.get(k) && q.delete(k)); return `/indireto/acompanhamento?${q}`; };

  const celula = (n) => (n ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', width: '100%' }}>
      <span className="barra-meta" style={{ width: 60 }}><span style={{ width: `${Math.round((n / maxCel) * 100)}%`, background: 'var(--acento)' }} /></span>
      <b style={{ minWidth: 22, textAlign: 'right' }}>{n}</b>
    </span>
  ) : <span className="fraco">—</span>);

  return (
    <>
      <div className="assid-topo">
        <div>
          <h1 style={{ margin: 0 }}>Acompanhamento</h1>
          <p className="sub" style={{ marginTop: 4 }}>Cadastros, ativações e treinamentos realizados por data, de {fmtData(de, true)} a {fmtData(ate, true)}.</p>
        </div>
      </div>

      <form className="bloco campos" style={{ margin: '0 0 10px', alignItems: 'flex-end' }} method="get">
        <label className="campo">De<input type="date" name="de" defaultValue={de} /></label>
        <label className="campo">Até<input type="date" name="ate" defaultValue={ate} /></label>
        <label className="campo">Agrupar por
          <select name="por" defaultValue={por}><option value="dia">Dia</option><option value="semana">Semana</option><option value="mes">Mês</option></select>
        </label>
        <label className="campo">Ponto focal
          <select name="focal" defaultValue={sp.focal || ''}>
            <option value="">Todos</option>
            {focais.map((f) => <option key={f.id} value={f.id}>{f.nome || f.usuario}</option>)}
            <option value="sem">Sem ponto focal</option>
          </select>
        </label>
        <button className="btn btn-sec" type="submit">Filtrar</button>
      </form>
      <div className="tf-agrupar">
        <span className="dica">Atalhos:</span>
        {atalhos.map(([r, a, b]) => <Link key={r} href={url({ de: a, ate: b })} className={`btn btn-peq ${de === a && ate === b ? '' : 'btn-sec'}`}>{r}</Link>)}
      </div>

      <div className="calendario" style={{ marginTop: 6 }}>
        <div><b>{total.cadastros}</b><span>cadastros realizados</span></div>
        <div><b>{total.ativacoes}</b><span>ativações{total.ativacoes ? ` · ${boas} boas (venda em 30 dias)` : ''}</span></div>
        {TIPOS.map((t) => <div key={t}><b>{total[t]}</b><span>treinamentos de {TIPOS_TREINAMENTO[t].toLowerCase()}</span></div>)}
      </div>

      <section className="assid-cartao" style={{ marginTop: 16 }}>
        <h2 style={{ marginBottom: 10 }}>Por {por === 'mes' ? 'mês' : por}</h2>
        <div className="tabela-wrap tabela-fixa">
          <table>
            <thead><tr><th className="esq">{por === 'mes' ? 'Mês' : por === 'semana' ? 'Semana' : 'Data'}</th>{COLUNAS.map((c) => <th key={c.k}>{c.rotulo}</th>)}</tr></thead>
            <tbody>
              {linhasData.map(([cd, v]) => (
                <tr key={cd}>
                  <td className="esq">{rotData(cd)}</td>
                  {COLUNAS.map((c) => <td key={c.k}>{celula(v[c.k])}</td>)}
                </tr>
              ))}
              {!linhasData.length && <tr><td colSpan={COLUNAS.length + 1} className="fraco" style={{ textAlign: 'center', padding: 24 }}>Nada no período.</td></tr>}
              {linhasData.length > 0 && (
                <tr className="linha-total"><td className="esq"><b>Total</b></td>{COLUNAS.map((c) => <td key={c.k}><b>{total[c.k]}</b></td>)}</tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="assid-cartao" style={{ marginTop: 16 }}>
        <h2 style={{ marginBottom: 10 }}>Por ponto focal</h2>
        <div className="tabela-wrap">
          <table>
            <thead><tr><th className="esq">Ponto focal</th>{COLUNAS.map((c) => <th key={c.k}>{c.rotulo}</th>)}</tr></thead>
            <tbody>
              {linhasFocal.map((l) => (
                <tr key={l.f}>
                  <td className="esq">{l.f !== 'sem' ? <Link href={url({ focal: l.f })}>{l.nome}</Link> : l.nome}</td>
                  {COLUNAS.map((c) => <td key={c.k}>{l.v[c.k] || <span className="fraco">—</span>}</td>)}
                </tr>
              ))}
              {!linhasFocal.length && <tr><td colSpan={COLUNAS.length + 1} className="fraco" style={{ textAlign: 'center', padding: 24 }}>Nada no período.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="dica" style={{ marginTop: 6 }}>
          Cadastro = data em que o parceiro foi criado no sistema · Ativação = data de ativação do parceiro · Treinamento = data dos treinamentos marcados como realizados.
          Tudo é atribuído ao ponto focal atual do parceiro.
        </p>
      </section>
    </>
  );
}
