import FormAcao from '@/components/FormAcao';
import TempoCasa from '@/components/TempoCasa';
import { fmtData } from '@/lib/formato';
import { capitalizar } from '@/lib/nomes';
import { salvarColaborador, alternarColaborador } from '@/app/actions/dados';

const COTAS = [['1', 'Cota cheia'], ['0.5', 'Meia cota'], ['0', 'Sem meta']];

// Cota da meta (peso) com nomes fáceis
export function CampoCota({ valor = 1 }) {
  const v = String(Number(valor));
  const padrao = COTAS.some(([k]) => k === v);
  return (
    <label className="campo">Cota da meta
      <select name="peso" defaultValue={v}>
        {COTAS.map(([k, r]) => <option key={k} value={k}>{r}</option>)}
        {!padrao && <option value={v}>Outra ({v.replace('.', ',')})</option>}
      </select>
    </label>
  );
}

// Lista de pessoas com Editar (inclui transferir de equipe) e Desligar/Reativar
export default function ListaPessoas({ pessoas, editar, hoje, opcoesEquipe }) {
  return (
    <ul className="pessoas-lista">
      {pessoas.map((c) => (
        <li key={c.id} className={c.ativo ? '' : 'desligado'}>
          <div className="pessoa-linha">
            {c.foto_url ? <img src={c.foto_url} alt="" className="pessoa-avatar" /> : <span className="pessoa-avatar">{c.nome.trim().charAt(0).toUpperCase()}</span>}
            <div className="pessoa-info">
              <strong>{capitalizar(c.nome)}</strong>
              <span>
                {c.ativo
                  ? c.data_admissao ? <>Admitido em {fmtData(c.data_admissao, true)}, <TempoCasa admissao={c.data_admissao} /></> : <span className="fraco">Sem data de admissão</span>
                  : <span className="txt-risco">Desligado em {c.data_desligamento ? fmtData(c.data_desligamento, true) : '—'}</span>}
                {Number(c.peso) !== 1 && <span className="tag" style={{ marginLeft: 6 }}>{Number(c.peso) === 0 ? 'sem meta' : Number(c.peso) === 0.5 ? 'meia cota' : `cota ${String(c.peso).replace('.', ',')}`}</span>}
              </span>
            </div>
            {editar && (
              <div className="pessoa-acoes">
                <details className="acao-pessoa">
                  <summary>Editar</summary>
                  <div className="acao-painel">
                    <FormAcao acao={salvarColaborador}>
                      <input type="hidden" name="id" value={c.id} />
                      <div className="campos">
                        <label className="campo" style={{ flex: '1 1 220px' }}>Nome<input type="text" name="nome" defaultValue={c.nome} required /></label>
                        <label className="campo">Equipe (para transferir)
                          <select name="grupo_id" defaultValue={c.grupo_id}>
                            {opcoesEquipe.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                          </select>
                        </label>
                        <label className="campo">Data de admissão<input type="date" name="data_admissao" defaultValue={c.data_admissao || ''} /></label>
                        <CampoCota valor={c.peso} />
                        <button className="btn btn-sec" type="submit">Salvar</button>
                      </div>
                    </FormAcao>
                  </div>
                </details>
                {c.ativo ? (
                  <details className="acao-pessoa acao-desligar">
                    <summary>Desligar</summary>
                    <div className="acao-painel">
                      <FormAcao acao={alternarColaborador} confirmar={`Confirmar o desligamento de ${capitalizar(c.nome)}?`}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="ativar" value="0" />
                        <div className="campos">
                          <label className="campo">Data de desligamento<input type="date" name="data_desligamento" defaultValue={hoje} required /></label>
                          <button className="btn btn-perigo" type="submit">Confirmar desligamento</button>
                        </div>
                        <p className="dica" style={{ marginTop: 6 }}>Os resultados continuam no histórico dos meses em que a pessoa trabalhou.</p>
                      </FormAcao>
                    </div>
                  </details>
                ) : (
                  <FormAcao acao={alternarColaborador} confirmar={`Reativar ${capitalizar(c.nome)}? A data de desligamento será apagada.`}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="ativar" value="1" />
                    <button className="btn btn-sec btn-peq" type="submit">Reativar</button>
                  </FormAcao>
                )}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
