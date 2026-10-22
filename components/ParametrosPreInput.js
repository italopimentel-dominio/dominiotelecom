'use client';
import { useState } from 'react';
import { salvarParametrosPreInput } from '@/app/actions/preInput';

// Edição dos parâmetros do Pré-Input: expediente, SLA (horas úteis) por grupo de produto e filas.
export default function ParametrosPreInput({ config, sla, filas, grupos, filasNovas = [], podeEditar }) {
  const [cfg, setCfg] = useState({ inicio: String(config.inicio).slice(0, 5), fim: String(config.fim).slice(0, 5), sla_padrao: config.sla_padrao });
  const [listaSla, setListaSla] = useState(sla);
  const [listaFilas, setListaFilas] = useState([...filas, ...filasNovas.map((f) => ({ fila: f, tipo: 'destino', grupo: '', nova: true }))]);
  const [estado, setEstado] = useState({ salvando: false, erro: '', ok: '' });
  const muda = () => setEstado({ salvando: false, erro: '', ok: '' });

  async function salvar() {
    setEstado({ salvando: true, erro: '', ok: '' });
    const r = await salvarParametrosPreInput({ config: cfg, sla: listaSla, filas: listaFilas });
    setEstado({ salvando: false, erro: r.erro || '', ok: r.ok || '' });
  }
  const dis = !podeEditar;
  return (
    <div>
      <div className="campos">
        <label className="campo">Início do expediente<input type="time" value={cfg.inicio} disabled={dis} onChange={(e) => { setCfg({ ...cfg, inicio: e.target.value }); muda(); }} /></label>
        <label className="campo">Fim do expediente<input type="time" value={cfg.fim} disabled={dis} onChange={(e) => { setCfg({ ...cfg, fim: e.target.value }); muda(); }} /></label>
        <label className="campo">SLA padrão (h úteis)<input type="number" min="0.5" step="0.5" value={cfg.sla_padrao} disabled={dis} onChange={(e) => { setCfg({ ...cfg, sla_padrao: e.target.value }); muda(); }} /></label>
      </div>
      <p className="dica" style={{ marginTop: 4 }}>Dias úteis: segunda a sexta, menos os feriados cadastrados em Configurações → Feriados.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 12 }}>
        <div>
          <h3 style={{ marginBottom: 4 }}>SLA por grupo de produto</h3>
          <p className="dica" style={{ marginBottom: 6 }}>Tempo ideal, em horas úteis, para o pedido sair do Pré-Input. Pedido com grupos diferentes usa o menor SLA.</p>
          <div className="tabela-wrap tabela-fixa" style={{ maxHeight: 360 }}>
            <table>
              <thead><tr><th className="esq">Grupo (arquivo de produção)</th><th>SLA (h)</th><th /></tr></thead>
              <tbody>
                {listaSla.map((x, i) => (
                  <tr key={i}>
                    <td className="esq"><input type="text" value={x.grupo} disabled={dis} style={{ width: '100%' }} aria-label="Grupo" onChange={(e) => { setListaSla(listaSla.map((y, j) => (j === i ? { ...y, grupo: e.target.value } : y))); muda(); }} /></td>
                    <td><input type="number" min="0.5" step="0.5" value={x.horas} disabled={dis} style={{ width: 70 }} aria-label={`SLA de ${x.grupo}`} onChange={(e) => { setListaSla(listaSla.map((y, j) => (j === i ? { ...y, horas: e.target.value } : y))); muda(); }} /></td>
                    <td>{!dis && <button type="button" className="btn btn-sec btn-peq" aria-label={`Tirar ${x.grupo}`} onClick={() => { setListaSla(listaSla.filter((_, j) => j !== i)); muda(); }}>×</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!dis && <button type="button" className="btn btn-sec btn-peq" style={{ marginTop: 6 }} onClick={() => setListaSla([...listaSla, { grupo: '', horas: cfg.sla_padrao }])}>+ Grupo</button>}
        </div>

        <div>
          <h3 style={{ marginBottom: 4 }}>Filas</h3>
          <p className="dica" style={{ marginBottom: 6 }}>
            <b>Entrada</b> = filas iniciais do Pré-Input (andar entre elas não é evolução). <b>Destino</b> = para onde o pedido evolui, agrupado no grupo de destino.
            {filasNovas.length > 0 && <> <b style={{ color: 'var(--atencao)' }}>{filasNovas.length} filas novas</b> apareceram nas movimentações: escolha o grupo delas.</>}
          </p>
          <datalist id="grupos-preinput">{grupos.map((g) => <option key={g} value={g} />)}</datalist>
          <div className="tabela-wrap tabela-fixa" style={{ maxHeight: 360 }}>
            <table>
              <thead><tr><th className="esq">Fila (após “Movimentado para”)</th><th className="esq">Tipo</th><th className="esq">Grupo</th></tr></thead>
              <tbody>
                {listaFilas.map((x, i) => (
                  <tr key={x.fila} style={x.nova ? { background: 'rgba(230, 160, 40, .1)' } : undefined}>
                    <td className="esq">{x.fila}{x.nova && <span className="nome-sub">nova</span>}</td>
                    <td className="esq">
                      <select value={x.tipo} disabled={dis} aria-label={`Tipo de ${x.fila}`} onChange={(e) => { setListaFilas(listaFilas.map((y, j) => (j === i ? { ...y, tipo: e.target.value } : y))); muda(); }}>
                        <option value="entrada">Entrada</option><option value="destino">Destino</option>
                      </select>
                    </td>
                    <td className="esq"><input type="text" list="grupos-preinput" value={x.grupo || ''} disabled={dis} placeholder="Sem grupo definido" aria-label={`Grupo de ${x.fila}`} onChange={(e) => { setListaFilas(listaFilas.map((y, j) => (j === i ? { ...y, grupo: e.target.value } : y))); muda(); }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {estado.erro && <p className="msg msg-erro" role="alert">{estado.erro}</p>}
      {estado.ok && <p className="msg msg-ok">{estado.ok}</p>}
      {!dis && <button type="button" className="btn" style={{ marginTop: 10 }} disabled={estado.salvando} onClick={salvar}>{estado.salvando ? 'Salvando…' : 'Salvar parâmetros'}</button>}
      {dis && <p className="dica" style={{ marginTop: 8 }}>Só quem edita o sistema pode alterar os parâmetros.</p>}
    </div>
  );
}
