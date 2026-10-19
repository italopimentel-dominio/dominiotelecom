'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { criarTreinamento } from '@/app/actions/indireto';
import { TIPOS_TREINAMENTO } from '@/lib/indireto';

// O próprio selo "Pendente" vira botão: clica, escolhe a data e registra o treinamento como realizado.
export default function RegistrarTreinoRapido({ parceiroId, tipo, rotulo = 'Pendente', classe = 'tag-risco', hoje, podeEditar }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState(hoje);
  const [estado, setEstado] = useState({ salvando: false, erro: '' });

  if (!podeEditar) return <span className={`tag ${classe}`}>{rotulo}</span>;
  if (!aberto) {
    return (
      <button type="button" className={`tag ${classe} tag-botao`} onClick={() => setAberto(true)}
        title={`Registrar treinamento de ${TIPOS_TREINAMENTO[tipo].toLowerCase()}`}>
        {rotulo} <span aria-hidden="true">＋</span>
      </button>
    );
  }
  async function salvar() {
    setEstado({ salvando: true, erro: '' });
    const fd = new FormData();
    fd.set('parceiro_id', parceiroId); fd.set('tipo', tipo); fd.set('data', data); fd.set('status', 'realizado');
    const r = await criarTreinamento(null, fd);
    if (r?.erro) return setEstado({ salvando: false, erro: r.erro });
    setEstado({ salvando: false, erro: '' });
    setAberto(false);
    router.refresh();
  }
  return (
    <span className="registro-rapido">
      <input type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value)} aria-label="Data do treinamento" />
      <button type="button" className="btn btn-peq" disabled={estado.salvando || !data} onClick={salvar}>{estado.salvando ? '…' : 'Registrar'}</button>
      <button type="button" className="link-acao" onClick={() => setAberto(false)} aria-label="Cancelar">cancelar</button>
      {estado.erro && <span className="nome-sub" style={{ color: 'var(--risco)' }}>{estado.erro}</span>}
    </span>
  );
}
