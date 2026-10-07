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

  // filtros
  const b = normalizar(sp.q || '');
  const bDig = soDigitos(sp.q || '');
  const filtradas = linhas.filter((p) => {
    if (sp.status ? p.status !== sp.status : oculto(p) && !sp.q) return false;
    if (sp.ab && p.ativ?.estado !== sp.ab) return false;
    if (sp.focal === 'meus' && p.ponto_focal_id !== perfil.id) return false;
    if (sp.focal && sp.focal !== 'meus' && p.ponto_focal_id !== sp.focal) return false;
    if (sp.val && p.validacao !== sp.val) return false;
    if (sp.ativ && !(p.data_ativacao || '').startsWith(sp.ativ)) return false;
    if (b) {
      const alvo = normalizar([p.nome_fantasia, p.razao_social, p.cidade, p.codigo, p.contato_nome].join(' '));
      if (!alvo.includes(b) && !(bDig.length >= 4 && ((p.cnpj || '').includes(bDig) || (p.cpf || '').includes(bDig)))) return false;
    }
    return true;
  });

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

  const ativos = linhas.filter((p) => !oculto(p));
  const boas = linhas.filter((p) => p.ativ?.estado === 'boa').length;
  const noPrazo = linhas.filter((p) => p.ativ?.estado === 'prazo').length;
  const filtrando = sp.q || sp.status || sp.focal || sp.val || sp.ativ || sp.ab;
  const aguardando = linhas.filter((p) => p.validacao === 'pendente').length;

  return (
    <>
      <div className="topo">
        <div>
          <h1>Ativação de parceiros</h1>
          <p className="sub">Cadastro, status, ativação, venda em 30 dias e validação dos parceiros. Os treinamentos e formulários ficam em <Link href="/indireto/treinamentos">Treinamentos</Link>.</p>
        </div>
        {editar && (
          <div style={{ display: 'flex', gap: 8 }}>
            {gerente && <Link className="btn btn-sec" href="/indireto/importar">Importar lista</Link>}
            <Link className="btn" href="/indireto/novo">Novo parceiro</Link>
          </div>
        )}
      </div>

      <div className="calendario" style={{ marginTop: 0 }}>
        <div><b>{ativos.length}</b><span>parceiros na lista</span></div>
        <Link href="/indireto?ab=boa" className="numero-link"><b>{boas}</b><span>ativações boas (venda em até 30 dias)</span></Link>
        <Link href="/indireto?ab=prazo" className="numero-link"><b>{noPrazo}</b><span>ativações ainda no prazo</span></Link>
        <Link href="/indireto?val=pendente" className="numero-link"><b>{aguardando}</b><span>aguardando validação</span></Link>
      </div>

      <form className="bloco campos" style={{ margin: '14px 0' }} method="get">
        <label className="campo" style={{ flex: '1 1 220px' }}>Buscar<input type="text" name="q" defaultValue={sp.q || ''} placeholder="Nome, cidade, CNPJ ou contato" /></label>
        <label className="campo">Status
          <select name="status" defaultValue={sp.status || ''}>
            <option value="">{statusLista.some((st) => st.oculto) ? `Todos menos ${statusLista.filter((st) => st.oculto).map((st) => st.nome).join(', ')}` : 'Todos'}</option>
            {statusLista.map((st) => <option key={st.chave} value={st.chave}>{st.nome}{st.ativo ? '' : ' (desativado)'}</option>)}
          </select>
        </label>
        <label className="campo">Ponto focal
          <select name="focal" defaultValue={sp.focal || ''}>
            <option value="">Todos</option>
            <option value="meus">Só os meus</option>
            {focais.map((f) => <option key={f.id} value={f.id}>{f.nome || f.usuario}</option>)}
          </select>
        </label>
        <label className="campo">Validação
          <select name="val" defaultValue={sp.val || ''}>
            <option value="">Todas</option>
            {Object.entries(VALIDACAO).map(([k, v]) => <option key={k} value={k}>{v.texto}</option>)}
          </select>
        </label>
        <label className="campo">Mês de ativação<input type="month" name="ativ" defaultValue={sp.ativ || ''} /></label>
        <label className="campo">Venda em 30 dias
          <select name="ab" defaultValue={sp.ab || ''}>
            <option value="">Todas</option>
            {Object.entries(ROTULO_ATIVACAO).map(([k, v]) => <option key={k} value={k}>{v.texto}</option>)}
          </select>
        </label>
        {porPagina !== 25 && <input type="hidden" name="por" value={porPagina} />}
        <button className="btn btn-sec" type="submit">Filtrar</button>
        {filtrando && <Link href="/indireto" className="dica">Limpar</Link>}
      </form>

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
