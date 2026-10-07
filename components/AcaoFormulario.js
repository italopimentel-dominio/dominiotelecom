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
  if (!token) return podeEditar ? <button type="button" className="link-acao" onClick={gerar}>Gerar link</button> : null;
  return (
    <span className="acoes-form">
      <span className="tag tag-atencao">Link enviado</span>
      <button type="button" className="link-acao" onClick={copiar}>copiar</button>
      <a className="link-acao" href={whats(token)} target="_blank" rel="noreferrer">WhatsApp</a>
      {aviso && <span className="nome-sub">{aviso}</span>}
    </span>
  );
}
