import Link from 'next/link';
import { exigirSessao, podeEditar } from '@/lib/auth';
import { carregarEstrutura } from '@/lib/dados';
import { feriadosNacionais } from '@/lib/feriados';
import { diaDaSemana, hojeSP } from '@/lib/datas';
import { fmtData } from '@/lib/formato';
import FormAcao from '@/components/FormAcao';
import { criarFeriado, excluirFeriado, salvarConfig } from '@/app/actions/dados';

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export default async function Feriados({ searchParams }) {
  const sp = await searchParams;
  const { supabase, perfil } = await exigirSessao();
  const editar = podeEditar(perfil);
  const anoAtual = Number(hojeSP().slice(0, 4));
  const ano = Number(sp.ano) || anoAtual;
  const [est, { data: lista = [] }, { data: config }] = await Promise.all([
    carregarEstrutura(supabase),
    supabase.from('feriados').select('*').gte('data', `${ano}-01-01`).lte('data', `${ano}-12-31`).order('data'),
    supabase.from('config').select('*').eq('id', 1).maybeSingle(),
  ]);
  const cfg = config || { sabado_util: false, feriado_carnaval: true, feriado_corpus_christi: true };
  const nacionais = feriadosNacionais(ano);
  const nomeGrupo = (id) => est.caminho(id).map((g) => g.nome).join(' / ');
  const ligado = (f) => (f.opcional === 'carnaval' ? cfg.feriado_carnaval : f.opcional === 'corpus' ? cfg.feriado_corpus_christi : true);

  return (
    <>
      <div className="topo">
        <div>
          <h1>Feriados {ano}</h1>
          <p className="sub">Os nacionais são calculados sozinhos todo ano. Cadastre aqui os estaduais, municipais e as exceções.</p>
        </div>
        <div className="linha-acoes">
          <Link className="btn btn-sec btn-peq" href={`/feriados?ano=${ano - 1}`}>{ano - 1}</Link>
          <Link className="btn btn-sec btn-peq" href={`/feriados?ano=${ano + 1}`}>{ano + 1}</Link>
        </div>
      </div>

      <section>
        <h2 style={{ marginBottom: 10 }}>Regras do calendário</h2>
        <FormAcao acao={salvarConfig} className="bloco">
          <label className="check"><input type="checkbox" name="sabado_util" defaultChecked={cfg.sabado_util} disabled={!editar} /> Sábado conta como dia útil</label>
          <label className="check"><input type="checkbox" name="feriado_carnaval" defaultChecked={cfg.feriado_carnaval} disabled={!editar} /> Segunda e terça de Carnaval não são dias úteis</label>
          <label className="check"><input type="checkbox" name="feriado_corpus_christi" defaultChecked={cfg.feriado_corpus_christi} disabled={!editar} /> Corpus Christi não é dia útil</label>
          {editar && <button className="btn btn-peq" type="submit" style={{ marginTop: 8 }}>Salvar regras</button>}
        </FormAcao>
      </section>

      <section className="secao">
        <h2 style={{ marginBottom: 10 }}>Cadastrados</h2>
        {editar && (
          <FormAcao acao={criarFeriado} className="bloco" >
            <div className="campos">
              <label className="campo">Data<input type="date" name="data" required defaultValue={`${ano}-01-01`} /></label>
              <label className="campo">Nome<input type="text" name="nome" required placeholder="ex.: Aniversário de Campinas" /></label>
              <label className="campo">Tipo
                <select name="tipo"><option value="feriado">Feriado (não é dia útil)</option><option value="dia_util">Dia útil extra (trabalha)</option></select>
              </label>
              <label className="campo">Vale para
                <select name="grupo_id" defaultValue="">
                  <option value="">Todos</option>
                  {est.achatar(null, 0, true).map((g) => <option key={g.id} value={g.id}>{nomeGrupo(g.id)}</option>)}
                </select>
              </label>
              <button className="btn" type="submit">Cadastrar</button>
            </div>
            <p className="dica" style={{ marginTop: 8 }}>Um feriado de uma equipe vale também para as equipes abaixo dela. Use "Dia útil extra" para um sábado trabalhado ou um feriado em que a operação funciona.</p>
          </FormAcao>
        )}
        {lista.length ? (
          <div className="tabela-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead><tr><th>Data</th><th className="esq">Nome</th><th className="esq">Tipo</th><th className="esq">Vale para</th>{editar && <th></th>}</tr></thead>
              <tbody>
                {lista.map((f) => (
                  <tr key={f.id}>
                    <td>{fmtData(f.data, true)} <span className="nome-sub">{DIAS[diaDaSemana(f.data)]}</span></td>
                    <td className="esq">{f.nome}</td>
                    <td className="esq">{f.tipo === 'dia_util' ? <span className="tag tag-acento">Dia útil extra</span> : <span className="tag">Feriado</span>}</td>
                    <td className="esq">{f.grupo_id ? nomeGrupo(f.grupo_id) : 'Todos'}</td>
                    {editar && (
                      <td>
                        <FormAcao acao={excluirFeriado} confirmar={`Excluir ${f.nome}?`}>
                          <input type="hidden" name="id" value={f.id} />
                          <button className="btn btn-perigo btn-peq" type="submit">Excluir</button>
                        </FormAcao>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="dica" style={{ marginTop: 10 }}>Nenhum feriado cadastrado em {ano}.</p>}
      </section>

      <section className="secao">
        <h2 style={{ marginBottom: 10 }}>Nacionais (automáticos)</h2>
        <div className="tabela-wrap">
          <table>
            <thead><tr><th>Data</th><th className="esq">Feriado</th><th className="esq">Situação</th></tr></thead>
            <tbody>
              {nacionais.map((f) => {
                const dow = diaDaSemana(f.data);
                const fimDeSemana = dow === 0 || (dow === 6 && !cfg.sabado_util);
                return (
                  <tr key={f.data} className={ligado(f) ? '' : 'inativo'}>
                    <td>{fmtData(f.data, true)} <span className="nome-sub">{DIAS[dow]}</span></td>
                    <td className="esq">{f.nome}</td>
                    <td className="esq fraco">{!ligado(f) ? 'Desligado nas regras: conta como dia útil' : fimDeSemana ? 'Cai no fim de semana' : 'Descontado dos dias úteis'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
