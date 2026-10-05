import { exigirSessao, podeEditar } from '@/lib/auth';
import { carregarEstrutura } from '@/lib/dados';
import FormAcao from '@/components/FormAcao';
import { criarProduto, salvarProduto, alternarProduto, salvarComposicao } from '@/app/actions/dados';

const UNIDADES = { qtd: 'Quantidade', brl: 'Valor (R$)' };

export default async function Produtos() {
  const { supabase, perfil } = await exigirSessao();
  const editar = podeEditar(perfil);
  const { produtos } = await carregarEstrutura(supabase);
  const simples = produtos.filter((p) => p.tipo !== 'composto' && p.ativo);
  const nome = new Map(produtos.map((p) => [p.id, p.nome]));
  const somas = produtos.filter((p) => p.tipo === 'composto');

  return (
    <>
      <div className="topo">
        <div>
          <h1>Produtos</h1>
          <p className="sub">O fechamento indica qual calendário o produto segue. Um produto <b>soma</b> junta vários produtos numa meta só (ex.: Total de produtos = 200).</p>
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
                          {p.tipo === 'composto'
                            ? <><input type="hidden" name="unidade" value={p.unidade} /><span className="tag tag-acento" style={{ minWidth: 150 }}>Soma ({p.unidade === 'brl' ? 'R$' : 'quantidade'})</span></>
                            : (
                              <select name="unidade" defaultValue={p.unidade} aria-label="Medida">
                                {Object.entries(UNIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                              </select>
                            )}
                          <input type="text" name="ciclo" defaultValue={p.ciclo} aria-label="Fechamento" style={{ width: 110 }} />
                          <input type="number" name="ordem" defaultValue={p.ordem} aria-label="Ordem" style={{ width: 70 }} />
                          <button className="btn btn-sec btn-peq" type="submit">Salvar</button>
                        </div>
                      </FormAcao>
                      {p.tipo === 'composto' && (
                        <p className="dica" style={{ marginTop: 4 }}>Soma de: {p.componentes.map((c) => `${nome.get(c.componente_id)}${c.peso !== 1 ? ` (x${String(c.peso).replace('.', ',')})` : ''}`).join(', ') || 'nenhum produto ainda'}</p>
                      )}
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
                  <>
                    <td>{p.nome}{p.tipo === 'composto' && <span className="nome-sub">soma de {p.componentes.map((c) => nome.get(c.componente_id)).join(', ')}</span>}</td>
                    <td className="esq">{p.tipo === 'composto' ? 'Soma de produtos' : UNIDADES[p.unidade]}</td>
                    <td className="esq">{p.ciclo}</td><td>{p.ordem}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editar && somas.length > 0 && (
        <section className="secao">
          <h2 style={{ marginBottom: 6 }}>O que entra em cada soma</h2>
          <p className="dica" style={{ marginBottom: 10 }}>Marque os produtos que contam. O peso diz quanto cada venda vale na soma (1 = uma venda; 2 = conta em dobro).</p>
          <div className="pers-grade">
            {somas.map((s) => {
              const marcados = new Map(s.componentes.map((c) => [c.componente_id, c.peso]));
              return (
                <FormAcao key={s.id} acao={salvarComposicao} className="bloco">
                  <h3 style={{ marginBottom: 8 }}>{s.nome}</h3>
                  <input type="hidden" name="produto_id" value={s.id} />
                  <p className="dica" style={{ marginBottom: 6 }}>Só aparecem produtos em {s.unidade === 'brl' ? 'R$' : 'quantidade'}, a mesma medida da soma.</p>
                  {simples.filter((p) => p.unidade === s.unidade).map((p) => (
                    <div key={p.id} className="campos" style={{ alignItems: 'center', marginBottom: 4, flexWrap: 'nowrap' }}>
                      <label className="check" style={{ flex: 1 }}><input type="checkbox" name="comp" value={p.id} defaultChecked={marcados.has(p.id)} /> {p.nome}</label>
                      <label className="dica" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>peso
                        <input type="text" name={`peso_${p.id}`} defaultValue={String(marcados.get(p.id) ?? 1).replace('.', ',')} style={{ width: 52, textAlign: 'right' }} aria-label={`Peso de ${p.nome}`} />
                      </label>
                    </div>
                  ))}
                  <button className="btn btn-peq" type="submit" style={{ marginTop: 8 }}>Salvar soma</button>
                </FormAcao>
              );
            })}
          </div>
        </section>
      )}

      {editar && (
        <section className="secao">
          <h2>Novo produto</h2>
          <FormAcao acao={criarProduto} className="bloco">
            <div className="campos">
              <label className="campo">Nome<input type="text" name="nome" required placeholder="ex.: Total de produtos" /></label>
              <label className="campo">Tipo
                <select name="tipo" defaultValue="simples">
                  <option value="simples">Produto normal</option>
                  <option value="composto">Soma de produtos</option>
                </select>
              </label>
              <label className="campo">Medida
                <select name="unidade">{Object.entries(UNIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              </label>
              <label className="campo">Fechamento<input type="text" name="ciclo" defaultValue="GERAL" style={{ width: 110 }} /></label>
              <label className="campo">Ordem<input type="number" name="ordem" defaultValue={produtos.length + 1} style={{ width: 70 }} /></label>
              <button className="btn" type="submit">Criar produto</button>
            </div>
            <p className="dica" style={{ marginTop: 8 }}>Uma soma junta produtos da mesma medida (ex.: Receitas altas em R$ = Alta Móvel + Alta Básica + VADA). Depois de criar, escolha os produtos no quadro "O que entra em cada soma".</p>
          </FormAcao>
        </section>
      )}
    </>
  );
}
