import Link from 'next/link';
import { redirect } from 'next/navigation';
import { exigirSessao, podeVerIndireto, podeEditarIndireto, podeValidarIndireto } from '@/lib/auth';
import { hojeSP, somarDias } from '@/lib/datas';
import { fmtData } from '@/lib/formato';
import { normalizar } from '@/lib/nomes';
import { classeStatus, TIPOS_TREINAMENTO, ROTULO_SITUACAO, VALIDACAO, situacaoTreinamento, faltasValidacao, documentoDe, fmtCnpj, fmtCpf, soDigitos } from '@/lib/indireto';
import FormAcao from '@/components/FormAcao';
import AcaoFormulario from '@/components/AcaoFormulario';
import LinksGerais from '@/components/LinksGerais';
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

  // filtros
  const b = normalizar(sp.q || '');
  const bDig = soDigitos(sp.q || '');
  const filtradas = linhas.filter((p) => {
    if (sp.status ? p.status !== sp.status : oculto(p) && !sp.q) return false;
    if (sp.focal === 'meus' && p.ponto_focal_id !== perfil.id) return false;
    if (sp.focal && sp.focal !== 'meus' && p.ponto_focal_id !== sp.focal) return false;
    if (sp.falta && p.forms[sp.falta]) return false;
    if (sp.comp === '3' && p.respondidos < 3) return false;
    if (sp.comp === '1' && p.respondidos !== 2) return false;
    if (sp.comp === '2' && p.respondidos > 1) return false;
    if (sp.aguardando && !TIPOS.some((t) => linkDe.has(`${p.id}:${t}`))) return false;
    if (b) {
      const alvo = normalizar([p.nome_fantasia, p.razao_social, p.codigo, p.contato_nome].join(' '));
      if (!alvo.includes(b) && !(bDig.length >= 4 && ((p.cnpj || '').includes(bDig) || (p.cpf || '').includes(bDig)))) return false;
    }
    return true;
  });

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

  const visiveis = linhas.filter((p) => !oculto(p));
  const completos = visiveis.filter((p) => p.respondidos === 3).length;
  const falta1 = visiveis.filter((p) => p.respondidos === 2).length;
  const falta2 = visiveis.filter((p) => p.respondidos <= 1).length;
  const aguardandoLinks = (links.error ? [] : links.data || []).length;
  const limite = somarDias(hoje, 14);
  const agenda = (treinos || []).filter((t) => t.status === 'agendado' && t.data >= hoje && t.data <= limite).sort((x, y) => x.data.localeCompare(y.data));
  const proximos = agenda.length;
  const nomeParceiro = new Map(linhas.map((p) => [p.id, p.nome_fantasia]));
  const semVinculo = (respostas || []).filter((r) => !r.parceiro_id);
  const filtrando = sp.q || sp.status || sp.focal || sp.falta || sp.comp || sp.aguardando;

  return (
    <>
      <div className="topo">
        <div>
          <h1>Treinamentos</h1>
          <p className="sub">
            Os 3 treinamentos de cada parceiro (Onboarding, Telecom e Serviços) e os formulários de confirmação.
            O parceiro é validado sozinho quando todo treinamento realizado tem o formulário respondido e ele tem venda vinculada.
          </p>
        </div>
        {gerente && <Link className="btn btn-sec" href="/indireto/perguntas">Perguntas dos formulários</Link>}
      </div>

      <div className="calendario" style={{ marginTop: 0 }}>
        <Link href="/indireto/treinamentos?comp=3" className="numero-link"><b>{completos}</b><span>com os 3 formulários</span></Link>
        <Link href="/indireto/treinamentos?comp=1" className="numero-link"><b>{falta1}</b><span>faltando 1</span></Link>
        <Link href="/indireto/treinamentos?comp=2" className="numero-link"><b>{falta2}</b><span>faltando 2 ou 3</span></Link>
        <Link href="/indireto/treinamentos?aguardando=1" className="numero-link"><b>{aguardandoLinks}</b><span>links aguardando resposta</span></Link>
        <div><b>{proximos}</b><span>treinamentos agendados nos próximos 14 dias</span></div>
        {semVinculo.length > 0 && <a href="#respostas" className="numero-link"><b>{semVinculo.length}</b><span>respostas sem parceiro</span></a>}
      </div>

      {editar && <LinksGerais links={linksGerais} gerente={gerente} />}

      <form className="bloco campos" style={{ margin: '14px 0' }} method="get">
        <label className="campo" style={{ flex: '1 1 220px' }}>Buscar<input type="text" name="q" defaultValue={sp.q || ''} placeholder="Nome, CNPJ ou contato" /></label>
        <label className="campo">Status
          <select name="status" defaultValue={sp.status || ''}>
            <option value="">{statusLista.some((st) => st.oculto) ? `Todos menos ${statusLista.filter((st) => st.oculto).map((st) => st.nome).join(', ')}` : 'Todos'}</option>
            {statusLista.map((st) => <option key={st.chave} value={st.chave}>{st.nome}</option>)}
          </select>
        </label>
        <label className="campo">Ponto focal
          <select name="focal" defaultValue={sp.focal || ''}>
            <option value="">Todos</option>
            <option value="meus">Só os meus</option>
            {focais.map((f) => <option key={f.id} value={f.id}>{f.nome || f.usuario}</option>)}
          </select>
        </label>
        <label className="campo">Falta o formulário de
          <select name="falta" defaultValue={sp.falta || ''}>
            <option value="">Qualquer um</option>
            {Object.entries(TIPOS_TREINAMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="campo">Formulários respondidos
          <select name="comp" defaultValue={sp.comp || ''}>
            <option value="">Todos</option>
            <option value="3">Os 3</option>
            <option value="1">Faltando 1</option>
            <option value="2">Faltando 2 ou 3</option>
          </select>
        </label>
        {porPagina !== 25 && <input type="hidden" name="por" value={porPagina} />}
        <button className="btn btn-sec" type="submit">Filtrar</button>
        {filtrando && <Link href="/indireto/treinamentos" className="dica">Limpar</Link>}
      </form>

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
                        <span>
                          <span className={`tag ${ROTULO_SITUACAO[s.estado].classe}`}>{ROTULO_SITUACAO[s.estado].texto}</span>
                          {s.data && <span className="dica"> {fmtData(s.data, true)}</span>}
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
        <section className="secao">
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
