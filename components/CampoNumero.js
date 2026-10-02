'use client';
import { useEffect, useState, useTransition } from 'react';

// Campo editável que salva sozinho ao sair do campo (ou ao apertar Enter).
export default function CampoNumero({ acao, valor, placeholder = '', rotulo, largo = false }) {
  const inicial = valor === null || valor === undefined ? '' : String(valor).replace('.', ',');
  const [texto, setTexto] = useState(inicial);
  const [estado, setEstado] = useState(null);
  const [pendente, iniciar] = useTransition();
  useEffect(() => { setTexto(inicial); }, [inicial]);

  function salvar() {
    if (texto.trim() === inicial) return;
    iniciar(async () => {
      const r = await acao(texto.trim() === '' ? null : texto.trim());
      setEstado(r?.erro ? { tipo: 'erro', msg: r.erro } : { tipo: 'ok' });
      if (r?.erro) setTexto(inicial);
      setTimeout(() => setEstado(null), r?.erro ? 4000 : 1200);
    });
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={rotulo}
      className={`campo-num${largo ? ' largo' : ''}${pendente ? ' salvando' : ''}${estado ? ` ${estado.tipo}` : ''}`}
      value={texto}
      placeholder={placeholder}
      title={estado?.msg || ''}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={salvar}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setTexto(inicial); e.currentTarget.blur(); } }}
    />
  );
}
