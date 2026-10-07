'use client';
import { useState } from 'react';
import { gerarLinkForm, cancelarLinkForm } from '@/app/actions/formularios';
import { TIPOS_TREINAMENTO } from '@/lib/indireto';

// Gera o link do formulário do parceiro, copia e abre o WhatsApp com a mensagem pronta.
export default function LinksFormulario({ parceiroId, nome, telefone, links = [], podeEditar }) {
  const [abertos, setAbertos] = useState(() => Object.fromEntries(links.map((l) => [l.tipo, l.token])));
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState('');
  const url = (token) => `${window.location.origin}/f/${token}`;
  const fone = String(telefone || '').replace(/\D/g, '');
  const whats = (tipo, token) => {
    const texto = `Olá, ${String(nome || '').split(' ')[0]}! Para concluir o treinamento de ${TIPOS_TREINAMENTO[tipo]}, responda este formulário rapidinho: ${url(token)}`;
    return `https://wa.me/${fone.length >= 10 ? (fone.length <= 11 ? `55${fone}` : fone) : ''}?text=${encodeURIComponent(texto)}`;
  };

  async function gerar(tipo) {
    setOcupado(tipo); setMsg('');
    const r = await gerarLinkForm(parceiroId, tipo);
    setOcupado('');
    if (r.erro) return setMsg(r.erro);
    setAbertos((a) => ({ ...a, [tipo]: r.token }));
    try { await navigator.clipboard.writeText(url(r.token)); setMsg('Link copiado.'); } catch { setMsg('Link gerado.'); }
  }
  async function copiar(token) {
    try { await navigator.clipboard.writeText(url(token)); setMsg('Link copiado.'); } catch { setMsg(url(token)); }
  }
  async function cancelar(tipo) {
    const r = await cancelarLinkForm(abertos[tipo], parceiroId);
    if (r.erro) return setMsg(r.erro);
    setAbertos((a) => { const n = { ...a }; delete n[tipo]; return n; });
    setMsg('Link cancelado.');
  }

  return (
    <div className="bloco" style={{ marginBottom: 12 }}>
      <b>Enviar formulário por link</b>
      <p className="dica" style={{ margin: '4px 0 10px' }}>
        O parceiro responde pelo celular, sem login. Ao enviar, o treinamento fica realizado. O cadastro é validado sozinho quando todo treinamento realizado tem formulário e o parceiro tem venda vinculada. O link vale 30 dias e uma resposta.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.entries(TIPOS_TREINAMENTO).map(([tipo, rot]) => (
          <div key={tipo} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <span style={{ minWidth: 100, fontWeight: 600 }}>{rot}</span>
            {abertos[tipo] ? (
              <>
                <button type="button" className="btn btn-sec btn-peq" onClick={() => copiar(abertos[tipo])}>Copiar link</button>
                <a className="btn btn-peq" href={whats(tipo, abertos[tipo])} target="_blank" rel="noreferrer">Enviar no WhatsApp</a>
                {podeEditar && <button type="button" className="btn btn-sec btn-peq" onClick={() => cancelar(tipo)}>Cancelar link</button>}
                <span className="nome-sub">aguardando resposta</span>
              </>
            ) : podeEditar ? (
              <button type="button" className="btn btn-sec btn-peq" disabled={ocupado === tipo} onClick={() => gerar(tipo)}>{ocupado === tipo ? 'Gerando…' : 'Gerar link'}</button>
            ) : <span className="fraco">—</span>}
          </div>
        ))}
      </div>
      {msg && <p className="dica" style={{ marginTop: 8 }}>{msg}</p>}
    </div>
  );
}
