import { exigirSessao, podeEditar } from '@/lib/auth';
import { listarPeriodos } from '@/lib/dados';
import { montarCalendario, resumoCiclo } from '@/lib/calc';
import { hojeSP } from '@/lib/datas';
import { fmtData } from '@/lib/formato';
import FormAcao from '@/components/FormAcao';
import { criarPeriodo, salvarPeriodo, salvarCiclo } from '@/app/actions/dados';

export default async function Periodos() {
  const { supabase, perfil } = await exigirSessao();
  const editar = podeEditar(perfil);
  const periodos = await listarPeriodos(supabase);
  const [{ data: ciclos = [] }, { data: feriados = [] }, { data: config }, { data: produtos = [] }] = await Promise.all([
    supabase.from('ciclos').select('*').order('data_inicio'),
    supabase.from('feriados').select('*'),
    supabase.from('config').select('*').eq('id', 1).maybeSingle(),
    supabase.from('produtos').select('nome, ciclo').eq('ativo', true),
  ]);
  const cal = montarCalendario(config, feriados.filter((f) => !f.grupo_id));
  const hoje = hojeSP();
  const prox = new Date();
  prox.setMonth(prox.getMonth() + 1);
  const mesSugerido = prox.toISOString().slice(0, 7);
  const produtosDo = (codigo) => produtos.filter((p) => p.ciclo === codigo).map((p) => p.nome).join(', ');

  return (
    <>
      <div className="topo">
        <div>
          <h1>Períodos e fechamentos</h1>
          <p className="sub">Cada mês tem um ou mais fechamentos com datas próprias. Os dias úteis já descontam fins de semana e feriados nacionais.</p>
        </div>
      </div>

      {editar && (
        <FormAcao acao={criarPeriodo} className="bloco">
          <h3 style={{ marginBottom: 10 }}>Novo mês</h3>
          <div className="campos">
            <label className="campo">Mês<input type="month" name="mes" defaultValue={mesSugerido} required /></label>
            <label className="campo">Acréscimo da necessidade bruta (%)<input type="text" name="acrescimo" defaultValue="30" style={{ width: 80 }} /></label>
            <label className="campo">Copiar metas de
              <select name="copiar_de" defaultValue={periodos[0]?.id || ''}>
                <option value="">Não copiar</option>
                {periodos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </label>
            <button className="btn" type="submit">Criar mês</button>
          </div>
        </FormAcao>
      )}

      {!periodos.length && <div className="vazio" style={{ marginTop: 20 }}><h2>Nenhum período ainda</h2><p>Crie o primeiro mês acima.</p></div>}

      {periodos.map((per) => {
        const doPeriodo = ciclos.filter((c) => c.periodo_id === per.id);
        const acrescimo = String(Math.round((per.fator_bruto - 1) * 1000) / 10).replace('.', ',');
        return (
          <section key={per.id} className="secao">
            <div className="grupo-cab" style={{ marginTop: 0 }}><h2>{per.nome}</h2><span className="tag">+{acrescimo}% na bruta</span></div>
            {editar && (
              <FormAcao acao={salvarPeriodo}>
                <div className="campos" style={{ marginBottom: 10 }}>
                  <input type="hidden" name="id" value={per.id} />
                  <label className="campo">Nome<input type="text" name="nome" defaultValue={per.nome} /></label>
                  <label className="campo">Acréscimo (%)<input type="text" name="acrescimo" defaultValue={acrescimo} style={{ width: 80 }} /></label>
                  <button className="btn btn-sec btn-peq" type="submit">Salvar</button>
                </div>
              </FormAcao>
            )}
            <div className="tabela-wrap">
              <table>
                <thead><tr><th>Fechamento</th><th className="esq">Produtos</th><th>Início</th><th>Fim</th><th>Dias úteis</th><th>Restantes</th>{editar && <th></th>}</tr></thead>
                <tbody>
                  {doPeriodo.map((c) => {
                    const r = resumoCiclo(c, hoje, cal, null);
                    return editar ? (
                      <tr key={c.id}>
                        <td colSpan={7} style={{ padding: '6px 12px' }}>
                          <FormAcao acao={salvarCiclo}>
                            <div className="campos" style={{ flexWrap: 'nowrap' }}>
                              <input type="hidden" name="id" value={c.id} />
                              <span className="tag tag-acento">{c.codigo}</span>
                              <input type="text" name="nome" defaultValue={c.nome} aria-label="Nome do fechamento" style={{ width: 220 }} />
                              <span className="dica" style={{ minWidth: 160 }}>{produtosDo(c.codigo) || 'nenhum produto'}</span>
                              <input type="date" name="data_inicio" defaultValue={c.data_inicio} aria-label="Início" />
                              <input type="date" name="data_fim" defaultValue={c.data_fim} aria-label="Fim" />
                              <span style={{ minWidth: 120 }}><b>{r.total}</b> úteis, {r.restantes} restam</span>
                              <button className="btn btn-sec btn-peq" type="submit">Salvar</button>
                            </div>
                          </FormAcao>
                        </td>
                      </tr>
                    ) : (
                      <tr key={c.id}>
                        <td>{c.nome}</td><td className="esq fraco">{produtosDo(c.codigo)}</td>
                        <td>{fmtData(c.data_inicio, true)}</td><td>{fmtData(c.data_fim, true)}</td><td>{r.total}</td><td>{r.restantes}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {editar && (
              <details style={{ marginTop: 8 }}>
                <summary className="dica" style={{ cursor: 'pointer' }}>Adicionar outro fechamento neste mês</summary>
                <FormAcao acao={salvarCiclo} className="bloco">
                  <div className="campos">
                    <input type="hidden" name="periodo_id" value={per.id} />
                    <label className="campo">Código (igual ao do produto)<input type="text" name="codigo" required style={{ width: 120 }} /></label>
                    <label className="campo">Nome<input type="text" name="nome" required /></label>
                    <label className="campo">Início<input type="date" name="data_inicio" defaultValue={per.referencia} required /></label>
                    <label className="campo">Fim<input type="date" name="data_fim" required /></label>
                    <button className="btn" type="submit">Adicionar</button>
                  </div>
                </FormAcao>
              </details>
            )}
          </section>
        );
      })}
    </>
  );
}
