import { tempoDeCasa } from '@/lib/datas';
import { fmtData } from '@/lib/formato';

// Mostra o tempo de casa; quem tem menos de 3 meses ganha a etiqueta "novo".
export default function TempoCasa({ admissao, comData = false }) {
  const t = tempoDeCasa(admissao);
  if (!t) return <span className="fraco">{admissao ? `admissão em ${fmtData(admissao, true)}` : '—'}</span>;
  return (
    <span title={`Admissão em ${fmtData(admissao, true)}`}>
      {t.texto}
      {t.meses < 3 && <span className="tag tag-acento" style={{ marginLeft: 6 }}>novo</span>}
      {comData && <span className="nome-sub">desde {fmtData(admissao, true)}</span>}
    </span>
  );
}
