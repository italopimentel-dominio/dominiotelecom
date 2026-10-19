import Link from 'next/link';
import { redirect } from 'next/navigation';
import { exigirSessao, podeVerIndireto, podeEditarIndireto, podeValidarIndireto } from '@/lib/auth';
import { hojeSP, somarDias } from '@/lib/datas';
import { fmtData } from '@/lib/formato';
import { normalizar } from '@/lib/nomes';
import { classeStatus, TIPOS_TREINAMENTO, ROTULO_SITUACAO, VALIDACAO, situacaoTreinamento, faltasValidacao, documentoDe, fmtCnpj, fmtCpf, soDigitos } from '@/lib/indireto';
import FormAcao from '@/components/FormAcao';
import AcaoFormulario from '@/components/AcaoFormulario';
import RegistrarTreinoRapido from '@/components/RegistrarTreinoRapido';
import LinksGerais from '@/components/LinksGerais';
import { PilulasFocais, FaixaAtivos, urlCom, lista } from '@/components/Filtros';
import MenuFiltro from '@/components/MenuFiltro';
import SeletorMes from '@/components/SeletorMes';
import { mesesAoRedor } from '@/lib/meses';
import { vincularResposta, ignorarResposta } from '@/app/actions/indireto';
import { nomesDosPerfis, listarFocais, listarStatus } from '../dados';

const TIPOS = Object.keys(TIPOS_TREINAMENTO);

export default async function TreinamentosIndireto({ searchParams }) {
  const sp = await searchParams;
  const { supabase, perfil } = await exigirSessao();
  if (!podeVerIndireto(perfil)) redirect('/');
  const editar = podeEditarIndireto(perfil);
  const gerente = podeValidarIndireto(perfil);
  const hoje = hojeSP();

  const [{ data: parceiros = [] }, { data: treinos = [] }, { data: respostas = [] }, links, nomes, focais, statusLista, gerais] = await Promise.all([
    supabase.from('parceiros').select('id, nome_fantasia, razao_social, cpf, cnpj, codigo, status, ponto_focal_id, validacao, venda_mes, contato_nome, contato_telefone').order('nome_fantasia'),
    supabase.from('parceiro_treinamentos').select('id, parceiro_id, tipo, data, status'),
    supabase.from('parceiro_respostas_form').select('id, parceiro_id, respondido_em, nome, documento, email, tipo_treinamento, ignorada, acertos, total_pontuavel').eq('ignorada', false).order('respondido_em', { ascending: false }),
    supabase.from('form_links').select('token, parceiro_id, tipo').is('respondido_em', null).gt('expira_em', new Date().toISOString()),
    nomesDosPerfis(supabase),
    listarFocais(supabase),
    listarStatus(supabase),
    supabase.from('form_links_gerais').select('tipo, token'),
  ]);
  const linksGerais = Object.fromEntries((gerais.error ? [] : gerais.data || []).map((g) => [g.tipo, g.token]));
  const statusPor = new Map(statusLista.map((st) => [st.chave, st]));
  const oculto = (p) => !!statusPor.get(p.status)?.oculto;

  const treinosDe = new Map();
  (treinos || []).forEach((t) => { if (!treinosDe.has(t.parceiro_id)) treinosDe.set(t.parceiro_id, []); treinosDe.get(t.parceiro_id).push(t); });
  const formDe = new Map(); // parceiro -> { tipo: resposta mais recente }
  (respostas || []).filter((r) => r.parceiro_id).forEach((r) => {
    const m = formDe.get(r.parceiro_id) || {};
    if (!m[r.tipo_treinamento]) m[r.tipo_treinamento] = r;
    formDe.set(r.parceiro_id, m);
  });
  const linkDe = new Map((links.error ? [] : links.data || []).map((l) => [`${l.parceiro_id}:${l.tipo}`, l.token]));

  const linhas = (parceiros || []).map((p) => {
    const lista = treinosDe.get(p.id) || [];
    const forms = formDe.get(p.id) || {};
    const sit = Object.fromEntries(TIPOS.map((t) => [t, situacaoTreinamento(lista, t, hoje)]));
    const respondidos = TIPOS.filter((t) => forms[t]).length;
    return { ...p, sit, forms, respondidos, faltas: p.validacao === 'pendente' ? faltasValidacao(p, lista, new Set(Object.keys(forms))) : [] };
  });

  // ---------- filtros (todos se combinam) ----------
  // mes (treinamento realizado no mês, qualquer tipo | 'todos'), focal, status/comp/aguard e t_<tipo>/f_<tipo> (listas), q
  const mesSel = /^\d{4}-\d{2}$/.test(sp.mes || '') || sp.mes === 'todos' ? sp.mes : hoje.slice(0, 7);
  const treinouNoMes = new Set((treinos || []).filter((t) => t.status === 'realizado' && mesSel !== 'todos' && (t.data || '').startsWith(mesSel)).map((t) => t.parceiro_id));
  const FIL = { mes: mesSel, focal: sp.focal || '', status: lista(sp.status), comp: lista(sp.comp), aguard: lista(sp.aguard), q: sp.q || '' };
  TIPOS.forEach((t) => { FIL[`t_${t}`] = lista(sp[`t_${t}`]); FIL[`f_${t}`] = lista(sp[`f_${t}`]); });
  const b = normalizar(FIL.q);
  const bDig = soDigitos(FIL.q);
  const temLink = (p) => TIPOS.some((t) => linkDe.has(`${p.id}:${t}`));
  const um = {
    mes: (p, v) => v === 'todos' || treinouNoMes.has(p.id),
    focal: (p, v) => (v === 'sem' ? !p.ponto_focal_id : p.ponto_focal_id === v),
    status: (p, v) => p.status === v,
    comp: (p, v) => (v === '3' ? p.respondidos === 3 : v === '1' ? p.respondidos === 2 : p.respondidos <= 1),
    aguard: (p) => temLink(p),
    q: (p) => {
      const alvo = normalizar([p.nome_fantasia, p.razao_social, p.codigo, p.contato_nome].join(' '));
      return alvo.includes(b) || (bDig.length >= 4 && ((p.cnpj || '').includes(bDig) || (p.cpf || '').includes(bDig)));
    },
  };
  TIPOS.forEach((t) => {
    um[`t_${t}`] = (p, v) => (v === 'fez' ? p.sit[t].estado === 'realizado' : p.sit[t].estado !== 'realizado');
    um[`f_${t}`] = (p, v) => (v === 'sim' ? !!p.forms[t] : !p.forms[t]);
  });
  const vazio = (v) => !v || (Array.isArray(v) && !v.length);
  const testa = (k, p, v) => (Array.isArray(v) ? v.some((x) => um[k](p, x)) : um[k](p, v));
  const passa = (p, exceto) => {
    if (!FIL.status.length && exceto !== 'status' && oculto(p) && !FIL.q) return false;
    return Object.entries(FIL).every(([k, v]) => vazio(v) || k === exceto || testa(k, p, v));
  };
  const filtradas = linhas.filter((p) => passa(p));
  const conta = (k, v) => linhas.filter((p) => passa(p, k) && um[k](p, v)).length;
  const urlF = (extra) => urlCom('/indireto/treinamentos', { ...FIL, ...(sp.por ? { por: sp.por } : {}) }, extra);
  const focaisIds = [...new Set(linhas.map((p) => p.ponto_focal_id || 'sem'))];
  const pilulas = [{ id: '', nome: 'Todos' }, ...focaisIds.map((f) => ({ id: f, nome: f === 'sem' ? 'Sem ponto focal' : nomes.get(f) || '—' }))]
    .map((c) => ({ ...c, n: linhas.filter((p) => passa(p, 'focal') && (!c.id || um.focal(p, c.id))).length }))
    .sort((a, b2) => (!a.id ? -1 : !b2.id ? 1 : (a.id === 'sem') - (b2.id === 'sem') || b2.n - a.n || a.nome.localeCompare(b2.nome)));
  const menus = [
    ...TIPOS.map((t) => ({ rotulo: TIPOS_TREINAMENTO[t], opcoes: [
      { titulo: 'Treinamento' },
      { param: `t_${t}`, v: 'fez', t: 'Realizado', cor: 'var(--ok)', n: conta(`t_${t}`, 'fez') },
      { param: `t_${t}`, v: 'nao', t: 'Não realizado', cor: 'var(--risco)', n: conta(`t_${t}`, 'nao') },
      { titulo: 'Formulário' },
      { param: `f_${t}`, v: 'sim', t: 'Respondido', cor: 'var(--ok)', n: conta(`f_${t}`, 'sim') },
      { param: `f_${t}`, v: 'nao', t: 'Sem resposta', cor: 'var(--risco)', n: conta(`f_${t}`, 'nao') },
    ] })),
    { rotulo: 'Formulários', opcoes: [
      { param: 'comp', v: '3', t: 'Os 3 respondidos', cor: 'var(--ok)', n: conta('comp', '3') },
      { param: 'comp', v: '1', t: 'Faltando 1', n: conta('comp', '1') },
      { param: 'comp', v: '2', t: 'Faltando 2 ou 3', cor: 'var(--risco)', n: conta('comp', '2') },
      { param: 'aguard', v: '1', t: 'Link aguardando resposta', cor: 'var(--atencao)', n: conta('aguard', '1') },
    ] },
    { rotulo: 'Status', opcoes: statusLista.map((st) => ({ param: 'status', v: st.chave, t: st.nome, n: conta('status', st.chave) })) },
  ];
  const ROT_PARAM = Object.fromEntries([...TIPOS.flatMap((t) => [[`t_${t}`, `${TIPOS_TREINAMENTO[t]}`], [`f_${t}`, `Formulário ${TIPOS_TREINAMENTO[t].toLowerCase()}`]]), ['comp', 'Formulários'], ['aguard', 'Formulários'], ['status', 'Status']]);
  const nomeOp = (k, v) => menus.flatMap((m) => m.opcoes).find((o) => o.param === k && o.v === v)?.t || v;
  const ativosF = [
    ...(FIL.focal ? [{ chave: 'focal', t: pilulas.find((x) => x.id === FIL.focal)?.nome || 'Ponto focal', href: urlF({ focal: '' }) }] : []),
    ...Object.keys(ROT_PARAM).flatMap((k) => (FIL[k] || []).map((v) => ({ chave: `${k}-${v}`, t: `${ROT_PARAM[k]}: ${nomeOp(k, v)}`, href: urlF({ [k]: FIL[k].filter((x) => x !== v) }) }))),
    ...(FIL.q ? [{ chave: 'q', t: `Busca: "${FIL.q}"`, href: urlF({ q: '' }) }] : []),
  ];
  const limparTudo = urlF(Object.fromEntries(Object.keys(FIL).filter((k) => k !== 'mes').map((k) => [k, ''])));
  const totalBase = linhas.filter((p) => um.mes(p, FIL.mes) && !oculto(p)).length;

  const POR_PAGINA = [25, 50, 100];
  const porPagina = POR_PAGINA.includes(Number(sp.por)) ? Number(sp.por) : 25;
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const pagina = Math.min(Math.max(1, Number(sp.pag) || 1), totalPaginas);
  const daPagina = filtradas.slice((pagina - 1) * porPagina, pagina * porPagina);
  const linkPagina = (n, por = porPagina) => {
    const q = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== 'pag' && k !== 'por'));
    if (n > 1) q.set('pag', String(n));
    if (por !== 25) q.set('por', String(por));
    const t = q.toString();
    return t ? `/indireto/treinamentos?${t}` : '/indireto/treinamentos';
  };
  const paginacao = filtradas.length > 0 && (
    <div className="paginacao">
      <span className="dica">{(pagina - 1) * porPagina + 1}–{Math.min(pagina * porPagina, filtradas.length)} de {filtradas.length} parceiros</span>
      <div className="paginacao-botoes">
        {pagina > 1 ? <Link className="btn btn-sec btn-peq" href={linkPagina(pagina - 1)}>‹ Anterior</Link> : <span className="btn btn-sec btn-peq desligado">‹ Anterior</span>}
        <span className="dica">Página {pagina} de {totalPaginas}</span>
        {pagina < totalPaginas ? <Link className="btn btn-sec btn-peq" href={linkPagina(pagina + 1)}>Próxima ›</Link> : <span className="btn btn-sec btn-peq desligado">Próxima ›</span>}
      </div>
      <span className="dica">Por página:{' '}{POR_PAGINA.map((n) => (n === porPagina ? <b key={n} style={{ margin: '0 4px' }}>{n}</b> : <Link key={n} href={linkPagina(1, n)} style={{ margin: '0 4px' }}>{n}</Link>))}</span>
    </div>
  );

  const limite = somarDias(hoje, 14);
  const agenda = (treinos || []).filter((t) => t.status === 'agendado' && t.data >= hoje && t.data <= limite).sort((x, y) => x.data.localeCompare(y.data));
  const proximos = agenda.length;
  const nomeParceiro = new Map(linhas.map((p) => [p.id, p.nome_fantasia]));
  const semVinculo = (respostas || []).filter((r) => !r.parceiro_id);

  return (
    <>
      <div className="topo">
        <div>
          <h1>Treinamentos</h1>
          <p className="sub">
            Parceiros com treinamento realizado no mês escolhido (qualquer tipo); "Todos os meses" mostra todos. Os 3 treinamentos (Onboarding, Telecom e Serviços) e os formulários de confirmação.
            O parceiro é validado sozinho quando todo treinamento realizado tem o formulário respondido e ele tem venda vinculada.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {gerente && <Link className="btn btn-sec" href="/indireto/perguntas">Perguntas dos formulários</Link>}
          <SeletorMes mes={FIL.mes} meses={mesesAoRedor(hoje.slice(0, 7))} comTodos limpar={['pag']} />
        </div>
      </div>

      <section className="barra-filtros" aria-label="Filtros">
        <PilulasFocais itens={pilulas} selecionado={FIL.focal} hrefDe={(id) => urlF({ focal: id })} />
        <div className="linha-menus">
          {menus.map((m) => <MenuFiltro key={m.rotulo} rotulo={m.rotulo} opcoes={m.opcoes} />)}
          <form method="get" className="busca-filtro" action="/indireto/treinamentos">
            {Object.entries(FIL).filter(([k, v]) => !vazio(v) && k !== 'q').map(([k, v]) => <input key={k} type="hidden" name={k} value={Array.isArray(v) ? v.join(',') : v} />)}
            <input type="text" name="q" defaultValue={FIL.q} placeholder="Buscar nome, CNPJ, contato" aria-label="Buscar" />
            <button className="btn btn-sec btn-peq" type="submit">Buscar</button>
          </form>
        </div>
        <FaixaAtivos total={totalBase} filtrados={filtradas.length} ativos={ativosF} limparHref={limparTudo} />
        {(semVinculo.length > 0 || proximos > 0) && (
          <p className="dica" style={{ margin: 0 }}>
            {semVinculo.length > 0 && <a href="#respostas">{semVinculo.length} respostas sem parceiro</a>}
            {semVinculo.length > 0 && proximos > 0 && ' · '}
            {proximos > 0 && <a href="#agenda">{proximos} treinamentos agendados nos próximos 14 dias</a>}
          </p>
        )}
      </section>

      {editar && <LinksGerais links={linksGerais} gerente={gerente} />}


      {paginacao}
      <div className="tabela-wrap tabela-fixa">
        <table>
          <thead>
            <tr>
              <th>Parceiro</th><th className="esq">Ponto focal</th>
              {Object.values(TIPOS_TREINAMENTO).map((t) => <th key={t} className="esq">{t}</th>)}
              <th>Formulários</th><th className="esq">Validação</th>
            </tr>
          </thead>
          <tbody>
            {daPagina.map((p) => (
              <tr key={p.id} className={oculto(p) ? 'inativo' : ''}>
                <td>
                  <Link href={`/indireto/${p.id}`}><strong>{p.nome_fantasia}</strong></Link>
                  <span className="nome-sub"><span className={`tag ${classeStatus(statusPor.get(p.status))}`}>{statusPor.get(p.status)?.nome || p.status}</span> {documentoDe(p) || ''}</span>
                </td>
                <td className="esq">{p.ponto_focal_id ? nomes.get(p.ponto_focal_id) : <span className="fraco">—</span>}</td>
                {TIPOS.map((t) => {
                  const s = p.sit[t];
                  const f = p.forms[t];
                  return (
                    <td key={t} className="esq">
                      <div className="celula-treino">
                        <span className="linha-status-treino">
                          {s.estado === 'pendente' || s.estado === 'atrasado'
                            ? <RegistrarTreinoRapido parceiroId={p.id} tipo={t} rotulo={ROTULO_SITUACAO[s.estado].texto} classe={ROTULO_SITUACAO[s.estado].classe} hoje={hoje} podeEditar={editar} />
                            : <span className={`tag ${ROTULO_SITUACAO[s.estado].classe}`}>{ROTULO_SITUACAO[s.estado].texto}</span>}
                          {s.data && <span className="dica">{fmtData(s.data, true)}</span>}
                        </span>
                        {f ? (
                          <span className="tag tag-ok" title={f.total_pontuavel ? `Acertou ${f.acertos} de ${f.total_pontuavel}` : undefined}>
                            ✓ Formulário {fmtData(f.respondido_em.slice(0, 10))}{f.total_pontuavel ? ` · ${f.acertos}/${f.total_pontuavel}` : ''}
                          </span>
                        ) : (
                          <AcaoFormulario parceiroId={p.id} tipo={t} nome={p.contato_nome || p.nome_fantasia} telefone={p.contato_telefone} token={linkDe.get(`${p.id}:${t}`)} podeEditar={editar} />
                        )}
                      </div>
                    </td>
                  );
                })}
                <td><b>{p.respondidos}/3</b></td>
                <td className="esq">
                  <span className={`tag ${VALIDACAO[p.validacao || 'pendente'].classe}`}>{VALIDACAO[p.validacao || 'pendente'].texto}</span>
                  {p.faltas.length > 0 && <span className="nome-sub">falta: {p.faltas.join(', ')}</span>}
                </td>
              </tr>
            ))}
            {!filtradas.length && <tr><td colSpan={7} className="fraco" style={{ textAlign: 'center', padding: 24 }}>Nenhum parceiro com esses filtros.</td></tr>}
          </tbody>
        </table>
      </div>
      {paginacao}

      {agenda.length > 0 && (
        <section className="secao" id="agenda">
          <h2 style={{ marginBottom: 10 }}>Agenda dos próximos 14 dias</h2>
          <div className="tabela-wrap">
            <table>
              <thead><tr><th>Data</th><th className="esq">Parceiro</th><th className="esq">Treinamento</th></tr></thead>
              <tbody>
                {agenda.map((t) => (
                  <tr key={t.id}>
                    <td>{fmtData(t.data, true)}{t.data === hoje && <span className="nome-sub">hoje</span>}</td>
                    <td className="esq"><Link href={`/indireto/${t.parceiro_id}`}>{nomeParceiro.get(t.parceiro_id)}</Link></td>
                    <td className="esq">{TIPOS_TREINAMENTO[t.tipo]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {semVinculo.length > 0 && (
        <section className="secao" id="respostas">
          <h2 style={{ marginBottom: 6 }}>Respostas sem parceiro</h2>
          <p className="dica" style={{ marginBottom: 10 }}>
            Respostas do link geral (ou do Google Forms) em que o CPF/CNPJ não está no cadastro.
            {editar ? ' Vincule ao parceiro certo: o treinamento fica realizado e, se o parceiro não tiver documento, ele é preenchido.' : ''}
          </p>
          <div className="tabela-wrap">
            <table>
              <thead><tr><th>Respondido em</th><th className="esq">Nome</th><th className="esq">Documento / e-mail</th><th className="esq">Treinamento</th>{editar && <th className="esq">Vincular</th>}</tr></thead>
              <tbody>
                {semVinculo.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtData(r.respondido_em.slice(0, 10), true)}</td>
                    <td className="esq">{r.nome || '—'}</td>
                    <td className="esq">{r.documento ? (r.documento.length === 14 ? fmtCnpj(r.documento) : fmtCpf(r.documento)) : r.email || <span className="fraco">não informado</span>}</td>
                    <td className="esq">{TIPOS_TREINAMENTO[r.tipo_treinamento]}</td>
                    {editar && (
                      <td className="esq">
                        <div className="campos" style={{ flexWrap: 'nowrap' }}>
                          <FormAcao acao={vincularResposta}>
                            <div className="campos" style={{ flexWrap: 'nowrap' }}>
                              <input type="hidden" name="id" value={r.id} />
                              <select name="parceiro_id" defaultValue="" aria-label="Parceiro" style={{ maxWidth: 240 }}>
                                <option value="">Escolha o parceiro</option>
                                {linhas.map((p) => <option key={p.id} value={p.id}>{p.nome_fantasia}{documentoDe(p) ? ` (${documentoDe(p)})` : ''}</option>)}
                              </select>
                              <button className="btn btn-sec btn-peq" type="submit">Vincular</button>
                            </div>
                          </FormAcao>
                          <FormAcao acao={ignorarResposta}>
                            <input type="hidden" name="id" value={r.id} />
                            <button className="btn btn-sec btn-peq" type="submit">Ignorar</button>
                          </FormAcao>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
