import Link from 'next/link';
import { redirect } from 'next/navigation';
import { exigirSessao, podeVerIndireto, podeEditarIndireto } from '@/lib/auth';
import { hojeSP, somarDias } from '@/lib/datas';
import { fmtData } from '@/lib/formato';
import { normalizar } from '@/lib/nomes';
import { STATUS_PARCEIRO, TIPOS_TREINAMENTO, ROTULO_SITUACAO, situacaoTreinamento, fmtCnpj, soDigitos } from '@/lib/indireto';
import { nomesDosPerfis, listarFocais } from './dados';

export default async function ControleIndireto({ searchParams }) {
  const sp = await searchParams;
  const { supabase, perfil } = await exigirSessao();
  if (!podeVerIndireto(perfil)) redirect('/');
  const editar = podeEditarIndireto(perfil);
  const hoje = hojeSP();

  const [{ data: parceiros = [] }, { data: treinos = [] }, { data: apont = [] }, nomes, focais] = await Promise.all([
    supabase.from('parceiros').select('*').order('nome_fantasia'),
    supabase.from('parceiro_treinamentos').select('id, parceiro_id, tipo, data, status'),
    supabase.from('parceiro_apontamentos').select('parceiro_id, criado_em').order('criado_em', { ascending: false }).limit(5000),
    nomesDosPerfis(supabase),
    listarFocais(supabase),
  ]);

  const treinosDe = new Map();
  (treinos || []).forEach((t) => {
    if (!treinosDe.has(t.parceiro_id)) treinosDe.set(t.parceiro_id, []);
    treinosDe.get(t.parceiro_id).push(t);
  });
  const ultimoApont = new Map();
  (apont || []).forEach((a) => { if (!ultimoApont.has(a.parceiro_id)) ultimoApont.set(a.parceiro_id, a.criado_em); });

  const linhas = (parceiros || []).map((p) => {
    const lista = treinosDe.get(p.id) || [];
    const sit = Object.fromEntries(Object.keys(TIPOS_TREINAMENTO).map((t) => [t, situacaoTreinamento(lista, t, hoje)]));
    return { ...p, sit };
  });

  // filtros
  const b = normalizar(sp.q || '');
  const bDig = soDigitos(sp.q || '');
  const filtradas = linhas.filter((p) => {
    if (sp.status ? p.status !== sp.status : p.status === 'inativo' && !sp.q) return false;
    if (sp.focal === 'meus' && p.ponto_focal_id !== perfil.id) return false;
    if (sp.focal && sp.focal !== 'meus' && p.ponto_focal_id !== sp.focal) return false;
    if (sp.pend && !['pendente', 'atrasado'].includes(p.sit[sp.pend]?.estado)) return false;
    if (b) {
      const alvo = normalizar([p.nome_fantasia, p.razao_social, p.cidade, p.codigo, p.contato_nome].join(' '));
      if (!alvo.includes(b) && !(bDig.length >= 4 && (p.cnpj || '').includes(bDig))) return false;
    }
    return true;
  });

  const ativos = linhas.filter((p) => p.status !== 'inativo');
  const emOnboarding = linhas.filter((p) => p.status === 'onboarding').length;
  const limite = somarDias(hoje, 14);
  const proximos = (treinos || [])
    .filter((t) => t.status === 'agendado' && t.data >= hoje && t.data <= limite)
    .sort((a, b2) => a.data.localeCompare(b2.data));
  const pendencias = ativos.reduce((s, p) => s + Object.values(p.sit).filter((x) => x.estado === 'pendente' || x.estado === 'atrasado').length, 0);
  const nomeParceiro = new Map(linhas.map((p) => [p.id, p.nome_fantasia]));
  const filtrando = sp.q || sp.status || sp.focal || sp.pend;

  return (
    <>
      <div className="topo">
        <div>
          <h1>Controle Indireto</h1>
          <p className="sub">Parceiros, treinamentos de onboarding, telecom e serviços, e os apontamentos dos pontos focais.</p>
        </div>
        {editar && <Link className="btn" href="/indireto/novo">Novo parceiro</Link>}
      </div>

      <div className="calendario" style={{ marginTop: 0 }}>
        <div><b>{ativos.length}</b><span>parceiros (sem inativos)</span></div>
        <div><b>{emOnboarding}</b><span>em onboarding</span></div>
        <div><b>{proximos.length}</b><span>treinamentos nos próximos 14 dias</span></div>
        <div><b>{pendencias}</b><span>treinamentos pendentes</span></div>
      </div>

      <form className="bloco campos" style={{ margin: '14px 0' }} method="get">
        <label className="campo" style={{ flex: '1 1 220px' }}>Buscar<input type="text" name="q" defaultValue={sp.q || ''} placeholder="Nome, cidade, CNPJ ou contato" /></label>
        <label className="campo">Status
          <select name="status" defaultValue={sp.status || ''}>
            <option value="">Todos menos inativos</option>
            {Object.entries(STATUS_PARCEIRO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="campo">Ponto focal
          <select name="focal" defaultValue={sp.focal || ''}>
            <option value="">Todos</option>
            <option value="meus">Só os meus</option>
            {focais.map((f) => <option key={f.id} value={f.id}>{f.nome || f.usuario}</option>)}
          </select>
        </label>
        <label className="campo">Treinamento pendente
          <select name="pend" defaultValue={sp.pend || ''}>
            <option value="">Qualquer situação</option>
            {Object.entries(TIPOS_TREINAMENTO).map(([k, v]) => <option key={k} value={k}>Sem {v.toLowerCase()} realizado</option>)}
          </select>
        </label>
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
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Parceiro</th><th className="esq">Cidade</th><th className="esq">Ponto focal</th><th className="esq">Status</th>
                {Object.values(TIPOS_TREINAMENTO).map((t) => <th key={t} className="esq">{t}</th>)}
                <th>Último apontamento</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((p) => (
                <tr key={p.id} className={p.status === 'inativo' ? 'inativo' : ''}>
                  <td>
                    <Link href={`/indireto/${p.id}`}><strong>{p.nome_fantasia}</strong></Link>
                    <span className="nome-sub">{[p.cnpj && fmtCnpj(p.cnpj), p.codigo].filter(Boolean).join(', ') || p.razao_social || ''}</span>
                  </td>
                  <td className="esq">{[p.cidade, p.uf].filter(Boolean).join('/') || '—'}</td>
                  <td className="esq">{p.ponto_focal_id ? nomes.get(p.ponto_focal_id) : <span className="fraco">—</span>}</td>
                  <td className="esq"><span className={`tag ${p.status === 'ativo' ? 'tag-ok' : p.status === 'onboarding' ? 'tag-acento' : ''}`}>{STATUS_PARCEIRO[p.status]}</span></td>
                  {Object.keys(TIPOS_TREINAMENTO).map((t) => {
                    const s = p.sit[t];
                    return (
                      <td key={t} className="esq">
                        <span className={`tag ${ROTULO_SITUACAO[s.estado].classe}`}>{ROTULO_SITUACAO[s.estado].texto}</span>
                        {s.data && <span className="nome-sub">{fmtData(s.data, true)}</span>}
                      </td>
                    );
                  })}
                  <td className="fraco">{ultimoApont.has(p.id) ? fmtData(ultimoApont.get(p.id).slice(0, 10), true) : '—'}</td>
                </tr>
              ))}
              {!filtradas.length && <tr><td colSpan={8} className="fraco" style={{ textAlign: 'center', padding: 24 }}>Nenhum parceiro com esses filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {proximos.length > 0 && (
        <section className="secao">
          <h2 style={{ marginBottom: 10 }}>Agenda dos próximos 14 dias</h2>
          <div className="tabela-wrap">
            <table>
              <thead><tr><th>Data</th><th className="esq">Parceiro</th><th className="esq">Treinamento</th></tr></thead>
              <tbody>
                {proximos.map((t) => (
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
    </>
  );
}
