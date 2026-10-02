import { paraIso, somarDias } from './datas';

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher)
function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return paraIso(Date.UTC(ano, mes - 1, dia));
}

const FIXOS = [
  ['01-01', 'Confraternização Universal'],
  ['04-21', 'Tiradentes'],
  ['05-01', 'Dia do Trabalho'],
  ['09-07', 'Independência do Brasil'],
  ['10-12', 'Nossa Senhora Aparecida'],
  ['11-02', 'Finados'],
  ['11-15', 'Proclamação da República'],
  ['11-20', 'Dia Nacional de Zumbi e da Consciência Negra'],
  ['12-25', 'Natal'],
];

// Lista os feriados nacionais do ano. "opcional" marca os pontos facultativos
// que podem ser ligados/desligados na tela de Feriados.
export function feriadosNacionais(ano) {
  const p = pascoa(ano);
  const lista = FIXOS.map(([md, nome]) => ({ data: `${ano}-${md}`, nome, opcional: null }));
  lista.push({ data: somarDias(p, -48), nome: 'Carnaval (segunda)', opcional: 'carnaval' });
  lista.push({ data: somarDias(p, -47), nome: 'Carnaval (terça)', opcional: 'carnaval' });
  lista.push({ data: somarDias(p, -2), nome: 'Sexta-feira Santa', opcional: null });
  lista.push({ data: somarDias(p, 60), nome: 'Corpus Christi', opcional: 'corpus' });
  return lista.sort((a, b) => a.data.localeCompare(b.data));
}
