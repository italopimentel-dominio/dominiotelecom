'use client';
import { useState } from 'react';
import { obterLinkGeral, trocarLinkGeral } from '@/app/actions/formularios';
import { TIPOS_TREINAMENTO } from '@/lib/indireto';

// Links gerais dos 3 formulários: copiar, compartilhar no WhatsApp e (gerente) trocar
export default function LinksGerais({ links = {}, gerente }) {
  const [tokens, setTokens] = useState(links);
  const [msg, setMsg] = useState('');
  const url = (t) => `${window.location.origin}/f/g/${t}`;
  const whats = (tipo, t) => `https://wa.me/?text=${encodeURIComponent(`Para concluir o treinamento de ${TIPOS_TREINAMENTO[tipo]}, responda este formulário (pede seu CPF ou CNPJ): ${url(t)}`)}`;

  async function pegar(tipo) {
    const r = tokens[tipo] ? { token: tokens[tipo] } : await obterLinkGeral(tipo);
    if (r.erro) { setMsg(r.erro); return null; }
    setTokens((x) => ({ ...x, [tipo]: r.token }));
    return r.token;
  }
  async function copiar(tipo) {
    const t = await pegar(tipo);
    if (!t) return;
    try { await navigator.clipboard.writeText(url(t)); setMsg(`Link geral de ${TIPOS_TREINAMENTO[tipo]} copiado.`); } catch { setMsg(url(t)); }
  }
  async function enviar(tipo) {
    const t = await pegar(tipo);
    if (t) window.open(whats(tipo, t), '_blank', 'noopener');
  }
  async function trocar(tipo) {
    if (!window.confirm(`Trocar o link geral de ${TIPOS_TREINAMENTO[tipo]}? O link antigo para de funcionar.`)) return;
    const r = await trocarLinkGeral(tipo);
    if (r.erro) return setMsg(r.erro);
    setTokens((x) => ({ ...x, [tipo]: r.token }));
    setMsg(`Link geral de ${TIPOS_TREINAMENTO[tipo]} trocado. Mande o novo.`);
  }

  return (
    <details className="bloco secao recolhivel">
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>🔗 Links gerais dos formulários</summary>
      <p className="dica" style={{ margin: '8px 0 10px' }}>
        Um link por formulário, igual para todos (bom para turmas e grupos). Quem responde informa nome e CPF/CNPJ e o sistema acha o parceiro.
        Se o documento não estiver cadastrado, a resposta aparece em "Respostas sem parceiro" para vincular.
        Para mandar a um parceiro só, prefira o link individual na linha dele.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.entries(TIPOS_TREINAMENTO).map(([tipo, rot]) => (
          <div key={tipo} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <span style={{ minWidth: 100, fontWeight: 600 }}>{rot}</span>
            <button type="button" className="btn btn-sec btn-peq" onClick={() => copiar(tipo)}>Copiar link</button>
            <button type="button" className="btn btn-peq" onClick={() => enviar(tipo)}>Compartilhar no WhatsApp</button>
            {gerente && tokens[tipo] && <button type="button" className="btn btn-sec btn-peq" onClick={() => trocar(tipo)}>Trocar link</button>}
          </div>
        ))}
      </div>
      {msg && <p className="dica" style={{ marginTop: 8 }}>{msg}</p>}
    </details>
  );
}
