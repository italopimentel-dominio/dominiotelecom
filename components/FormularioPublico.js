'use client';
import { useState } from 'react';
import { responderFormulario, responderFormularioGeral } from '@/app/actions/formularios';

// geral = link único para todos: pede nome e CPF/CNPJ antes das perguntas
export default function FormularioPublico({ token, perguntas, geral = false }) {
  const [ident, setIdent] = useState({ nome: '', documento: '' });
  const [resp, setResp] = useState({});
  const [estado, setEstado] = useState({ enviando: false, erro: '', ok: false });
  const muda = (id, v) => setResp((r) => ({ ...r, [id]: v }));

  async function enviar(e) {
    e.preventDefault();
    setEstado({ enviando: true, erro: '', ok: false });
    const r = geral ? await responderFormularioGeral(token, ident.documento, ident.nome, resp) : await responderFormulario(token, resp);
    setEstado({ enviando: false, erro: r.erro || '', ok: !!r.ok });
  }

  if (estado.ok) return <div style={{ marginTop: 18 }}><h2>Respostas enviadas ✓</h2><p className="dica">Obrigado! Pode fechar esta página.</p></div>;

  return (
    <form onSubmit={enviar} className="form-publico">
      {geral && (
        <fieldset className="pergunta">
          <legend>Seus dados<span className="obrig"> *</span></legend>
          <label className="campo">Nome completo<input type="text" value={ident.nome} onChange={(e) => setIdent((x) => ({ ...x, nome: e.target.value }))} required autoComplete="name" /></label>
          <label className="campo" style={{ marginTop: 8 }}>CPF ou CNPJ<input type="text" inputMode="numeric" value={ident.documento} onChange={(e) => setIdent((x) => ({ ...x, documento: e.target.value }))} required placeholder="Só números ou com pontuação" /></label>
        </fieldset>
      )}
      {!perguntas.length && <p className="dica">Basta confirmar abaixo que você participou do treinamento.</p>}
      {perguntas.map((p, i) => (
        <fieldset key={p.id} className="pergunta">
          <legend>{i + 1}. {p.texto}{p.obrigatoria && <span className="obrig"> *</span>}</legend>
          {p.tipo_resposta === 'texto' && (
            <textarea rows={3} value={resp[p.id] || ''} onChange={(e) => muda(p.id, e.target.value)} required={p.obrigatoria} />
          )}
          {(p.tipo_resposta === 'escolha' || p.tipo_resposta === 'sim_nao') && (
            <div className="opcoes">
              {(p.tipo_resposta === 'sim_nao' ? ['Sim', 'Não'] : p.opcoes || []).map((o) => (
                <label key={o} className="check">
                  <input type="radio" name={p.id} value={o} checked={resp[p.id] === o} onChange={() => muda(p.id, o)} required={p.obrigatoria} /> {o}
                </label>
              ))}
            </div>
          )}
          {p.tipo_resposta === 'nota' && (
            <div className="opcoes notas">
              {Array.from({ length: 11 }, (_, n) => String(n)).map((n) => (
                <label key={n} className={`nota${resp[p.id] === n ? ' ativa' : ''}`}>
                  <input type="radio" name={p.id} value={n} checked={resp[p.id] === n} onChange={() => muda(p.id, n)} required={p.obrigatoria} />{n}
                </label>
              ))}
            </div>
          )}
        </fieldset>
      ))}
      {estado.erro && <p className="msg msg-erro" role="alert">{estado.erro}</p>}
      <button className="btn" type="submit" disabled={estado.enviando} style={{ width: '100%', marginTop: 8 }}>
        {estado.enviando ? 'Enviando…' : perguntas.length ? 'Enviar respostas' : 'Confirmar participação'}
      </button>
    </form>
  );
}
