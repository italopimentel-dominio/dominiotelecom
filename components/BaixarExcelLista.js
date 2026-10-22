'use client';
import { useState } from 'react';

// Botão que baixa uma lista em Excel. colunas: [{ k, t }] (chave do dado e título da coluna)
export default function BaixarExcelLista({ linhas = [], colunas = [], arquivo = 'lista.xlsx', aba = 'Lista', rotulo = 'Baixar Excel' }) {
  const [gerando, setGerando] = useState(false);
  async function baixar() {
    setGerando(true);
    try {
      const XLSX = await import('xlsx');
      const dados = linhas.map((l) => Object.fromEntries(colunas.map((c) => [c.t, l[c.k] ?? ''])));
      const ws = XLSX.utils.json_to_sheet(dados, { header: colunas.map((c) => c.t) });
      ws['!cols'] = colunas.map((c) => ({ wch: Math.max(c.t.length, ...linhas.slice(0, 200).map((l) => String(l[c.k] ?? '').length)) + 2 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, aba.slice(0, 31));
      XLSX.writeFile(wb, arquivo);
    } finally { setGerando(false); }
  }
  return (
    <button type="button" className="btn btn-sec btn-peq" onClick={baixar} disabled={gerando || !linhas.length}>
      {gerando ? 'Gerando…' : `⬇ ${rotulo}`}
    </button>
  );
}
