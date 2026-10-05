import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirSessao, podeEditar } from '@/lib/auth';
import { listarPeriodos, escolherPeriodo, carregarBase, analisar } from '@/lib/dados';
import { fmtValor, fmtData, fmtFator, STATUS } from '@/lib/formato';
import { salvarRealizado } from '@/app/actions/dados';
import BarraRitmo from '@/components/BarraRitmo';
import CampoNumero from '@/components/CampoNumero';
import { tempoDeCasa } from '@/lib/datas';
import Composicao from '@/components/Composicao';
import { lerMedida } from '@/lib/medidaServidor';
import AlternarMedida from '@/components/AlternarMedida';
import SeletorPeriodo from '@/components/SeletorPeriodo';
import SemPeriodo from '@/components/SemPeriodo';

export default async function DetalheColaborador({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, perfil } = await exigirSessao();
  const editar = podeEditar(perfil);
  const periodos = await listarPeriodos(supabase);
  const periodo = escolherPeriodo(periodos, sp.p);
  if (!periodo) return <SemPeriodo podeEditar={editar} />;
  const medida = await lerMedida(sp);
  const base = await carregarBase(supabase, periodo, medida);
  const colab = base.colaboradores.find((c) => c.id === id);
  if (!colab) notFound();
  const an = analisar(base);
  const caminho = base.caminho(colab.grupo_id);
  const fator = fmtFator(periodo.fator_bruto);

  const linhas = base.produtos.filter((p) => p.ativo).map((produto) => {
    const { linhas: ls } = an.individuais(colab.grupo_id, produto);
    const l = ls.find((x) => x.colaborador.id === id);
    const temMetaGrupo = an.meta(colab.grupo_id, produto.id) !== null;
    return l ? { produto, ...l, temMetaGrupo } : { produto, meta: 0, realizado: 0, realizadoBruto: null, pct: null, esperado: 0, status: 'sem-meta', falta: 0, faltaBruta: 0, porDia: 0, semanaAtual: null, fixo: null, temMetaGrupo };
  }).filter((l) => l.temMetaGrupo || l.realizado > 0);

  return (
    <>
      <div className="topo">
        <div>
          <p className="dica">
            <Link href={`/?p=${periodo.id}&c=${caminho[0]?.id}`}>Painel</Link>
            {caminho.map((g) => <span key={g.id}> / <Link href={`/grupos/${g.id}?p=${periodo.id}`}>{g.nome}</Link></span>)}
          </p>
          <h1 style={{ marginTop: 6 }}>{colab.nome}</h1>
          <p className="sub">
            {periodo.nome}. Peso {String(colab.peso).replace('.', ',')} na divisão da meta.
            {colab.data_admissao && ` Admissão em ${fmtData(colab.data_admissao, true)}${tempoDeCasa(colab.data_admissao) ? `, ${tempoDeCasa(colab.data_admissao).texto} de casa` : ''}.`}
            {colab.data_desligamento ? ` Desligado em ${fmtData(colab.data_desligamento, true)}.` : !colab.ativo && ' Colaborador inativo.'}
          </p>
        </div>
        <div className="linha-acoes">
          <AlternarMedida atual={medida} />
          <SeletorPeriodo periodos={periodos} atual={periodo.id} />
        </div>
      </div>

      {!linhas.length ? (
        <div className="vazio"><h2>Sem metas neste período</h2><p>A equipe {caminho.at(-1)?.nome} ainda não tem metas lançadas em {periodo.nome}.</p></div>
      ) : (
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr><th>Produto</th><th>Meta</th><th>Realizado</th><th className="esq">Ritmo</th><th>Falta</th><th>Falta {fator}</th><th>Por dia útil</th><th>Nesta semana</th><th>Fecha em</th></tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const u = l.produto.unidade;
                const ciclo = an.cicloDe(l.produto);
                return (
                  <tr key={l.produto.id}>
                    <td>{l.produto.nome}</td>
                    <td>{fmtValor(l.meta, u)}{l.fixo !== null && <span className="nome-sub">fixa</span>}</td>
                    <td>
                      {an.ehComposto(l.produto.id)
                        ? <>{fmtValor(l.realizado, u)}<Composicao compacta itens={an.composicaoColab(id, l.produto.id)} /></>
                        : editar
                          ? <CampoNumero rotulo={`Realizado ${l.produto.nome}`} acao={salvarRealizado.bind(null, periodo.id, id, l.produto.id, medida)} valor={l.realizadoBruto} placeholder="0" />
                          : fmtValor(l.realizado, u)}
                    </td>
                    <td className="esq"><BarraRitmo pct={l.pct} esperado={l.esperado} status={l.status} /></td>
                    <td>{l.status === 'batida' ? <span className="tag tag-acento">{STATUS.batida}</span> : fmtValor(l.falta, u)}</td>
                    <td className="fraco">{fmtValor(l.faltaBruta, u)}</td>
                    <td>{l.falta > 0 ? fmtValor(l.porDia, u, 1) : '—'}</td>
                    <td>{l.semanaAtual && l.falta > 0 ? fmtValor(l.semanaAtual.necessario, u) : '—'}</td>
                    <td className="fraco">{ciclo ? fmtData(ciclo.data_fim) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="dica" style={{ marginTop: 12 }}>
        Para mudar a meta individual ou ver as semanas, abra a equipe <Link href={`/grupos/${colab.grupo_id}?p=${periodo.id}`}>{caminho.at(-1)?.nome}</Link>.
      </p>
    </>
  );
}
