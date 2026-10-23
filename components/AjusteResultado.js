'use client';
// Célula de item automático na tabela "Lançar resultados": mostra o valor e abre o ajuste manual
// (pedidos que a planilha não trouxe), com os NEOs e o motivo obrigatórios.
import { useRef, useState, useTransition } from 'react';

const fmt = (v, unidade) => (unidade === 'brl'
  ? Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  : Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
const sinal = (v, unidade) => `${Number(v) > 0 ? '+' : ''}${fmt(v, unidade)}`;
const quando = (d) => new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function AjusteResultado({ rotulo, auto, ajustes = [], unidade, editar, fechada, salvar, excluir }) {
  const dlg = useRef(null);
  const [neos, setNeos] = useState('');
  const [qtd, setQtd] = useState('');
  const [motivo, setMotivo] = useState('');
  const [msg, setMsg] = useState(null);
  const [pendente, iniciar] = useTransition();
  const somaAjustes = ajustes.reduce((s, a) => s + (Number(a.qtd) || 0), 0);
  const total = (Number(auto) || 0) + somaAjustes;
  const qtdNeos = [...new Set(neos.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean))].length;

  const abrir = () => { setMsg(null); dlg.current?.showModal(); };
  const gravar = () => iniciar(async () => {
    const r = await salvar({ neos, qtd, motivo });
    if (r?.erro) setMsg({ erro: r.erro });
    else { setMsg({ ok: r?.ok }); setNeos(''); setQtd(''); setMotivo(''); }
  });
  const apagar = (id) => iniciar(async () => {
    if (!window.confirm('Apagar este ajuste?')) return;
    const r = await excluir(id);
    setMsg(r?.erro ? { erro: r.erro } : { ok: r?.ok });
  });

  return (
    <>
      <span style={{ fontWeight: 600 }}>{fmt(total, unidade)}</span>
      {somaAjustes !== 0 && <span className="tag" title="Inclui ajuste manual" style={{ marginLeft: 6 }}>✎ {sinal(somaAjustes, unidade)}</span>}
      {(editar || ajustes.length > 0) && (
        <button type="button" className="lt-apagar" style={{ marginLeft: 6 }} onClick={abrir} title="Ajuste manual">{editar ? '± ajustar' : 'ver ajuste'}</button>
      )}

      <dialog ref={dlg} style={{ border: 0, borderRadius: 14, padding: 0, width: 'min(520px, 94vw)', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ margin: 0 }}>Ajuste manual</h3>
              <p className="dica" style={{ margin: '2px 0 0' }}>{rotulo}</p>
            </div>
            <button type="button" className="lt-apagar" onClick={() => dlg.current?.close()} aria-label="Fechar">✕</button>
          </div>

          <div className="bloco" style={{ marginTop: 12, padding: '8px 12px' }}>
            ⚡ Planilhas: <strong>{fmt(auto, unidade)}</strong>
            {' · '}✎ Ajustes: <strong>{sinal(somaAjustes, unidade)}</strong>
            {' · '}Total: <strong>{fmt(total, unidade)}</strong>
          </div>

          {ajustes.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ajustes.map((a) => (
                <li key={a.id} className="bloco" style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong>{sinal(a.qtd, unidade)}</strong>
                    <span className="dica" style={{ margin: 0 }}>{quando(a.criado_em)}</span>
                  </div>
                  <p className="dica" style={{ margin: '2px 0 0' }}>NEO: {(a.neos || []).join(', ')}</p>
                  <p style={{ margin: '2px 0 0', whiteSpace: 'pre-wrap' }}>{a.motivo}</p>
                  {editar && <button type="button" className="lt-apagar" disabled={pendente} onClick={() => apagar(a.id)}>apagar</button>}
                </li>
              ))}
            </ul>
          )}

          {editar && (
            <div style={{ marginTop: 14 }}>
              <label className="campo">Números NEO dos pedidos
                <textarea rows={3} value={neos} onChange={(e) => setNeos(e.target.value)} placeholder="Um por linha ou separados por vírgula" />
              </label>
              <div className="campos" style={{ marginTop: 8, alignItems: 'flex-end' }}>
                <label className="campo" style={{ margin: 0 }}>{unidade === 'brl' ? 'Valor (R$)' : 'Quantidade'}
                  <input type="text" inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value)} placeholder={qtdNeos ? String(qtdNeos) : '0'} style={{ width: 110 }} />
                </label>
                <p className="dica" style={{ margin: 0, flex: 1 }}>Vazio = 1 por NEO informado. Use negativo para tirar.</p>
              </div>
              <label className="campo" style={{ marginTop: 8 }}>Motivo
                <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ex.: pedidos não lançados na planilha pela operação" />
              </label>
              {fechada && <p className="dica" style={{ marginTop: 8 }}>🔒 A campanha está fechada: o ajuste entra no resultado congelado e fica registrado com data e hora.</p>}
            </div>
          )}

          {msg?.erro && <p className="dica" style={{ marginTop: 10, color: 'var(--perigo, #c0392b)' }}>{msg.erro}</p>}
          {msg?.ok && <p className="dica" style={{ marginTop: 10 }}>✔ {msg.ok}</p>}

          <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-sec" onClick={() => dlg.current?.close()}>Fechar</button>
            {editar && <button type="button" className="btn" disabled={pendente || !qtdNeos || !motivo.trim()} onClick={gravar}>{pendente ? 'Salvando…' : 'Registrar ajuste'}</button>}
          </div>
        </div>
      </dialog>
    </>
  );
}
