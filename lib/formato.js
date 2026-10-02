export function numero(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v).trim().replace(/[R$\s]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return isFinite(n) ? n : null;
}

export function fmtValor(v, unidade, casas) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  if (unidade === 'brl') {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: casas ?? 0 });
  }
  return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: casas ?? 0 });
}

export function fmtPct(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

export function fmtData(iso, comAno = false) {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return comAno ? `${d}/${m}/${a}` : `${d}/${m}`;
}

export const STATUS = {
  batida: 'Meta batida',
  'em-dia': 'No ritmo',
  atencao: 'Atenção',
  risco: 'Abaixo do ritmo',
  inicio: 'Ainda não começou',
  'sem-meta': 'Sem meta',
};

export const fmtFator = (f) => `+${Math.round((Number(f) - 1) * 100)}%`;
