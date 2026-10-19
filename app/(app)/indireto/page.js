import Link from 'next/link';
import { redirect } from 'next/navigation';
import { exigirSessao, podeVerIndireto, podeEditarIndireto, podeValidarIndireto } from '@/lib/auth';
import { hojeSP } from '@/lib/datas';
import { fmtData } from '@/lib/formato';
import { normalizar } from '@/lib/nomes';
import { CORES_STATUS, classeStatus, situacaoAtivacao, ROTULO_ATIVACAO, VALIDACAO, documentoDe, soDigitos } from '@/lib/indireto';
import FormAcao from '@/components/FormAcao';
import { salvarStatusParceiro } from '@/app/actions/indireto';
import { nomesDosPerfis, listarFocais, listarStatus } from './dados';
import { PilulasFocais, FaixaAtivos, urlCom, lista } from '@/components/Filtros';
import MenuFiltro from '@/components/MenuFiltro';
import SeletorMes from '@/components/SeletorMes';
import { mesesAoRedor } from '@/lib/meses';

export default async function ControleIndireto({ searchParams }) {
  const sp = await searchParams;
  const { supabase, perfil } = await exigirSessao();
  if (!podeVerIndireto(perfil)) redirect('/');
  const editar = podeEditarIndireto(perfil);
  const gerente = podeValidarIndireto(perfil);
  const hoje = hojeSP();

  const [{ data: parceiros = [] }, { data: treinos = [] }, { data: apont = [] }, nomes, focais, { data: forms = [] }, statusLista] = await Promise.all([
    supabase.from('parceiros').select('*').order('nome_fantasia'),
    supabase.from('parceiro_treinamentos').select('id, parceiro_id, tipo, data, status'),
    supabase.from('parceiro_apontamentos').select('parceiro_id, criado_em').order('criado_em', { ascending: false }).limit(5000),
    nomesDosPerfis(supabase),
    listarFocais(supabase),
    supabase.from('parceiro_respostas_form').select('parceiro_id, tipo_treinamento').not('parceiro_id', 'is', null).eq('ignorada', false),
    listarStatus(supabase),
  ]);
  const statusPor = new Map(statusLista.map((st) => [st.chave, st]));
  const oculto = (p) => !!statusPor.get(p.status)?.oculto;

  const treinosDe = new Map();
  (treinos || []).forEach((t) => {
    if (!treinosDe.has(t.parceiro_id)) treinosDe.set(t.parceiro_id, []);
    treinosDe.get(t.parceiro_id).push(t);
  });
  const ultimoApont = new Map();
  (apont || []).forEach((a) => { if (!ultimoApont.has(a.parceiro_id)) ultimoApont.set(a.parceiro_id, a.criado_em); });

  const formsDe = new Map();
  (forms || []).forEach((f) => { if (!formsDe.has(f.parceiro_id)) formsDe.set(f.parceiro_id, new Set()); formsDe.get(f.parceiro_id).add(f.tipo_treinamento); });
  const linhas = (parceiros || []).map((p) => {
    const lista = treinosDe.get(p.id) || [];
    const realizados = new Set(lista.filter((t) => t.status === 'realizado').map((t) => t.tipo)).size;
    return { ...p, realizados, respondidos: formsDe.get(p.id)?.size || 0, ativ: situacaoAtivacao(p, hoje) };
  });

  // ---------- filtros (todos se combinam) ----------
  // mes (AAAA-MM da data de ativação | 'todos'), focal, ab/val/status (listas "a,b"), q
  const mesSel = /^\d{4}-\d{2}$/.test(sp.mes || '') || sp.mes === 'todos' ? sp.mes : hoje.slice(0, 7);
  const FIL = { mes: mesSel, focal: sp.focal || '', ab: lista(sp.ab), val: lista(sp.val), status: lista(sp.status), q: sp.q || '' };
  const b = normalizar(FIL.q);
  const bDig = soDigitos(FIL.q);
  const um = {
    focal: (p, v) => (v === 'sem' ? !p.ponto_focal_id : p.ponto_focal_id === v),
    ab: (p, v) => (v === 'naoativ' ? !p.data_ativacao : p.ativ?.estado === v),
    val: (p, v) => (p.validacao || 'pendente') === v,
    status: (p, v) => p.status === v,
    mes: (p, v) => v === 'todos' || (p.data_ativacao || '').startsWith(v),
    q: (p) => {
      const alvo = normalizar([p.nome_fantasia, p.razao_social, p.cidade, p.codigo, p.contato_nome].join(' '));
      return alvo.includes(b) || (bDig.length >= 4 && ((p.cnpj || '').includes(bDig) || (p.cpf || '').includes(bDig)));
    },
  };
  const vazio = (v) => !v || (Array.isArray(v) && !v.length);
  const testa = (k, p, v) => (Array.isArray(v) ? v.some((x) => um[k](p, x)) : um[k](p, v));
  const passa = (p, exceto) => {
    if (!FIL.status.length && exceto !== 'status' && oculto(p) && !FIL.q) return false;
    return Object.entries(FIL).every(([k, v]) => vazio(v) || k === exceto || testa(k, p, v));
  };
  const filtradas = linhas.filter((p) => passa(p));
  const conta = (k, v) => linhas.filter((p) => passa(p, k) && um[k](p, v)).length;
  const urlF = (extra) => urlCom('/indireto', { ...FIL, ...(sp.por ? { por: sp.por } : {}) }, extra);
  const focaisIds = [...new Set(linhas.map((p) => p.ponto_focal_id || 'sem'))];
  const pilulas = [{ id: '', nome: 'Todos' }, ...focaisIds.map((f) => ({ id: f, nome: f === 'sem' ? 'Sem ponto focal' : nomes.get(f) || '—' }))]
    .map((c) => ({ ...c, n: linhas.filter((p) => passa(p, 'focal') && (!c.id || um.focal(p, c.id))).length }))
    .sort((a, b2) => (!a.id ? -1 : !b2.id ? 1 : (a.id === 'sem') - (b2.id === 'sem') || b2.n - a.n || a.nome.localeCompare(b2.nome)));
  const OP_AB = [['boa', 'Ativação boa', 'var(--ok)'], ['prazo', 'No prazo', 'var(--acento)'], ['sem', 'Sem venda em 30 dias', 'var(--risco)'], ['fora', 'Vendeu fora do prazo', 'var(--atencao)'], ['naoativ', 'Não ativado', '#8f88a8']];
  const menus = [
    { rotulo: 'Ativação', opcoes: OP_AB.map(([v, t, cor]) => ({ param: 'ab', v, t, cor, n: conta('ab', v) })) },
    { rotulo: 'Validação', opcoes: Object.entries(VALIDACAO).map(([v, x]) => ({ param: 'val', v, t: x.texto, n: conta('val', v), cor: v === 'aprovado' ? 'var(--ok)' : v === 'reprovado' ? 'var(--risco)' : 'var(--atencao)' })) },
    { rotulo: 'Status', opcoes: statusLista.map((st) => ({ param: 'status', v: st.chave, t: st.nome, n: conta('status', st.chave) })) },
  ];
  const nomeOp = (k, v) => menus.flatMap((m) => m.opcoes).find((o) => o.param === k && o.v === v)?.t || v;
  const ativosF = [
    ...(FIL.focal ? [{ chave: 'focal', t: pilulas.find((x) => x.id === FIL.focal)?.nome || 'Ponto focal', href: urlF({ focal: '' }) }] : []),
    ...['ab', 'val', 'status'].flatMap((k) => FIL[k].map((v) => ({ chave: `${k}-${v}`, t: `${{ ab: 'Ativação', val: 'Validação', status: 'Status' }[k]}: ${nomeOp(k, v)}`, href: urlF({ [k]: FIL[k].filter((x) => x !== v) }) }))),
    ...(FIL.q ? [{ chave: 'q', t: `Busca: "${FIL.q}"`, href: urlF({ q: '' }) }] : []),
  ];
  // total de referência: o mês escolhido, sem os outros filtros
  const totalBase = linhas.filter((p) => um.mes(p, FIL.mes) && !oculto(p)).length;

  // paginação (25 por página por padrão)
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
    return t ? `/indireto?${t}` : '/indireto';
  };
  const paginacao = filtradas.length > 0 && (
    <div className="paginacao">
      <span className="dica">
        {(pagina - 1) * porPagina + 1}–{Math.min(pagina * porPagina, filtradas.length)} de {filtradas.length} parceiros
      </span>
      <div className="paginacao-botoes">
        {pagina > 1 ? <Link className="btn btn-sec btn-peq" href={linkPagina(pagina - 1)}>‹ Anterior</Link> : <span className="btn btn-sec btn-peq desligado">‹ Anterior</span>}
        <span className="dica">Página {pagina} de {totalPaginas}</span>
        {pagina < totalPaginas ? <Link className="btn btn-sec btn-peq" href={linkPagina(pagina + 1)}>Próxima ›</Link> : <span className="btn btn-sec btn-peq desligado">Próxima ›</span>}
      </div>
      <span className="dica">
        Por página:{' '}
        {POR_PAGINA.map((n) => (n === porPagina ? <b key={n} style={{ margin: '0 4px' }}>{n}</b> : <Link key={n} href={linkPagina(1, n)} style={{ margin: '0 4px' }}>{n}</Link>))}
      </span>
    </div>
  );


  return (
    <>
      <div className="topo">
        <div>
          <h1>Ativação de parceiros</h1>
          <p className="sub">Parceiros ativados no mês escolhido (data de ativação), com venda em 30 dias e validação. Para ver todos, escolha "Todos os meses". Treinamentos ficam em <Link href="/indireto/treinamentos">Treinamentos</Link>.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {editar && gerente && <Link className="btn btn-sec" href="/indireto/importar">Importar lista</Link>}
          {editar && <Link className="btn" href="/indireto/novo">Novo parceiro</Link>}
          <SeletorMes mes={FIL.mes} meses={mesesAoRedor(hoje.slice(0, 7))} comTodos limpar={['pag']} />
        </div>
      </div>

      <section className="barra-filtros" aria-label="Filtros">
        <PilulasFocais itens={pilulas} selecionado={FIL.focal} hrefDe={(id) => urlF({ focal: id })} />
        <div className="linha-menus">
          {menus.map((m) => <MenuFiltro key={m.rotulo} rotulo={m.rotulo} opcoes={m.opcoes} />)}
          <form method="get" className="busca-filtro" action="/indireto">
            {Object.entries(FIL).filter(([k, v]) => !vazio(v) && k !== 'q').map(([k, v]) => <input key={k} type="hidden" name={k} value={Array.isArray(v) ? v.join(',') : v} />)}
            <input type="text" name="q" defaultValue={FIL.q} placeholder="Buscar nome, cidade, CNPJ" aria-label="Buscar" />
            <button className="btn btn-sec btn-peq" type="submit">Buscar</button>
          </form>
        </div>
        <FaixaAtivos total={totalBase} filtrados={filtradas.length} ativos={ativosF} limparHref={urlF({ focal: '', ab: '', val: '', status: '', q: '' })} />
      </section>

      {!linhas.length ? (
        <div className="vazio">
          <h2>Nenhum parceiro cadastrado</h2>
          <p>{editar ? 'Cadastre o primeiro parceiro para começar a registrar treinamentos e apontamentos.' : 'Os pontos focais ainda não cadastraram parceiros.'}</p>
          {editar && <Link className="btn" href="/indireto/novo">Novo parceiro</Link>}
        </div>
      ) : (
        <>
        {paginacao}
        <div className="tabela-wrap tabela-fixa">
          <table>
            <thead>
              <tr>
                <th>Parceiro</th><th className="esq">Cidade</th><th className="esq">Ponto focal</th><th className="esq">Status</th><th className="esq">Validação</th><th>Ativação</th><th className="esq">Venda (30 dias)</th><th>Treinamentos</th>
                <th>Último apontamento</th>
              </tr>
            </thead>
            <tbody>
              {daPagina.map((p) => (
                <tr key={p.id} className={oculto(p) ? 'inativo' : ''}>
                  <td>
                    <Link href={`/indireto/${p.id}`}><strong>{p.nome_fantasia}</strong></Link>
                    <span className="nome-sub">{[documentoDe(p), p.codigo].filter(Boolean).join(', ') || p.razao_social || ''}</span>
                  </td>
                  <td className="esq">{[p.cidade, p.uf].filter(Boolean).join('/') || '—'}</td>
                  <td className="esq">{p.ponto_focal_id ? nomes.get(p.ponto_focal_id) : <span className="fraco">—</span>}</td>
                  <td className="esq"><span className={`tag ${classeStatus(statusPor.get(p.status))}`}>{statusPor.get(p.status)?.nome || p.status}</span></td>
                  <td className="esq"><span className={`tag ${VALIDACAO[p.validacao || 'pendente'].classe}`}>{VALIDACAO[p.validacao || 'pendente'].texto}</span>{p.validacao_automatica && <span className="nome-sub">automática</span>}</td>
                  <td>{p.data_ativacao ? fmtData(p.data_ativacao, true) : <span className="fraco">—</span>}</td>
                  <td className="esq">
                    {p.ativ ? <span className={`tag ${ROTULO_ATIVACAO[p.ativ.estado].classe}`}>{ROTULO_ATIVACAO[p.ativ.estado].texto}</span> : <span className="fraco">—</span>}
                    {p.venda_mes ? <span className="nome-sub">{p.venda_produto} em {p.venda_mes.slice(5)}/{p.venda_mes.slice(2, 4)}</span> : p.ativ?.estado === 'prazo' && <span className="nome-sub">até {fmtData(p.ativ.prazo, true)}</span>}
                  </td>
                  <td>
                    <Link href={`/indireto/treinamentos?q=${encodeURIComponent(p.nome_fantasia)}`} title="Treinamentos realizados · formulários respondidos">
                      {p.realizados}/3 · {p.respondidos}/3 form.
                    </Link>
                  </td>
                  <td className="fraco">{ultimoApont.has(p.id) ? fmtData(ultimoApont.get(p.id).slice(0, 10), true) : '—'}</td>
                </tr>
              ))}
              {!filtradas.length && <tr><td colSpan={10} className="fraco" style={{ textAlign: 'center', padding: 24 }}>Nenhum parceiro com esses filtros.</td></tr>}
            </tbody>
          </table>
        </div>
        {paginacao}
        </>
      )}

      {gerente && (
        <details className="bloco secao recolhivel">
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>⚙ Status dos parceiros (só gerente)</summary>
          <p className="dica" style={{ margin: '8px 0 10px' }}>
            Esta é a lista que os pontos focais escolhem no cadastro. Desativar tira o status da lista de escolha (quem já está nele continua).
            "Esconder da lista" faz os parceiros nesse status sumirem da tela por padrão, como os que declinaram.
          </p>
          <div className="lista-status">
            {statusLista.map((st) => (
              <FormAcao key={st.chave} acao={salvarStatusParceiro}>
                <div className={`linha-status${st.ativo ? '' : ' inativo'}`}>
                  <input type="hidden" name="chave" value={st.chave} />
                  <input type="text" name="nome" defaultValue={st.nome} required aria-label="Nome" />
                  <label className="dica">ordem <input type="number" name="ordem" defaultValue={st.ordem} aria-label="Ordem" style={{ width: 64 }} /></label>
                  <select name="cor" defaultValue={st.cor} aria-label="Cor">
                    {Object.entries(CORES_STATUS).map(([k, v]) => <option key={k} value={k}>{v.texto}</option>)}
                  </select>
                  <label className="dica"><input type="checkbox" name="oculto" defaultChecked={st.oculto} /> esconder da lista</label>
                  <label className="dica"><input type="checkbox" name="ativo" defaultChecked={st.ativo} /> ativo</label>
                  <span className={`tag ${classeStatus(st)}`}>{st.nome}: {linhas.filter((p) => p.status === st.chave).length}</span>
                  <button className="btn btn-sec btn-peq" type="submit">Salvar</button>
                </div>
              </FormAcao>
            ))}
          </div>
          <FormAcao acao={salvarStatusParceiro}>
            <div className="linha-status" style={{ marginTop: 10 }}>
              <input type="text" name="nome" required placeholder="Novo status" aria-label="Novo status" />
              <label className="dica">ordem <input type="number" name="ordem" defaultValue={(statusLista.at(-1)?.ordem || 0) + 1} aria-label="Ordem" style={{ width: 64 }} /></label>
              <select name="cor" defaultValue="neutro" aria-label="Cor">
                {Object.entries(CORES_STATUS).map(([k, v]) => <option key={k} value={k}>{v.texto}</option>)}
              </select>
              <label className="dica"><input type="checkbox" name="oculto" /> esconder da lista</label>
              <button className="btn btn-peq" type="submit">Criar status</button>
            </div>
          </FormAcao>
        </details>
      )}
    </>
  );
}
