'use client';
import { useState } from 'react';
import { dadosExportacaoMes } from '@/app/actions/exportar';

// Excel do mês: uma linha por colaborador; para cada produto, Qtd, Meta e % atingido
export default function BaixarExcelMes({ periodoId }) {
  const [estado, setEstado] = useState({ gerando: false, erro: '' });

  async function baixar() {
    setEstado({ gerando: true, erro: '' });
    const r = await dadosExportacaoMes(periodoId);
    if (r.erro) return setEstado({ gerando: false, erro: r.erro });
    const XLSX = await import('xlsx');
    const cab1 = ['Colaborador', 'Equipe', 'Canal', ...r.colunas.flatMap((p) => [p.nome, '', ''])];
    const cab2 = ['', '', '', ...r.colunas.flatMap(() => ['Qtd', 'Meta', '% atingido'])];
    const corpo = r.linhas.map((l) => [l.colaborador, l.equipe, l.canal, ...r.colunas.flatMap((p) => {
      const v = l.valores[p.id];
      return v ? [v.qtd ?? 0, v.meta || null, v.pct ?? null] : [null, null, null];
    })]);
    const ws = XLSX.utils.aoa_to_sheet([cab1, cab2, ...corpo]);
    // nome do produto ocupando as 3 colunas dele
    ws['!merges'] = r.colunas.map((_, i) => ({ s: { r: 0, c: 3 + i * 3 }, e: { r: 0, c: 5 + i * 3 } }));
    // % com formato de porcentagem
    corpo.forEach((_, li) => r.colunas.forEach((__, i) => {
      const cel = ws[XLSX.utils.encode_cell({ r: li + 2, c: 5 + i * 3 })];
      if (cel && typeof cel.v === 'number') cel.z = '0.0%';
    }));
    ws['!cols'] = [{ wch: 36 }, { wch: 34 }, { wch: 14 }, ...r.colunas.flatMap(() => [{ wch: 8 }, { wch: 8 }, { wch: 11 }])];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Por colaborador');
    XLSX.writeFile(wb, `vendas_${r.periodo.replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_')}.xlsx`);
    setEstado({ gerando: false, erro: '' });
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <button type="button" className="btn btn-sec" onClick={baixar} disabled={estado.gerando}>{estado.gerando ? 'Gerando…' : 'Baixar Excel do mês'}</button>
      {estado.erro && <span className="dica" style={{ color: 'var(--risco)' }}>{estado.erro}</span>}
    </span>
  );
}
