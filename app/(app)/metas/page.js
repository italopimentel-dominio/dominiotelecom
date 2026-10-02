import { exigirSessao, podeEditar } from '@/lib/auth';
import { listarPeriodos, escolherPeriodo, carregarBase, analisar } from '@/lib/dados';
import { fmtValor } from '@/lib/formato';
import { salvarMeta, copiarMetas } from '@/app/actions/dados';
import CampoNumero from '@/components/CampoNumero';
import FormAcao from '@/components/FormAcao';
import SeletorPeriodo from '@/components/SeletorPeriodo';
import SemPeriodo from '@/components/SemPeriodo';

export default async function Metas({ searchParams }) {
  const sp = await searchParams;
  const { supabase, perfil } = await exigirSessao();
  const editar = podeEditar(perfil);
  const periodos = await listarPeriodos(supabase);
  const periodo = escolherPeriodo(periodos, sp.p);
  if (!periodo) return <SemPeriodo podeEditar={editar} />;
  const base = await carregarBase(supabase, periodo);
  const an = analisar(base);
  const produtos = base.produtos.filter((p) => p.ativo);
  const grupos = base.achatar(null, 0, true);
  const outros = periodos.filter((p) => p.id !== periodo.id);

  return (
    <>
      <div className="topo">
        <div>
          <h1>Metas de {periodo.nome}</h1>
          <p className="sub">
            {editar
              ? 'Digite a meta e saia do campo para salvar. Campo vazio = sem meta. Valores em R$ aceitam vírgula.'
              : 'Você está no modo de visualização.'}
          </p>
        </div>
        <SeletorPeriodo periodos={periodos} atual={periodo.id} />
      </div>

      <div className="tabela-wrap">
        <table>
          <thead>
            <tr>
              <th>Canal / equipe</th>
              {produtos.map((p) => <th key={p.id}>{p.nome}{p.unidade === 'brl' && <span className="nome-sub">R$</span>}</th>)}
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => (
              <tr key={g.id} className={`nivel-${Math.min(g.nivel, 3)}${g.nivel === 0 ? ' linha-grupo' : ''}`}>
                <td>{g.nome}</td>
                {produtos.map((p) => {
                  const v = an.meta(g.id, p.id);
                  return (
                    <td key={p.id}>
                      {editar
                        ? <CampoNumero rotulo={`Meta ${p.nome} ${g.nome}`} acao={salvarMeta.bind(null, periodo.id, g.id, p.id)} valor={v} />
                        : v === null ? <span className="fraco">—</span> : fmtValor(v, p.unidade)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editar && outros.length > 0 && (
        <section className="secao">
          <h2>Copiar metas de outro mês</h2>
          <p className="dica" style={{ marginBottom: 10 }}>Copia todas as metas do mês escolhido para {periodo.nome}. Metas já preenchidas aqui são substituídas.</p>
          <FormAcao acao={copiarMetas} className="bloco" confirmar={`Substituir as metas de ${periodo.nome}?`}>
            <div className="campos">
              <input type="hidden" name="destino" value={periodo.id} />
              <label className="campo">Copiar de
                <select name="origem">{outros.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
              </label>
              <button className="btn btn-sec" type="submit">Copiar metas</button>
            </div>
          </FormAcao>
        </section>
      )}
    </>
  );
}
