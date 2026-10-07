import { fmtPct } from './dados';

// % real contra o esperado: barra (o tracinho marca o esperado) + situação
export default function Comparativo({ pct, esperada, andamento }) {
  if (pct == null) return <span className="fraco">—</span>;
  const escala = Math.max(pct, esperada ?? 0, 0.0001) * 1.25;
  const atingiu = esperada != null && pct >= esperada;
  const cor = esperada == null ? 'var(--acento)' : atingiu ? 'var(--ok)' : andamento ? 'var(--atencao)' : 'var(--risco)';
  const situacao = esperada == null ? null
    : atingiu ? { t: 'Acima do esperado', c: 'tag-ok' }
    : andamento ? { t: 'Em andamento', c: 'tag-atencao' }
    : { t: 'Abaixo do esperado', c: 'tag-risco' };
  return (
    <div className="comparativo">
      <div className="comparativo-linha">
        <div className="comparativo-trilho">
          <span style={{ width: `${(pct / escala) * 100}%`, background: cor }} />
          {esperada != null && <i style={{ left: `${(esperada / escala) * 100}%` }} title={`Esperado: ${fmtPct(esperada)}`} />}
        </div>
        <b>{fmtPct(pct)}</b>
      </div>
      <span className="nome-sub">
        {esperada != null ? <>esperado {fmtPct(esperada)} · </> : 'sem % esperado'}
        {situacao && <span className={`tag ${situacao.c}`}>{situacao.t}</span>}
      </span>
    </div>
  );
}
