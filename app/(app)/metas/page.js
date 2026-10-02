import { exigirSessao, podeEditar } from '@/lib/auth';
import { listarPeriodos, escolherPeriodo, carregarBase, analisar } from '@/lib/dados';
import { fmtValor } from '@/lib/formato';
import { salvarMeta, copiarMetas, criarPeriodo } from '@/app/actions/dados';
import CampoNumero from '@/components/CampoNumero';
import FormAcao from '@/components/FormAcao';
import SeletorPeriodo from '@/components/SeletorPeriodo';
import SemPeriodo from '@/components/SemPeriodo';

function mesSeguinte(referencia) {
  const [a, m] = referencia.split('-').map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
}

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
  const ultimo = periodos[0];
  const proximo = mesSeguinte(ultimo.referencia);
  const acrescimo = String(Math.round((ultimo.fator_bruto - 1) * 1000) / 10).replace('.', ',');

  return (
    <>
      <div className="topo">
        <div>
          <h1>Metas de {periodo.nome}</h1>
          <p className="sub">
            {editar
              ? 'Lance a meta de cada equipe. As linhas em negrito são a soma automática das equipes abaixo delas.'
              : 'Você está no modo de visualização.'}
          </p>
        </div>
        <div className="linha-acoes">
          <SeletorPeriodo periodos={periodos} atual={periodo.id} />
        </div>
      </div>

      {editar && (
        <details className="recolhivel" style={{ marginBottom: 14 }}>
          <summary>Criar metas de outro mês</summary>
          <div className="bloco" style={{ marginTop: 8, display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            <FormAcao acao={criarPeriodo}>
              <h3 style={{ marginBottom: 8 }}>Novo mês</h3>
              <div className="campos">
                <input type="hidden" name="voltar" value="metas" />
                <input type="hidden" name="acrescimo" value={acrescimo} />
                <label className="campo">Mês<input type="month" name="mes" defaultValue={proximo} required /></label>
                <label className="campo">Começar com as metas de
                  <select name="copiar_de" defaultValue={periodo.id}>
                    <option value="">Em branco</option>
                    {periodos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </label>
                <button className="btn" type="submit">Criar mês</button>
              </div>
              <p className="dica" style={{ marginTop: 8 }}>Cria o mês com os fechamentos do dia 1 ao último dia (ajustáveis em Cadastros &gt; Períodos) e já abre aqui para você só alterar o que mudou.</p>
            </FormAcao>
            {outros.length > 0 && (
              <FormAcao acao={copiarMetas} confirmar={`Substituir as metas de ${periodo.nome}?`}>
                <h3 style={{ marginBottom: 8 }}>Copiar para {periodo.nome}</h3>
                <div className="campos">
                  <input type="hidden" name="destino" value={periodo.id} />
                  <label className="campo">Copiar metas de
                    <select name="origem">{outros.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
                  </label>
                  <button className="btn btn-sec" type="submit">Copiar</button>
                </div>
                <p className="dica" style={{ marginTop: 8 }}>Substitui as metas já preenchidas neste mês.</p>
              </FormAcao>
            )}
          </div>
        </details>
      )}

      <div className="tabela-wrap grade-metas">
        <table>
          <thead>
            <tr>
              <th>Canal / equipe</th>
              {produtos.map((p) => <th key={p.id}>{p.nome}{p.unidade === 'brl' && <span className="nome-sub">R$</span>}</th>)}
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => {
              const soma = an.ehSoma(g.id);
              return (
                <tr key={g.id} className={`nivel-${Math.min(g.nivel, 3)}${soma ? ' linha-soma' : ''}`}>
                  <td>{g.nome}{soma && <span className="nome-sub">soma das equipes</span>}</td>
                  {produtos.map((p) => {
                    const v = an.meta(g.id, p.id);
                    return (
                      <td key={p.id}>
                        {editar && !soma
                          ? <CampoNumero rotulo={`Meta ${p.nome} ${g.nome}`} acao={salvarMeta.bind(null, periodo.id, g.id, p.id)} valor={v} />
                          : v === null ? <span className="fraco">—</span> : fmtValor(v, p.unidade)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
