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

// Horas úteis entre dois momentos: só o expediente (ex.: 8h–18h) dos dias úteis (ehUtil('AAAA-MM-DD'))
export function horasUteis(ini, fim, ehUtil, expIni = '08:00', expFim = '18:00') {
  if (!ini || !fim || fim <= ini) return 0;
  const a = minDoDia(expIni), b = minDoDia(expFim);
  let total = 0;
  let dia = Date.parse(`${ini.slice(0, 10)}T00:00:00Z`);
  const ultimo = Date.parse(`${fim.slice(0, 10)}T00:00:00Z`);
  const tIni = paraMs(ini), tFim = paraMs(fim);
  for (let n = 0; dia <= ultimo && n < 800; n++, dia += 86400000) {
    const iso = new Date(dia).toISOString().slice(0, 10);
    if (!ehUtil(iso)) continue;
    const de = Math.max(tIni, dia + a * 60000), ate = Math.min(tFim, dia + b * 60000);
    if (ate > de) total += (ate - de) / 3600000;
  }
  return total;
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

// Passagens pelo Pré-Input: começa quando o pedido é movimentado para uma fila de ENTRADA
// e termina na primeira movimentação para uma fila que não é de entrada (= evoluiu).
// Andar entre filas de entrada (ex.: Link Aceito -> Pré-Input Móvel) não é evolução.
// filas: Map(chaveFila -> { tipo, grupo }); movs: [{ neo, data_hora, fila }] (qualquer ordem)
export function passagens(movs, filas) {
  const porNeo = new Map();
  movs.forEach((m) => { if (!porNeo.has(m.neo)) porNeo.set(m.neo, []); porNeo.get(m.neo).push(m); });
  const lista = [];
  porNeo.forEach((ms, neo) => {
    ms.sort((x, y) => (x.data_hora < y.data_hora ? -1 : x.data_hora > y.data_hora ? 1 : 0));
    let p = null;
    ms.forEach((m) => {
      const f = filas.get(chaveFila(m.fila));
      if (f?.tipo === 'entrada') {
        if (!p) p = { neo, entrada: m.data_hora, filaEntrada: m.fila, grupoEntrada: f.grupo || SEM_GRUPO, filaAtual: m.fila };
        else p.filaAtual = m.fila;
      } else if (p) {
        lista.push({ ...p, saida: m.data_hora, filaSaida: m.fila, grupoSaida: f?.grupo || SEM_GRUPO, filaConhecida: !!f });
        p = null;
      }
    });
    if (p) lista.push({ ...p, saida: null });
  });
  return lista;
}

// Completa cada passagem com tempo útil, SLA e situação.
// slaPorGrupo: Map(chaveFila(grupo) -> horas); itensPorNeo: Map(neo -> [itens])
export function avaliar(lista, { itensPorNeo, slaPorGrupo, slaPadrao = 6, ehUtil, expIni, expFim, agora }) {
  return lista.map((p) => {
    const produtos = produtosDoNeo(itensPorNeo.get(p.neo) || []);
    const grupos = [...new Set(produtos.map((x) => x.grupo))];
    const slas = grupos.map((g) => slaPorGrupo.get(chaveFila(g)) ?? slaPadrao);
    const sla = slas.length ? Math.min(...slas) : slaPadrao; // pedido com SLAs diferentes: vale o mais exigente
    const tempo = horasUteis(p.entrada, p.saida || agora, ehUtil, expIni, expFim);
    return {
      ...p, produtos, grupos, sla, semProduto: !produtos.length, tempo,
      evoluiu: !!p.saida,
      mesmoDia: !!p.saida && p.saida.slice(0, 10) === p.entrada.slice(0, 10),
      dentroSla: !!p.saida && tempo <= sla,
      estourado: !p.saida && tempo > sla,
    };
  });
}
