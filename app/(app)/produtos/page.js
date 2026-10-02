import { exigirSessao, podeEditar } from '@/lib/auth';
import FormAcao from '@/components/FormAcao';
import { criarProduto, salvarProduto, alternarProduto } from '@/app/actions/dados';

const UNIDADES = { qtd: 'Quantidade', brl: 'Valor (R$)' };

export default async function Produtos() {
  const { supabase, perfil } = await exigirSessao();
  const editar = podeEditar(perfil);
  const { data: produtos = [] } = await supabase.from('produtos').select('*').order('ordem').order('nome');

  return (
    <>
      <div className="topo">
        <div>
          <h1>Produtos</h1>
          <p className="sub">O fechamento indica qual calendário o produto segue. Ex.: Fibra pode fechar em data diferente de Móvel.</p>
        </div>
      </div>

      <div className="tabela-wrap">
        <table>
          <thead><tr><th>Produto</th><th className="esq">Medida</th><th className="esq">Fechamento</th><th>Ordem</th>{editar && <><th></th><th></th></>}</tr></thead>
          <tbody>
            {produtos.map((p) => (
              <tr key={p.id} className={p.ativo ? '' : 'inativo'}>
                {editar ? (
                  <>
                    <td colSpan={5} style={{ padding: '6px 12px' }}>
                      <FormAcao acao={salvarProduto}>
                        <div className="campos" style={{ flexWrap: 'nowrap' }}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="text" name="nome" defaultValue={p.nome} aria-label="Nome" style={{ width: 200 }} />
                          <select name="unidade" defaultValue={p.unidade} aria-label="Medida">
                            {Object.entries(UNIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                          <input type="text" name="ciclo" defaultValue={p.ciclo} aria-label="Fechamento" style={{ width: 110 }} />
                          <input type="number" name="ordem" defaultValue={p.ordem} aria-label="Ordem" style={{ width: 70 }} />
                          <button className="btn btn-sec btn-peq" type="submit">Salvar</button>
                        </div>
                      </FormAcao>
                    </td>
                    <td>
                      <FormAcao acao={alternarProduto}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="ativar" value={p.ativo ? '0' : '1'} />
                        <button className={p.ativo ? 'btn btn-perigo btn-peq' : 'btn btn-sec btn-peq'} type="submit">{p.ativo ? 'Inativar' : 'Reativar'}</button>
                      </FormAcao>
                    </td>
                  </>
                ) : (
                  <><td>{p.nome}</td><td className="esq">{UNIDADES[p.unidade]}</td><td className="esq">{p.ciclo}</td><td>{p.ordem}</td></>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editar && (
        <section className="secao">
          <h2>Novo produto</h2>
          <FormAcao acao={criarProduto} className="bloco">
            <div className="campos">
              <label className="campo">Nome<input type="text" name="nome" required /></label>
              <label className="campo">Medida
                <select name="unidade">{Object.entries(UNIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              </label>
              <label className="campo">Fechamento<input type="text" name="ciclo" defaultValue="GERAL" style={{ width: 110 }} /></label>
              <label className="campo">Ordem<input type="number" name="ordem" defaultValue={produtos.length + 1} style={{ width: 70 }} /></label>
              <button className="btn" type="submit">Criar produto</button>
            </div>
            <p className="dica" style={{ marginTop: 8 }}>Se usar um código de fechamento novo, cadastre as datas dele em Períodos e fechamentos.</p>
          </FormAcao>
        </section>
      )}
    </>
  );
}
