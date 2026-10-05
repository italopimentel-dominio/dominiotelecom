import { exigirSessao, podeEditar } from '@/lib/auth';
import { carregarEstrutura } from '@/lib/dados';
import { medidasDo, listaMedidas, temMedida } from '@/lib/medida';
import FormAcao from '@/components/FormAcao';
import { criarProduto, salvarProduto, alternarProduto, salvarComposicao } from '@/app/actions/dados';

const UNIDADES = { qtd: 'Quantidade', brl: 'Receita (R$)', ambos: 'Quantidade e receita' };

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
          <p className="sub">Medida: quantidade, receita (R$) ou as duas (aí você lança e vê os dois, alternando no botão Quantidade | Receita). O fechamento indica qual calendário o produto segue. Um produto <b>soma</b> junta vários produtos numa meta só (ex.: Total de produtos = 200).</p>
        </div>
      </div>

      <div className="prod-lista">
        <div className={`prod-linha prod-cab${editar ? '' : ' so-ver'}`}>
          <span>Produto</span><span>Medida</span><span>Fechamento</span><span>Ordem</span>{editar && <><span /><span /></>}
        </div>
        {produtos.map((p) => (
          <div key={p.id} className={`prod-item${p.ativo ? '' : ' inativo'}`}>
            {editar ? (
              <FormAcao acao={salvarProduto} className="prod-form">
                <div className="prod-linha">
                  <input type="hidden" name="id" value={p.id} />
                  <input type="text" name="nome" defaultValue={p.nome} aria-label="Nome" />
                  <select name="medidas" defaultValue={medidasDo(p)} aria-label="Medida">
                    {Object.entries(UNIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <input type="text" name="ciclo" defaultValue={p.ciclo} aria-label="Fechamento" />
                  <input type="number" name="ordem" defaultValue={p.ordem} aria-label="Ordem" />
                  <button className="btn btn-sec btn-peq" type="submit">Salvar</button>
                  <span />
                </div>
              </FormAcao>
            ) : (
              <div className="prod-linha so-ver">
                <span>{p.nome}</span><span>{UNIDADES[medidasDo(p)]}</span><span>{p.ciclo}</span><span>{p.ordem}</span>
              </div>
            )}
            {editar && (
              <FormAcao acao={alternarProduto} className="prod-inativar">
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="ativar" value={p.ativo ? '0' : '1'} />
                <button className={p.ativo ? 'btn btn-perigo btn-peq' : 'btn btn-sec btn-peq'} type="submit">{p.ativo ? 'Inativar' : 'Reativar'}</button>
              </FormAcao>
            )}
            {p.tipo === 'composto' && (
              <p className="prod-soma"><span className="tag-soma">soma</span> {p.componentes.map((c) => `${nome.get(c.componente_id)}${c.peso !== 1 ? ` (x${String(c.peso).replace('.', ',')})` : ''}`).join(', ') || 'nenhum produto ainda'}</p>
            )}
          </div>
        ))}
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
                  <p className="dica" style={{ marginBottom: 6 }}>Aparecem os produtos com a mesma medida da soma ({UNIDADES[medidasDo(s)].toLowerCase()}).</p>
                  {simples.filter((p) => listaMedidas(s).some((m) => temMedida(p, m))).map((p) => (
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
                <select name="medidas" defaultValue="ambos">{Object.entries(UNIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
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
