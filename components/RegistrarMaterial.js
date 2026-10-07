'use client';
import { useState } from 'react';
import Link from 'next/link';
import { criarMaterial, adicionarLeadsMaterial, concluirMaterial } from '@/app/actions/materiais';
import { hojeSP } from '@/lib/datas';

const BLOCO = 2000;
const fmtN = (n) => Number(n).toLocaleString('pt-BR');

// Grava um material e seus leads (em blocos). Sem materialId cria um novo; com materialId só adiciona leads.
// leads: [{ cnpj, destinatario }] já validados e sem repetidos.
export default function RegistrarMaterial({ leads, grupos = [], origem = 'planilha', materialId = null, nomePadrao = '', aoTerminar }) {
  const [form, setForm] = useState({ nome: nomePadrao, enviado_em: hojeSP(), grupo_id: '', conversao_esperada: '', observacao: '' });
  const [estado, setEstado] = useState({ rodando: false, feitos: 0, erro: '', fim: null });
  const muda = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function gravar() {
    setEstado({ rodando: true, feitos: 0, erro: '', fim: null });
    let id = materialId;
    if (!id) {
      const r = await criarMaterial({ ...form, origem });
      if (r.erro) return setEstado((e) => ({ ...e, rodando: false, erro: r.erro }));
      id = r.id;
    }
    let inseridos = 0;
    for (let i = 0; i < leads.length; i += BLOCO) {
      const r = await adicionarLeadsMaterial(id, leads.slice(i, i + BLOCO));
      if (r.erro) return setEstado((e) => ({ ...e, rodando: false, erro: `${r.erro} (${fmtN(inseridos)} leads já gravados)`, fim: { id, inseridos } }));
      inseridos += r.inseridos;
      setEstado((e) => ({ ...e, feitos: Math.min(i + BLOCO, leads.length) }));
    }
    await concluirMaterial();
    setEstado({ rodando: false, feitos: leads.length, erro: '', fim: { id, inseridos } });
    aoTerminar?.(id);
  }

  if (estado.fim && !estado.erro) {
    return (
      <p className="msg msg-ok">
        {materialId ? `${fmtN(estado.fim.inseridos)} leads novos adicionados` : `Material registrado com ${fmtN(estado.fim.inseridos)} leads`}
        {estado.fim.inseridos < leads.length ? ` (${fmtN(leads.length - estado.fim.inseridos)} já estavam no material)` : ''}.{' '}
        {!materialId && <Link href={`/materiais/${estado.fim.id}`}>Abrir o material</Link>}
      </p>
    );
  }

  return (
    <div className="bloco" style={{ marginTop: 10 }}>
      {!materialId && (
        <div className="campos">
          <label className="campo" style={{ flex: '2 1 260px' }}>Nome do material<input type="text" value={form.nome} onChange={muda('nome')} required /></label>
          <label className="campo">Data de envio<input type="date" value={form.enviado_em} onChange={muda('enviado_em')} required /></label>
          <label className="campo" style={{ flex: '2 1 240px' }}>Equipe que recebeu
            <select value={form.grupo_id} onChange={muda('grupo_id')} required>
              <option value="">Escolha…</option>
              {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </label>
          <label className="campo">% de fechamento esperado
            <input type="text" inputMode="decimal" value={form.conversao_esperada} onChange={muda('conversao_esperada')} placeholder="ex.: 2,5" style={{ width: 110 }} />
          </label>
          <label className="campo" style={{ flex: '3 1 300px' }}>Observação<input type="text" value={form.observacao} onChange={muda('observacao')} placeholder="Opcional" /></label>
        </div>
      )}
      <div className="campos" style={{ marginTop: 10, alignItems: 'center' }}>
        <button type="button" className="btn" disabled={estado.rodando || !leads.length || (!materialId && (!form.nome || !form.grupo_id))} onClick={gravar}>
          {estado.rodando ? `Gravando… ${fmtN(estado.feitos)} de ${fmtN(leads.length)}` : materialId ? `Adicionar ${fmtN(leads.length)} leads` : `Registrar material com ${fmtN(leads.length)} leads`}
        </button>
      </div>
      {estado.erro && <p className="msg msg-erro" role="alert">{estado.erro}</p>}
    </div>
  );
}
