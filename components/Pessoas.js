import FormAcao from '@/components/FormAcao';
import TempoCasa from '@/components/TempoCasa';
import { fmtData } from '@/lib/formato';
import { capitalizar } from '@/lib/nomes';
import { salvarColaborador, alternarColaborador, transferirColaboradores, desfazerTransferencia } from '@/app/actions/dados';

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

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesCurto = (d) => `${MESES[Number(d.slice(5, 7)) - 1]}/${d.slice(0, 4)}`;
export function mesSeguinte(hoje) {
  const [a, m] = hoje.split('-').map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
}

// Lista de pessoas com Editar, Trocar de equipe (com mês) e Desligar/Reativar
export default function ListaPessoas({ pessoas, editar, hoje, opcoesEquipe }) {
  const nomeEquipe = new Map(opcoesEquipe.map((o) => [o.id, o.nome.split(' / ').pop()]));
  const proximo = mesSeguinte(hoje);
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
              {(c.vinculos || []).filter((v) => v.desde > '2000-01-01').slice(-2).map((v) => (
                <span key={v.id} className={`troca-info${v.desde > hoje ? ' futura' : ''}`}>
                  {v.desde > hoje ? '→ vai para ' : '↪ entrou em '}<b>{nomeEquipe.get(v.grupo_id) || 'outra equipe'}</b>{v.desde > hoje ? ' a partir de ' : ' em '}{mesCurto(v.desde)}
                  {editar && v.desde > hoje && (
                    <FormAcao acao={desfazerTransferencia} confirmar="Desfazer esta troca de equipe?" className="troca-desfazer">
                      <input type="hidden" name="id" value={v.id} />
                      <button type="submit" className="lt-apagar">desfazer</button>
                    </FormAcao>
                  )}
                </span>
              ))}
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
                        <input type="hidden" name="grupo_id" value={c.grupo_base || c.grupo_id} />
                        <label className="campo">Data de admissão<input type="date" name="data_admissao" defaultValue={c.data_admissao || ''} /></label>
                        <CampoCota valor={c.peso} />
                        <button className="btn btn-sec" type="submit">Salvar</button>
                      </div>
                    </FormAcao>
                  </div>
                </details>
                {c.ativo && (
                  <details className="acao-pessoa">
                    <summary>Trocar de equipe</summary>
                    <div className="acao-painel">
                      <FormAcao acao={transferirColaboradores}>
                        <input type="hidden" name="id" value={c.id} />
                        <div className="campos">
                          <label className="campo">Nova equipe
                            <select name="grupo_id" required defaultValue="">
                              <option value="" disabled>Escolha</option>
                              {opcoesEquipe.filter((o) => o.id !== c.grupo_id).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                            </select>
                          </label>
                          <label className="campo">A partir do mês<input type="month" name="mes" defaultValue={proximo} required /></label>
                          <button className="btn" type="submit">Confirmar troca</button>
                        </div>
                        <p className="dica" style={{ marginTop: 6 }}>Os meses antes disso continuam na equipe atual (metas e resultados não mudam de lugar).</p>
                      </FormAcao>
                    </div>
                  </details>
                )}
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
