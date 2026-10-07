'use client';
import { useState } from 'react';
import { hms } from '@/lib/tempoFalado';

const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const CABECALHO = ['Mês', 'Consultor', 'Falando', 'TMA', 'Dias trabalhados', 'Média Falando'];

// Copiar (para colar direto no relatório oficial) e baixar Excel, sempre com as 6 colunas do relatório
export default function BaixarTempoFalado({ mes, linhas }) {
  const [aviso, setAviso] = useState('');
  const rotMes = `${MESES[Number(mes.slice(5)) - 1]}_${mes.slice(0, 4)}`;
  const linhasRelatorio = linhas.map((l) => [rotMes, l.nome, hms(l.falando), hms(l.tma), l.dias, hms(l.media)]);

  async function copiar(comCabecalho) {
    const dados = comCabecalho ? [CABECALHO, ...linhasRelatorio] : linhasRelatorio;
    // texto separado por TAB: o Google Sheets/Excel cola cada valor na sua coluna
    const tsv = dados.map((l) => l.join('\t')).join('\n');
    const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const html = `<table>${dados.map((l) => `<tr>${l.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</table>`;
    try {
      if (window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/plain': new Blob([tsv], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' }),
        })]);
      } else await navigator.clipboard.writeText(tsv);
      setAviso(`${linhasRelatorio.length} linhas copiadas${comCabecalho ? ' com cabeçalho' : ''}. Clique na primeira célula do relatório e cole (Ctrl+V).`);
    } catch {
      setAviso('Não consegui copiar. Use o botão "Baixar Excel".');
    }
    setTimeout(() => setAviso(''), 8000);
  }

  async function baixar() {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([CABECALHO, ...linhasRelatorio]), 'Discadores');
    const detalhe = [['Consultor', 'Equipe', 'Empresa', 'LeadsBuilder', 'TMA LeadsBuilder', '3C (speaking+MTPA+manual)', '3C speaking', '3C MTPA', '3C manual', 'Ligações', 'Falando', 'TMA', 'Dias', 'Média/dia', 'Nomes nos relatórios', 'Alertas'],
      ...linhas.map((l) => [l.nome, l.equipe || '', l.empresa || '', hms(l.lb_seg), hms(l.lb_tma), hms(l.c3_seg), hms(l.c3_speaking), hms(l.c3_mtpa), hms(l.c3_manual), l.ligacoes, hms(l.falando), hms(l.tma), l.dias, hms(l.media), (l.nomes_origem || []).join(' / '), (l.alertas || []).join('; ')])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detalhe), 'Detalhe');
    XLSX.writeFile(wb, `tempo_falado_${rotMes}.xlsx`);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={() => copiar(false)} disabled={!linhas.length}>Copiar para o relatório</button>
        <button type="button" className="btn btn-sec" onClick={() => copiar(true)} disabled={!linhas.length}>Copiar com cabeçalho</button>
        <button type="button" className="btn btn-sec" onClick={baixar} disabled={!linhas.length}>Baixar Excel</button>
      </div>
      {aviso && <span className="dica">{aviso}</span>}
    </div>
  );
}
