'use client';
import { hms } from '@/lib/tempoFalado';

const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// Baixa o Excel no formato da planilha "Discadores" + aba de detalhe
export default function BaixarTempoFalado({ mes, linhas }) {
  async function baixar() {
    const XLSX = await import('xlsx');
    const rotMes = `${MESES[Number(mes.slice(5)) - 1]}_${mes.slice(0, 4)}`;
    const wb = XLSX.utils.book_new();
    const principal = [['Mês', 'Consultor', 'Equipe', 'Falando', 'TMA', 'Dias trabalhados', 'Média Falando'],
      ...linhas.map((l) => [rotMes, l.nome, l.equipe || '', hms(l.falando), hms(l.tma), l.dias, hms(l.media)])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(principal), 'Discadores');
    const detalhe = [['Consultor', 'Empresa', 'LeadsBuilder', 'TMA LeadsBuilder', '3C (speaking+MTPA+manual)', '3C speaking', '3C MTPA', '3C manual', 'Ligações', 'Falando', 'TMA', 'Dias', 'Média/dia', 'Nomes nos relatórios', 'Alertas'],
      ...linhas.map((l) => [l.nome, l.empresa || '', hms(l.lb_seg), hms(l.lb_tma), hms(l.c3_seg), hms(l.c3_speaking), hms(l.c3_mtpa), hms(l.c3_manual), l.ligacoes, hms(l.falando), hms(l.tma), l.dias, hms(l.media), (l.nomes_origem || []).join(' / '), (l.alertas || []).join('; ')])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detalhe), 'Detalhe');
    XLSX.writeFile(wb, `tempo_falado_${rotMes}.xlsx`);
  }
  return <button type="button" className="btn btn-sec" onClick={baixar} disabled={!linhas.length}>Baixar Excel</button>;
}
