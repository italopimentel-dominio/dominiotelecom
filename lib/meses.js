// Meses no formato 'AAAA-MM' (usado no servidor e no navegador)
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const nomeMes = (m) => `${MESES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;

// Meses de "atras" meses antes até "frente" meses depois de 'AAAA-MM'
export function mesesAoRedor(ref, atras = 18, frente = 1) {
  const [a, m] = ref.split('-').map(Number);
  const out = [];
  for (let k = -atras; k <= frente; k++) out.push(new Date(Date.UTC(a, m - 1 + k, 1)).toISOString().slice(0, 7));
  return out;
}
