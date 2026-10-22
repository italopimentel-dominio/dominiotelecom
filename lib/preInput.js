// Pré-Input: regras de cálculo (funções puras; rodam no servidor e no navegador).
// Datas sempre no formato local 'AAAA-MM-DDTHH:MM:SS' (hora de São Paulo, como vem na exportação do CRM).

export const SEM_GRUPO = 'Sem grupo definido';
export const chaveFila = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

// "21/10/2026 16:50:38", "2026-10-21 16:50", Date ou número de data do Excel -> '2026-10-21T16:50:38'
export function dataHoraIso(v) {
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 19);
  if (typeof v === 'number' && v > 30000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v * 86400) * 1000).toISOString().slice(0, 19);
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}T${(m[4] || '0').padStart(2, '0')}:${m[5] || '00'}:${m[6] || '00'}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4] || '00'}:${m[5] || '00'}:${m[6] || '00'}`;
  return null;
}

const minDoDia = (hhmm) => { const [h, m] = String(hhmm || '00:00').split(':').map(Number); return h * 60 + (m || 0); };
const paraMs = (iso) => Date.parse(`${iso}Z`);
const proximoDia = (d) => new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

// Expediente por dia da semana: horarios = { '1': ['08:00', '18:00'], …, '5': ['08:00', '17:00'] } (0 = domingo).
// Devolve uma função dia -> [início, fim] ou null (dia sem expediente: fim de semana, feriado ou dia não configurado).
export const HORARIOS_PADRAO = { 1: ['08:00', '18:00'], 2: ['08:00', '18:00'], 3: ['08:00', '18:00'], 4: ['08:00', '18:00'], 5: ['08:00', '17:00'] };
export function expedienteDe(horarios, ehUtil) {
  const h = horarios && Object.keys(horarios).length ? horarios : HORARIOS_PADRAO;
  return (iso) => {
    if (ehUtil && !ehUtil(iso)) return null;
    const e = h[new Date(`${iso}T12:00:00Z`).getUTCDay()];
    return e && e[0] && e[1] && e[0] < e[1] ? [String(e[0]).slice(0, 5), String(e[1]).slice(0, 5)] : null;
  };
}

// Horas úteis entre dois momentos, só dentro do expediente de cada dia
export function horasUteis(ini, fim, exp) {
  if (!ini || !fim || fim <= ini) return 0;
  let total = 0;
  let dia = ini.slice(0, 10);
  const tIni = paraMs(ini), tFim = paraMs(fim);
  for (let n = 0; dia <= fim.slice(0, 10) && n < 800; n++, dia = proximoDia(dia)) {
    const e = exp(dia);
    if (!e) continue;
    const base = Date.parse(`${dia}T00:00:00Z`);
    const de = Math.max(tIni, base + minDoDia(e[0]) * 60000), ate = Math.min(tFim, base + minDoDia(e[1]) * 60000);
    if (ate > de) total += (ate - de) / 3600000;
  }
  return total;
}

// Em que relatório o pedido entra: no dia da entrada, se chegou antes do fim do expediente;
// depois do expediente, em fim de semana ou feriado, no próximo dia útil.
export function diaDoRelatorio(entrada, exp) {
  let d = entrada.slice(0, 10);
  const e = exp(d);
  if (e && entrada.slice(11, 16) < e[1]) return d;
  for (let n = 0; n < 40; n++) { d = proximoDia(d); if (exp(d)) return d; }
  return entrada.slice(0, 10);
}

// Produtos do pedido: o mesmo item vem em dois grupos (o específico e um "Total"/"Totais"). Conta 1 vez, no específico.
export function produtosDoNeo(itens = []) {
  const porItem = new Map();
  itens.forEach((it) => {
    const k = `${it.item || ''}|${it.produto || ''}`;
    const atual = porItem.get(k);
    const ehTotal = /\btota(l|is)\b/i.test(it.grupo);
    if (!atual || (atual.ehTotal && !ehTotal)) porItem.set(k, { ...it, ehTotal });
  });
  return [...porItem.values()].map(({ grupo, produto, qtd }) => ({ grupo, produto, qtd: Number(qtd) || 0 }));
}

// Primeira entrada de cada pedido nas filas de entrada (a que vale; se saiu e voltou, a volta não conta)
export function primeiraEntrada(movs, filas) {
  const r = new Map();
  movs.forEach((m) => {
    if (filas.get(chaveFila(m.fila))?.tipo !== 'entrada') return;
    const a = r.get(m.neo);
    if (!a || m.data_hora < a.data_hora) r.set(m.neo, m);
  });
  return r;
}

// Foto do dia: para cada pedido, a primeira entrada e o que aconteceu até a meia-noite do dia do relatório.
//   evoluiu  = primeira movimentação para uma fila que não é de entrada, até 23:59:59 do dia do relatório
//   tempo    = horas úteis da entrada até a saída; sem saída, até o fim do expediente do dia (o tempo para ali)
// filas: Map(chaveFila -> { tipo, grupo }); movs: todas as movimentações dos pedidos (qualquer ordem)
// agora: para o dia de hoje, o tempo de quem ainda não andou vai só até agora (a base pode ter sido baixada no meio do dia)
export function fotoDoDia(movs, filas, { itensPorNeo, slaPorGrupo, slaPadrao = 6, exp, agora = null }) {
  const porNeo = new Map();
  movs.forEach((m) => { if (!porNeo.has(m.neo)) porNeo.set(m.neo, []); porNeo.get(m.neo).push(m); });
  const lista = [];
  porNeo.forEach((ms, neo) => {
    ms.sort((x, y) => (x.data_hora < y.data_hora ? -1 : x.data_hora > y.data_hora ? 1 : 0));
    const i = ms.findIndex((m) => filas.get(chaveFila(m.fila))?.tipo === 'entrada');
    if (i < 0) return;
    const e = ms[i];
    const f0 = filas.get(chaveFila(e.fila));
    const dia = diaDoRelatorio(e.data_hora, exp);
    const corte = `${dia}T23:59:59`;
    const p = { neo, dia, entrada: e.data_hora, filaEntrada: e.fila, grupoEntrada: f0.grupo || SEM_GRUPO, filaAtual: e.fila, saida: null, foraDoHorario: dia !== e.data_hora.slice(0, 10) };
    for (const m of ms.slice(i + 1)) {
      if (m.data_hora > corte) break;
      const f = filas.get(chaveFila(m.fila));
      if (f?.tipo === 'entrada') { p.filaAtual = m.fila; continue; }
      Object.assign(p, { saida: m.data_hora, filaSaida: m.fila, grupoSaida: f?.grupo || SEM_GRUPO });
      break;
    }
    const produtos = produtosDoNeo(itensPorNeo.get(neo) || []);
    const grupos = [...new Set(produtos.map((x) => x.grupo))];
    const slas = grupos.map((g) => slaPorGrupo.get(chaveFila(g)) ?? slaPadrao);
    const sla = slas.length ? Math.min(...slas) : slaPadrao; // pedido com SLAs diferentes: vale o mais exigente
    let fimDia = `${dia}T${(exp(dia) || ['', '23:59'])[1]}:00`;
    if (agora && agora < fimDia) fimDia = agora;
    const tempo = horasUteis(e.data_hora, p.saida || fimDia, exp);
    lista.push({ ...p, produtos, grupos, sla, semProduto: !produtos.length, tempo,
      evoluiu: !!p.saida, dentroSla: !!p.saida && tempo <= sla, estourado: !p.saida && tempo > sla, noPrazo: !p.saida && tempo <= sla });
  });
  return lista;
}
