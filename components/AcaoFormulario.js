'use client';
import { useState } from 'react';
import { gerarLinkForm } from '@/app/actions/formularios';
import { TIPOS_TREINAMENTO } from '@/lib/indireto';

// Ação curta numa célula da tabela de treinamentos: gerar link / copiar / WhatsApp
export default function AcaoFormulario({ parceiroId, tipo, nome, telefone, token: inicial, podeEditar }) {
  const [token, setToken] = useState(inicial || null);
  const [aviso, setAviso] = useState('');
  const url = (t) => `${window.location.origin}/f/${t}`;
  const fone = String(telefone || '').replace(/\D/g, '');
  const whats = (t) => {
    const texto = `Olá, ${String(nome || '').split(' ')[0]}! Para concluir o treinamento de ${TIPOS_TREINAMENTO[tipo]}, responda este formulário rapidinho: ${url(t)}`;
    return `https://wa.me/${fone.length >= 10 ? (fone.length <= 11 ? `55${fone}` : fone) : ''}?text=${encodeURIComponent(texto)}`;
  };
  async function gerar() {
    const r = await gerarLinkForm(parceiroId, tipo);
    if (r.erro) return setAviso(r.erro);
    setToken(r.token);
    try { await navigator.clipboard.writeText(url(r.token)); setAviso('copiado'); } catch { setAviso(''); }
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(url(token)); setAviso('copiado'); } catch { setAviso(url(token)); }
  }
  if (!token) return podeEditar ? <span className="acoes-linha"><button type="button" className="link-acao" onClick={gerar}>Gerar link do formulário</button></span> : null;
  return (
    <span className="acoes-linha">
      <span className="dica" title="Link do formulário enviado, aguardando resposta">✉ Link enviado</span>
      <span aria-hidden="true" className="sep">·</span>
      <button type="button" className="link-acao" onClick={copiar}>Copiar</button>
      <span aria-hidden="true" className="sep">·</span>
      <a className="link-acao" href={whats(token)} target="_blank" rel="noreferrer">WhatsApp</a>
      {aviso && <span className="dica"> {aviso}</span>}
    </span>
  );
}
