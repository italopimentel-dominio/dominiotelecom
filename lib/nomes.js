// Comparação de nomes vindos de planilhas: ignora acentos, maiúsculas, pontuação e espaços extras.
export function normalizar(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const singular = (t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t);
const tokens = (s) => normalizar(s).split(' ').filter(Boolean).map(singular);

function bigramas(s) {
  const t = ` ${s} `;
  const m = new Map();
  for (let i = 0; i < t.length - 1; i++) {
    const b = t.slice(i, i + 2);
    m.set(b, (m.get(b) || 0) + 1);
  }
  return m;
}

// 0 a 1. Considera parecido quem tem as mesmas palavras (em qualquer ordem) ou grafia próxima.
export function similaridade(a, b) {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  const na = ta.join(' '), nb = tb.join(' ');
  if (na === nb) return 1;
  const [menor, maior] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const contidos = menor.filter((t) => maior.some((x) => x === t || (t.length <= 2 && x.startsWith(t)))).length;
  const porPalavra = contidos / menor.length;
  const ba = bigramas(na), bb = bigramas(nb);
  let inter = 0, tot = 0;
  ba.forEach((v, k) => { inter += Math.min(v, bb.get(k) || 0); tot += v; });
  bb.forEach((v) => { tot += v; });
  const dice = (2 * inter) / tot;
  return Math.max(dice, menor.length >= 2 ? porPalavra * 0.95 : porPalavra * 0.8);
}
