import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirSessao, podeEditar } from '@/lib/auth';
import { listarPeriodos, escolherPeriodo, carregarBase, analisar } from '@/lib/dados';
import { fmtValor, fmtData, fmtFator, fmtPct, STATUS } from '@/lib/formato';
import { salvarRealizado, salvarRealizadoGrupo, salvarMetaIndividual } from '@/app/actions/dados';
import BarraRitmo from '@/components/BarraRitmo';
import CampoNumero from '@/components/CampoNumero';
import TempoCasa from '@/components/TempoCasa';
import SeletorPeriodo from '@/components/SeletorPeriodo';
import SemPeriodo from '@/components/SemPeriodo';

export default async function DetalheGrupo({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, perfil } = await exigirSessao();
  const editar = podeEditar(perfil);
  const periodos = await listarPeriodos(supabase);
  const periodo = escolherPeriodo(periodos, sp.p);
  if (!periodo) return <SemPeriodo podeEditar={editar} />;
  const base = await carregarBase(supabase, periodo);
  const grupo = base.porId.get(id);
  if (!grupo) notFound();
  const an = analisar(base);

  const produtos = base.produtos.filter((p) => p.ativo);
  const comDados = produtos.filter((p) => an.meta(id, p.id) !== null || an.realizado(id, p.id) > 0);
  const lista = comDados.length ? comDados : produtos;
  const produto = lista.find((p) => p.id === sp.prod) || lista[0];
  const caminho = base.caminho(id);
  const fator = fmtFator(periodo.fator_bruto);
  const raiz = caminho[0];

  if (!produto) {
    return <div className="vazio"><h2>Nenhum produto ativo</h2><p>Cadastre produtos para acompanhar as metas.</p></div>;
  }

  const ind = an.indicador(id, produto);
  const { linhas, dist } = an.individuais(id, produto);
  const filhos = base.filhosDe(id).filter((g) => g.ativo);
  const semColabs = !base.colaboradores.some((c) => c.grupo_id === id);
  const u = produto.unidade;

  // Colaboradores ativos desta equipe e das equipes abaixo, comparados com a meta individual de cada um
  const contagem = { batida: 0, emDia: 0, fora: 0, semMeta: 0 };
  base.subarvore(id).forEach((gid) => {
    an.individuais(gid, produto).linhas.forEach((l) => {
      if (!l.colaborador.ativo) return;
      if (l.status === 'batida') contagem.batida++;
      else if (l.status === 'em-dia' || l.status === 'inicio') contagem.emDia++;
      else if (l.status === 'atencao' || l.status === 'risco') contagem.fora++;
      else contagem.semMeta++;
    });
  });
  const dentro = contagem.batida + contagem.emDia;
  const totalComMeta = dentro + contagem.fora;
  const pctDe = (n) => (totalComMeta ? `${Math.round((n / totalComMeta) * 100)}%` : '0%');
  const link = (prod) => `/grupos/${id}?p=${periodo.id}&prod=${prod}`;

  return (
    <>
      <div className="topo">
        <div>
          <p className="dica">
            <Link href={`/?p=${periodo.id}&c=${raiz.id}`}>Painel</Link>
            {caminho.slice(0, -1).map((g) => <span key={g.id}> / <Link href={`/grupos/${g.id}?p=${periodo.id}&prod=${produto.id}`}>{g.nome}</Link></span>)}
          </p>
          <h1 style={{ marginTop: 6 }}>{grupo.nome}</h1>
          <p className="sub">{periodo.nome}. {an.colabsAtivosSub(id)} colaboradores ativos.</p>
          {dentro + contagem.fora > 0 && (
            <div className="contagem-meta" title="Dentro da meta: já bateu ou está no ritmo esperado até hoje. Fora: abaixo do ritmo.">
              <span className="dentro"><b>{dentro}</b> ({pctDe(dentro)}) dentro da meta em {produto.nome}{contagem.batida > 0 && `, ${contagem.batida} já bateram`}</span>
              <span className="fora"><b>{contagem.fora}</b> ({pctDe(contagem.fora)}) fora da meta</span>
              {contagem.semMeta > 0 && <span><b>{contagem.semMeta}</b> sem meta</span>}
            </div>
          )}
        </div>
        <SeletorPeriodo periodos={periodos} atual={periodo.id} />
      </div>

      <div className="abas">
        {lista.map((p) => (
          <Link key={p.id} href={link(p.id)} className={p.id === produto.id ? 'aba ativa' : 'aba'}>{p.nome}</Link>
        ))}
      </div>

      <div className="tabela-wrap" style={{ marginTop: 18 }}>
        <table>
          <thead><tr><th>Meta</th><th>Realizado</th><th className="esq">Ritmo</th><th>Projeção no fechamento</th><th>Falta</th><th>Falta {fator}</th><th>Por dia útil</th><th>Fecha em</th></tr></thead>
          <tbody>
            <tr>
              <td style={{ textAlign: 'left' }}>{ind.temMeta ? fmtValor(ind.meta, u) : 'Sem meta'}</td>
              <td>{fmtValor(ind.realizado, u)}</td>
              <td className="esq"><BarraRitmo pct={ind.pct} esperado={ind.esperado} status={ind.status} /></td>
              <td>{ind.projecao != null ? `${fmtValor(ind.projecao, u)} (${fmtPct(ind.projecaoPct)})` : '—'}</td>
              <td>{fmtValor(ind.falta, u)}</td>
              <td className="fraco">{fmtValor(ind.faltaBruta, u)}</td>
              <td>{ind.falta > 0 ? fmtValor(ind.porDia, u, 1) : '—'}</td>
              <td className="fraco">{fmtData(ind.ciclo.data_fim, true)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <section className="secao">
        <h2>Necessidade por semana</h2>
        <p className="dica" style={{ marginBottom: 10 }}>
          A falta é dividida pelos dias úteis que restam em cada semana ({ind.resumo.restantes} dias úteis restantes de {ind.resumo.total}).
          {ind.resumo.feriados.length > 0 && <> Fora do cálculo: {ind.resumo.feriados.map((f) => `${fmtData(f.data)} ${f.nome}`).join('; ')}.</>}
        </p>
        <div className="semanas">
          {ind.semanas.map((s) => (
            <div key={s.chave} className={`semana${s.atual ? ' atual' : ''}${s.passada ? ' passada' : ''}`}>
              <h3>Semana {s.numero}{s.atual ? ' (atual)' : ''}</h3>
              <div className="det">{fmtData(s.inicio)} a {fmtData(s.fim)}, {s.dias} dias úteis</div>
              <div className="nec">{s.passada ? '—' : fmtValor(s.necessario, u)}</div>
              <div className="det">
                {s.passada ? 'Semana encerrada' : <>Com {fator}: {fmtValor(s.necessarioBruto, u)}</>}
                <br />Planejado no início: {fmtValor(s.planejado, u)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {filhos.length > 0 && (
        <section className="secao">
          <h2>Equipes de {grupo.nome}</h2>
          <div className="tabela-wrap">
            <table>
              <thead><tr><th>Equipe</th><th>Meta</th><th>Realizado</th><th className="esq">Ritmo</th><th>Falta</th><th>Nesta semana</th></tr></thead>
              <tbody>
                {filhos.map((f) => {
                  const i = an.indicador(f.id, produto);
                  return (
                    <tr key={f.id}>
                      <td><Link href={`/grupos/${f.id}?p=${periodo.id}&prod=${produto.id}`}>{f.nome}</Link></td>
                      <td>{i.temMeta ? fmtValor(i.meta, u) : '—'}</td>
                      <td>{fmtValor(i.realizado, u)}</td>
                      <td className="esq"><BarraRitmo pct={i.pct} esperado={i.esperado} status={i.status} compacta /></td>
                      <td>{i.temMeta ? fmtValor(i.falta, u) : '—'}</td>
                      <td>{i.semanaAtual && i.falta > 0 ? fmtValor(i.semanaAtual.necessario, u) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {linhas.length > 0 && (
        <section className="secao">
          <h2>Colaboradores</h2>
          <p className="dica" style={{ marginBottom: 10 }}>
            A meta de {grupo.nome} ({fmtValor(ind.meta, u)}) é dividida entre os colaboradores ativos de acordo com o peso.
            {editar && ' Para fixar a meta de alguém, digite o valor na coluna Meta; para voltar à divisão automática, apague o valor.'}
            {dist?.excedeu && <span className="msg-erro"> As metas fixas somam mais que a meta da equipe.</span>}
          </p>
          <div className="tabela-wrap">
            <table>
              <thead><tr><th>Colaborador</th><th className="esq">Tempo de casa</th><th>Peso</th><th>Meta</th><th>Realizado</th><th className="esq">Ritmo</th><th>Falta</th><th>Por dia útil</th><th>Nesta semana</th></tr></thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.colaborador.id} className={l.colaborador.ativo ? '' : 'inativo'}>
                    <td><Link href={`/colaboradores/${l.colaborador.id}?p=${periodo.id}`}>{l.colaborador.nome}</Link>{!l.colaborador.ativo && <span className="nome-sub">inativo</span>}</td>
                    <td className="esq" style={{ fontSize: 13.5 }}><TempoCasa admissao={l.colaborador.data_admissao} /></td>
                    <td className="fraco">{String(l.colaborador.peso).replace('.', ',')}</td>
                    <td>
                      {editar && l.colaborador.ativo ? (
                        <CampoNumero
                          rotulo={`Meta de ${l.colaborador.nome}`}
                          acao={salvarMetaIndividual.bind(null, periodo.id, l.colaborador.id, produto.id)}
                          valor={l.fixo}
                          placeholder={fmtValor(l.meta, u === 'brl' ? 'qtd' : u)}
                        />
                      ) : fmtValor(l.meta, u)}
                      {l.fixo !== null && <span className="nome-sub">fixa</span>}
                    </td>
                    <td>
                      {editar ? (
                        <CampoNumero rotulo={`Realizado de ${l.colaborador.nome}`} acao={salvarRealizado.bind(null, periodo.id, l.colaborador.id, produto.id)} valor={l.realizadoBruto} placeholder="0" />
                      ) : fmtValor(l.realizado, u)}
                    </td>
                    <td className="esq"><BarraRitmo pct={l.pct} esperado={l.esperado} status={l.status} compacta /></td>
                    <td>{l.status === 'batida' ? <span className="tag tag-acento">{STATUS.batida}</span> : fmtValor(l.falta, u)}</td>
                    <td>{l.falta > 0 ? fmtValor(l.porDia, u, 1) : '—'}</td>
                    <td>{l.semanaAtual && l.falta > 0 ? fmtValor(l.semanaAtual.necessario, u) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {semColabs && filhos.length === 0 && (
        <section className="secao">
          <h2>Realizado da equipe</h2>
          <p className="dica" style={{ marginBottom: 10 }}>Esta equipe não tem colaboradores cadastrados, então o realizado é lançado direto aqui.</p>
          <div className="bloco linha-acoes">
            <span>{produto.nome}:</span>
            {editar
              ? <CampoNumero largo rotulo={`Realizado de ${grupo.nome}`} acao={salvarRealizadoGrupo.bind(null, periodo.id, id, produto.id)} valor={an.realizadoGrupoDireto(id, produto.id)} placeholder="0" />
              : <strong>{fmtValor(ind.realizado, u)}</strong>}
            <Link href="/estrutura" className="dica">Cadastrar colaboradores</Link>
          </div>
        </section>
      )}
    </>
  );
}
