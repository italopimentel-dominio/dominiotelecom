import { fmtPct, STATUS } from '@/lib/formato';

// Barra de realizado com um marcador de onde a equipe deveria estar hoje.
export default function BarraRitmo({ pct, esperado, status, compacta = false }) {
  const largura = Math.min(Math.max(pct ?? 0, 0), 1) * 100;
  const marca = Math.min(Math.max(esperado ?? 0, 0), 1) * 100;
  return (
    <div className={`ritmo ritmo-${status}${compacta ? ' compacta' : ''}`} title={`${STATUS[status]}: realizado ${fmtPct(pct)}, esperado até hoje ${fmtPct(esperado)}`}>
      <div className="ritmo-trilho">
        <div className="ritmo-cheio" style={{ width: `${largura}%` }} />
        {status !== 'sem-meta' && <div className="ritmo-marca" style={{ left: `${marca}%` }} />}
      </div>
      <span className="ritmo-pct">{fmtPct(pct)}</span>
    </div>
  );
}
