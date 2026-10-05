// Leitura dos relatórios exportados do BI da operadora (aba "Export"):
// CANAL | mCANAL2 (unidade) | mCANAL3 (setor) | mCANAL4 (equipe) | CONSULTOR | ... | EXECUTADO | ... | M0 | M-1 | M-2 | M-3
// Linhas "Total" são subtotais e são ignoradas; o rodapé "Filtros aplicados" traz o mês e se é quantidade ou receita.
import { normalizar, similaridade } from './nomes';

const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const txt = (v) => (v === null || v === undefined ? '' : String(v).trim());
const num = (v) => (typeof v === 'number' ? v : v === null || v === undefined || v === '' ? null : Number(String(v).replace(/\./g, '').replace(',', '.')));

// Sinônimos usados para ligar nomes de arquivo/relatório aos produtos do sistema
const SINONIMOS = [[/\bbasica\b/g, 'fibra'], [/\bfixa\b/g, 'fibra'], [/\brenovacao\b/g, 'reno'], [/\brenova\b/g, 'reno'], [/\bmoveis\b/g, 'movel'], [/\baltas\b/g, 'alta']];
export function nomeProdutoComparavel(s) {
  let n = normalizar(String(s).replace(/[_-]+/g, ' '));
  SINONIMOS.forEach(([re, sub]) => { n = n.replace(re, sub); });
  return n.replace(/\b(qtd|quantidade|receita|valor|rs|brl|xlsx|xls|csv)\b/g, ' ').replace(/\s+/g, ' ').trim();
}

export function medidaDoNome(nomeArquivo) {
  const n = normalizar(String(nomeArquivo).replace(/[_-]+/g, ' '));
  if (/\b(receita|valor|rs|brl|faturamento)\b/.test(n)) return 'brl';
  if (/\b(qtd|quantidade|qtde)\b/.test(n)) return 'qtd';
  return null;
}

export function sugerirProduto(nomeArquivo, produtos) {
  const alvo = nomeProdutoComparavel(nomeArquivo);
  let melhor = '', nota = 0;
  produtos.forEach((p) => {
    const s = similaridade(alvo, nomeProdutoComparavel(p.nome));
    if (s > nota) { nota = s; melhor = p.id; }
  });
  return nota >= 0.6 ? melhor : '';
}

// Recebe as linhas da planilha (array de arrays) e devolve tudo organizado
export function lerRelatorio(linhas) {
  const iCab = linhas.findIndex((l) => l.some((c) => txt(c).toUpperCase() === 'CONSULTOR') && l.some((c) => txt(c).toUpperCase() === 'EXECUTADO'));
  if (iCab < 0) return null;
  const cab = linhas[iCab].map((c) => txt(c).toUpperCase());
  const col = (nome) => cab.indexOf(nome);
  const i = { canal: col('CANAL'), c2: col('MCANAL2'), c3: col('MCANAL3'), c4: col('MCANAL4'), cons: col('CONSULTOR'), exec: col('EXECUTADO'), m1: col('M-1'), m2: col('M-2'), m3: col('M-3') };
  const valoresDe = (l) => ({ m0: num(l[i.exec]), m1: i.m1 >= 0 ? num(l[i.m1]) : null, m2: i.m2 >= 0 ? num(l[i.m2]) : null, m3: i.m3 >= 0 ? num(l[i.m3]) : null });

  let mes = null, medida = null, filtros = '';
  const pessoas = [];
  const canais = new Map(); // total por canal (para canais sem consultor, como o Indireto)
  let total = null;

  for (const l of linhas.slice(iCab + 1)) {
    const canal = txt(l[i.canal]);
    if (/^filtros aplicados/i.test(canal)) {
      filtros = canal;
      const mm = canal.match(/MES_ANO\s+é\s+([a-zçã]+)_(\d{4})/i);
      if (mm) {
        const idx = MESES.indexOf(normalizar(mm[1]));
        if (idx >= 0) mes = `${mm[2]}-${String(idx + 1).padStart(2, '0')}`;
      }
      const mv = canal.match(/VALOR\s+é\s+([A-ZÇÃ]+)/i);
      if (mv) medida = /RECEITA/i.test(mv[1]) ? 'brl' : 'qtd';
      continue;
    }
    if (!canal) continue;
    const c2 = txt(l[i.c2]), c3 = txt(l[i.c3]), c4 = txt(l[i.c4]), cons = txt(l[i.cons]);
    if (canal === 'Total') { total = valoresDe(l); continue; }
    if (cons && cons !== 'Total') {
      pessoas.push({ nome: cons, canal, unidade: c2, setor: c3, equipe: c4.replace(/^EQUIPE\s+/i, ''), valores: valoresDe(l) });
    } else if (normalizar(c2) === 'consultor independente' && c3 && c3 !== 'Total' && (!c4 || c4 === 'Total')) {
      pessoas.push({ nome: c3, canal, unidade: c2, setor: '', equipe: 'Consultor independente', valores: valoresDe(l) });
    } else if (c2 === 'Total' && !c3) {
      canais.set(canal, valoresDe(l));
    }
  }
  // Canal sem nenhum consultor no relatório (ex.: CANAL INDIRETO): entra como resultado direto de uma equipe
  const grupos = [...canais.entries()]
    .filter(([canal]) => !pessoas.some((p) => p.canal === canal))
    .map(([canal, valores]) => ({ nome: canal, valores }));
  return { mes, medida, filtros, pessoas, grupos, total };
}
