// Datas sempre como texto 'AAAA-MM-DD' e contas em UTC, para não sofrer com fuso horário.
const DIA = 86400000;

export function paraMs(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
}
export function paraIso(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}
export function somarDias(iso, n) {
  return paraIso(paraMs(iso) + n * DIA);
}
export function diaDaSemana(iso) {
  return new Date(paraMs(iso)).getUTCDay(); // 0 = domingo
}
export function inicioDaSemana(iso) {
  const d = diaDaSemana(iso);
  return somarDias(iso, d === 0 ? -6 : 1 - d); // segunda-feira
}
export function hojeSP() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}
export function ultimoDiaDoMes(iso) {
  const [a, m] = iso.split('-').map(Number);
  return paraIso(Date.UTC(a, m, 0));
}
export function intervalo(inicio, fim) {
  const lista = [];
  for (let ms = paraMs(inicio), f = paraMs(fim); ms <= f; ms += DIA) lista.push(paraIso(ms));
  return lista;
}
