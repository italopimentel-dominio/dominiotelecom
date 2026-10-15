import Link from 'next/link';
import { redirect } from 'next/navigation';
import { exigirSessao, podeVerIndireto } from '@/lib/auth';
import { hojeSP } from '@/lib/datas';
import { fmtData } from '@/lib/formato';
import { TIPOS_TREINAMENTO, situacaoAtivacao, ROTULO_ATIVACAO, classeStatus, documentoDe } from '@/lib/indireto';
import { nomesDosPerfis, listarStatus } from '../dados';
import SeletorMes from '@/components/SeletorMes';
import { mesesAoRedor, nomeMes } from '@/lib/meses';

const TIPOS = Object.keys(TIPOS_TREINAMENTO); // onboarding, telecom, servicos
const CURTO = { onboarding: 'ONB', telecom: 'Telecom', servicos: 'Serviços' };
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const dataSP = (ts) => new Date(new Date(ts).getTime() - 3 * 3600000).toISOString().slice(0, 10);
const dm = (iso) => `${iso.slice(8)}/${iso.slice(5, 7)}`;

// Filtros (todos combináveis; clicar de novo desliga):
//   mov = cad | atv | trn   (movimento no mês)
//   sit = boa | naoboa | prazo | fora | sem   (situação da ativação)
//   onboarding / telecom / servicos = fez | naofez
export default async function AcompanhamentoIndireto({ searchParams }) {
  const sp = await searchParams;
  const { supabase, perfil } = await exigirSessao();
  if (!podeVerIndireto(perfil)) redirect('/');
  const hoje = hojeSP();
  const mes = /^\d{4}-\d{2}$/.test(sp.mes || '') ? sp.mes : hoje.slice(0, 7);
  const focal = sp.focal || '';
  const F = { mov: sp.mov || '', sit: sp.sit || '', ...Object.fromEntries(TIPOS.map((t) => [t, sp[t] || ''])) };

  const [{ data: parceiros = [] }, { data: treinos = [] }, nomes, statusLista] = await Promise.all([
    supabase.from('parceiros').select('id, nome_fantasia, cpf, cnpj, status, criado_em, data_ativacao, ponto_focal_id, venda_mes, venda_produto').limit(10000),
    supabase.from('parceiro_treinamentos').select('parceiro_id, tipo, data, status').eq('status', 'realizado').limit(20000),
    nomesDosPerfis(supabase),
    listarStatus(supabase),
  ]);
  const statusPor = new Map(statusLista.map((s) => [s.chave, s]));
  const noMes = (d) => !!d && d.startsWith(mes);

  // treinamento mais recente de cada parceiro por tipo
  const ultimo = new Map();
  (treinos || []).forEach((t) => { const k = `${t.parceiro_id}|${t.tipo}`; if (!ultimo.has(k) || t.data > ultimo.get(k)) ultimo.set(k, t.data); });
  const treinouNoMes = new Map(); // pid|tipo -> data no mês
  (treinos || []).forEach((t) => { if (noMes(t.data)) treinouNoMes.set(`${t.parceiro_id}|${t.tipo}`, t.data); });

  // uma linha por parceiro, com tudo o que importa no mês
  const todos = (parceiros || []).map((p) => {
    const cad = p.criado_em ? dataSP(p.criado_em) : null;
    const sit = situacaoAtivacao(p, hoje);
    const tr = Object.fromEntries(TIPOS.map((t) => [t, { ultimo: ultimo.get(`${p.id}|${t}`) || null, noMes: treinouNoMes.get(`${p.id}|${t}`) || null }]));
    return {
      p, cad, sit, tr,
      cadNoMes: noMes(cad), atvNoMes: noMes(p.data_ativacao), trnNoMes: TIPOS.some((t) => tr[t].noMes),
      oculto: !!statusPor.get(p.status)?.oculto,
    };
  });
  const doFocal = (x) => !focal || (focal === 'sem' ? !x.p.ponto_focal_id : x.p.ponto_focal_id === focal);
  const base = todos.filter(doFocal);

  // contadores (sobre o ponto focal escolhido)
  const c = {
    cad: base.filter((x) => x.cadNoMes).length,
    atv: base.filter((x) => x.atvNoMes).length,
    trn: base.filter((x) => x.trnNoMes).length,
    boa: base.filter((x) => x.atvNoMes && x.sit?.estado === 'boa').length,
    naoboa: base.filter((x) => x.atvNoMes && x.sit && x.sit.estado !== 'boa').length,
  };
  TIPOS.forEach((t) => { c[`${t}_mes`] = base.filter((x) => x.tr[t].noMes).length; });

  // aplica os filtros
  const passa = (x) => {
    if (F.mov === 'cad' && !x.cadNoMes) return false;
    if (F.mov === 'atv' && !x.atvNoMes) return false;
    if (F.mov === 'trn' && !x.trnNoMes) return false;
    if (F.sit) {
      if (!x.sit) return false;
      if (F.sit === 'naoboa' ? x.sit.estado === 'boa' : x.sit.estado !== F.sit) return false;
    }
    for (const t of TIPOS) {
      if (F[t] === 'fez' && !x.tr[t].ultimo) return false;
      if (F[t] === 'naofez' && x.tr[t].ultimo) return false;
    }
    return true;
  };
  const algumFiltro = F.mov || F.sit || TIPOS.some((t) => F[t]);
  // sem filtro: parceiros com movimento no mês + ativos/ativados (a visão geral); com filtro: todos que passam
  const lista = base
    .filter((x) => (algumFiltro ? !x.oculto || x.cadNoMes || x.atvNoMes : x.cadNoMes || x.atvNoMes || x.trnNoMes || (!x.oculto && (x.p.status === 'ativo' || x.p.data_ativacao))))
    .filter(passa)
    .sort((a, b) => {
      const ra = [a.atvNoMes && a.p.data_ativacao, a.cadNoMes && a.cad, ...TIPOS.map((t) => a.tr[t].noMes)].filter(Boolean).sort().pop() || '';
      const rb = [b.atvNoMes && b.p.data_ativacao, b.cadNoMes && b.cad, ...TIPOS.map((t) => b.tr[t].noMes)].filter(Boolean).sort().pop() || '';
      return rb.localeCompare(ra) || (a.p.nome_fantasia || '').localeCompare(b.p.nome_fantasia || '');
    });

  // contagem de treinamento (fez / não fez) dentro da lista sem o próprio filtro daquele tipo
  const contaTreino = (t, v) => base.filter((x) => !x.oculto || x.cadNoMes || x.atvNoMes).filter((x) => (v === 'fez' ? x.tr[t].ultimo : !x.tr[t].ultimo)).length;

  const url = (extra) => {
    const q = new URLSearchParams({ mes, ...(focal ? { focal } : {}), ...Object.fromEntries(Object.entries(F).filter(([, v]) => v)), ...extra });
    [...q.keys()].forEach((k) => !q.get(k) && q.delete(k));
    return `/indireto/acompanhamento?${q}`;
  };
  const alterna = (k, v) => url({ [k]: F[k] === v ? '' : v });
  const Chip = ({ k, v, children, cor }) => (
    <Link href={alterna(k, v)} className={`chip-acomp${F[k] === v ? ' sel' : ''}`} aria-pressed={F[k] === v}>
      {cor && <i className="ponto-chip" style={{ background: cor }} />}{children}
    </Link>
  );

  // cartões dos pontos focais
  const idsFocais = [...new Set((parceiros || []).map((p) => p.ponto_focal_id || 'sem'))];
  const cartoes = idsFocais.map((f) => {
    const l = todos.filter((x) => (x.p.ponto_focal_id || 'sem') === f);
    return {
      f, nome: f === 'sem' ? 'Sem ponto focal' : nomes.get(f) || '—', parceiros: l.length,
      atv: l.filter((x) => x.atvNoMes).length, boa: l.filter((x) => x.atvNoMes && x.sit?.estado === 'boa').length,
      cad: l.filter((x) => x.cadNoMes).length, trn: l.reduce((s, x) => s + TIPOS.filter((t) => x.tr[t].noMes).length, 0),
    };
  }).sort((a, b) => (a.f === 'sem') - (b.f === 'sem') || b.atv - a.atv || a.nome.localeCompare(b.nome));
  const todosResumo = { atv: todos.filter((x) => x.atvNoMes).length, boa: todos.filter((x) => x.atvNoMes && x.sit?.estado === 'boa').length, cad: todos.filter((x) => x.cadNoMes).length, trn: todos.reduce((s, x) => s + TIPOS.filter((t) => x.tr[t].noMes).length, 0) };
  const nomeFocal = focal ? cartoes.find((x) => x.f === focal)?.nome : null;

  // dia a dia (ponto focal escolhido)
  const porDia = new Map();
  const soma = (d, k) => { if (!porDia.has(d)) porDia.set(d, { cad: 0, atv: 0, ...Object.fromEntries(TIPOS.map((t) => [t, 0])) }); porDia.get(d)[k]++; };
  base.forEach((x) => {
    if (x.cadNoMes) soma(x.cad, 'cad');
    if (x.atvNoMes) soma(x.p.data_ativacao, 'atv');
    TIPOS.forEach((t) => { if (x.tr[t].noMes) soma(x.tr[t].noMes, t); });
  });
  const dias = [...porDia.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  const Treino = ({ v }) => (v.noMes
    ? <span className="tag tag-ok" title="Feito neste mês">✓ {dm(v.noMes)}</span>
    : v.ultimo ? <span className="dica" title="Feito antes deste mês">✓ {dm(v.ultimo)}</span>
    : <span className="tag tag-risco">pendente</span>);

  return (
    <>
      <div className="assid-topo">
        <div>
          <h1 style={{ margin: 0 }}>Acompanhamento{nomeFocal ? ` · ${nomeFocal}` : ''}</h1>
          <p className="sub" style={{ marginTop: 4 }}>Uma lista com cadastro, ativação e treinamentos de cada parceiro. Clique nos filtros para ir recortando; clique de novo para tirar.</p>
        </div>
        <SeletorMes mes={mes} meses={mesesAoRedor(hoje.slice(0, 7))} />
      </div>

      <nav className="equipes-assid" aria-label="Pontos focais">
        <Link href={url({ focal: '' })} className={`cartao-equipe${!focal ? ' sel' : ''}`} aria-current={!focal ? 'true' : undefined}>
          <span className="linha1"><span className="nome">Todos</span><span className="dica">{todos.length} parceiros</span></span>
          <span className="pct">{todosResumo.atv}</span>
          <span className="dica" style={{ marginTop: -4 }}>ativações · {todosResumo.boa} boas</span>
          <span className="dica">{todosResumo.cad} cadastros · {todosResumo.trn} treinamentos</span>
        </Link>
        {cartoes.map((x) => (
          <Link key={x.f} href={url({ focal: focal === x.f ? '' : x.f })} className={`cartao-equipe${focal === x.f ? ' sel' : ''}`} aria-current={focal === x.f ? 'true' : undefined}>
            <span className="linha1"><span className="nome">{x.nome}</span><span className="dica">{x.parceiros} parceiros</span></span>
            <span className="pct">{x.atv}</span>
            <span className="dica" style={{ marginTop: -4 }}>ativações · {x.boa} boas</span>
            <span className="dica">{x.cad} cadastros · {x.trn} treinamentos</span>
          </Link>
        ))}
      </nav>

      <section className="assid-cartao filtros-acomp" aria-label="Filtros">
        <div className="grupo-filtro"><span className="rot">No mês</span>
          <Chip k="mov" v="cad">Cadastrados ({c.cad})</Chip>
          <Chip k="mov" v="atv">Ativados ({c.atv})</Chip>
          <Chip k="mov" v="trn">Treinados ({c.trn})</Chip>
        </div>
        <div className="grupo-filtro"><span className="rot">Ativação</span>
          <Chip k="sit" v="boa" cor="var(--ok)">Boa ({c.boa})</Chip>
          <Chip k="sit" v="naoboa" cor="var(--risco)">Não boa ({c.naoboa})</Chip>
          {Object.entries(ROTULO_ATIVACAO).filter(([e]) => e !== 'boa').map(([e, r]) => (
            <Chip key={e} k="sit" v={e}>{r.texto}</Chip>
          ))}
        </div>
        {TIPOS.map((t) => (
          <div key={t} className="grupo-filtro"><span className="rot">{TIPOS_TREINAMENTO[t]}</span>
            <Chip k={t} v="fez" cor="var(--ok)">Fez ({contaTreino(t, 'fez')})</Chip>
            <Chip k={t} v="naofez" cor="var(--risco)">Não fez ({contaTreino(t, 'naofez')})</Chip>
          </div>
        ))}
        {algumFiltro && <Link href={url({ mov: '', sit: '', ...Object.fromEntries(TIPOS.map((t) => [t, ''])) })} className="btn btn-sec btn-peq" style={{ alignSelf: 'flex-start' }}>Limpar filtros</Link>}
      </section>

      <section className="assid-cartao" style={{ marginTop: 14 }}>
        <div className="assid-cab">
          <h2>{lista.length} {lista.length === 1 ? 'parceiro' : 'parceiros'}{nomeFocal ? ` · ${nomeFocal}` : ''}</h2>
          <span className="dica">{algumFiltro ? 'Com os filtros acima.' : `Visão geral de ${nomeMes(mes).toLowerCase()}: quem teve movimento no mês e os parceiros ativos.`}</span>
        </div>
        <div className="tabela-wrap tabela-fixa" style={{ maxHeight: 560 }}>
          <table>
            <thead>
              <tr>
                <th className="esq">Parceiro</th><th className="esq">Ponto focal</th><th className="esq">Status</th>
                <th>Cadastro</th><th className="esq">Ativação</th>{TIPOS.map((t) => <th key={t} className="esq">{CURTO[t]}</th>)}
              </tr>
            </thead>
            <tbody>
              {lista.map((x) => (
                <tr key={x.p.id}>
                  <td className="esq"><Link href={`/indireto/${x.p.id}`}>{x.p.nome_fantasia}</Link>{documentoDe(x.p) && <span className="nome-sub">{documentoDe(x.p)}</span>}</td>
                  <td className="esq">{x.p.ponto_focal_id ? nomes.get(x.p.ponto_focal_id) : <span className="fraco">—</span>}</td>
                  <td className="esq"><span className={`tag ${classeStatus(statusPor.get(x.p.status))}`}>{statusPor.get(x.p.status)?.nome || x.p.status}</span></td>
                  <td>{x.cad ? <span className={x.cadNoMes ? '' : 'dica'}>{fmtData(x.cad, true)}</span> : <span className="fraco">—</span>}</td>
                  <td className="esq">
                    {x.p.data_ativacao ? (
                      <>
                        <span className={x.atvNoMes ? '' : 'dica'}>{fmtData(x.p.data_ativacao, true)}</span>{' '}
                        {x.sit && <span className={`tag ${ROTULO_ATIVACAO[x.sit.estado].classe}`}>{ROTULO_ATIVACAO[x.sit.estado].texto}</span>}
                        {x.p.venda_mes ? <span className="nome-sub">{x.p.venda_produto} em {x.p.venda_mes.slice(5)}/{x.p.venda_mes.slice(2, 4)}</span> : x.sit?.estado === 'prazo' && <span className="nome-sub">prazo até {fmtData(x.sit.prazo, true)}</span>}
                      </>
                    ) : <span className="fraco">não ativado</span>}
                  </td>
                  {TIPOS.map((t) => <td key={t} className="esq"><Treino v={x.tr[t]} /></td>)}
                </tr>
              ))}
              {!lista.length && <tr><td colSpan={5 + TIPOS.length} className="fraco" style={{ textAlign: 'center', padding: 24 }}>Ninguém com esses filtros.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="dica" style={{ marginTop: 6 }}>Datas em preto = deste mês; em cinza = de meses anteriores. Treinamento: verde = feito neste mês · cinza = feito antes · vermelho = ainda não feito.</p>
      </section>

      <section className="assid-cartao" style={{ marginTop: 16 }}>
        <h2 style={{ marginBottom: 10 }}>Dia a dia de {nomeMes(mes).toLowerCase()}</h2>
        <div className="tabela-wrap">
          <table>
            <thead><tr><th className="esq">Dia</th><th>Cadastros</th><th>Ativações</th>{TIPOS.map((t) => <th key={t}>{TIPOS_TREINAMENTO[t]}</th>)}</tr></thead>
            <tbody>
              {dias.map(([d, v]) => (
                <tr key={d}>
                  <td className="esq">{SEMANA[new Date(`${d}T12:00:00Z`).getUTCDay()]}, {fmtData(d, true)}</td>
                  <td>{v.cad || <span className="fraco">—</span>}</td><td>{v.atv || <span className="fraco">—</span>}</td>
                  {TIPOS.map((t) => <td key={t}>{v[t] || <span className="fraco">—</span>}</td>)}
                </tr>
              ))}
              {!dias.length && <tr><td colSpan={3 + TIPOS.length} className="fraco" style={{ textAlign: 'center', padding: 24 }}>Nada neste mês.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
