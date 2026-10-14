// Assiduidade: P = presente, F = falta, A = atestado. % = P ÷ (P + F + A); dia sem marcação não entra na conta.
import { normalizar } from './nomes';

export const META_ASSIDUIDADE = 0.95;
export const STATUS = { P: 'Presente', F: 'Falta', A: 'Atestado' };
export const PROXIMO = { '': 'P', P: 'F', F: 'A', A: '' }; // clique na célula

export function contar(statuses) {
  let p = 0, f = 0, a = 0;
  statuses.forEach((s) => { if (s === 'P') p++; else if (s === 'F') f++; else if (s === 'A') a++; });
  const total = p + f + a;
  return { p, f, a, total, pct: total ? p / total : null };
}

// Dias úteis do mês ('2026-10') pelo calendário do sistema (fins de semana, feriados nacionais e cadastrados)
export function diasUteisDoMes(mes, cal) {
  const [ano, m] = mes.split('-').map(Number);
  const ultimo = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  const dias = [];
  for (let d = 1; d <= ultimo; d++) {
    const iso = `${mes}-${String(d).padStart(2, '0')}`;
    if (cal.ehUtil(iso)) dias.push(iso);
  }
  return dias;
}

// Está na equipe neste dia? (admissão / desligamento do cadastro)
export const ativoNoDia = (c, iso) => (!c.data_admissao || c.data_admissao <= iso) && (!c.data_desligamento || c.data_desligamento >= iso);

// ---------- leitura de arquivos ----------
const limpo = (s) => String(s ?? '').trim();
const chave = (s) => normalizar(s).replace(/[0-9]/g, ' ').replace(/\s+/g, ' ').trim();

// Folha de ponto (presentes): [{ nome, datas: ['2026-10-01', ...] }]
export function lerPontoDatas(linhas) {
  const porNome = new Map();
  let iSt = -1, iData = -1, iNome = -1;
  for (const l of linhas) {
    const c = l.map(limpo);
    if (iNome < 0) {
      const k = c.map(chave);
      if (k.includes('funcionario')) { iSt = k.indexOf('status'); iData = k.indexOf('data'); iNome = k.indexOf('funcionario'); }
      continue;
    }
    const m = (c[iData] || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (!/^presente/i.test(c[iSt] || '') || !m || !c[iNome]) continue;
    if (!porNome.has(c[iNome])) porNome.set(c[iNome], new Set());
    porNome.get(c[iNome]).add(`${m[3]}-${m[2]}-${m[1]}`);
  }
  return [...porNome.entries()].map(([nome, datas]) => ({ nome, datas: [...datas] }));
}

// Planilha de acompanhamento (blocos "EQUIPE …" | ADMISSÃO | 01/10 | 02/10 …): [{ nome, marcas: [{ data, status }] }]
export function lerPlanilhaAssiduidade(linhas, mes) {
  const ano = mes.slice(0, 4);
  const pessoas = new Map();
  let colunas = null; // índice -> data iso
  for (const l of linhas) {
    const c = l.map(limpo);
    if (chave(c[1]) === 'admissao') {
      colunas = new Map();
      c.forEach((v, i) => { const m = v.match(/^(\d{1,2})\/(\d{1,2})$/); if (m) colunas.set(i, `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`); });
      continue;
    }
    if (/assiduidade/i.test(c[0] || '')) { colunas = null; continue; } // linha de % fecha o bloco
    if (!colunas || !c[0]) continue;
    const marcas = [];
    colunas.forEach((data, i) => { const s = (c[i] || '').toUpperCase(); if (['P', 'F', 'A'].includes(s) && data.startsWith(mes)) marcas.push({ data, status: s }); });
    if (!marcas.length) continue;
    const atual = pessoas.get(c[0]) || [];
    pessoas.set(c[0], [...atual, ...marcas]);
  }
  return [...pessoas.entries()].map(([nome, marcas]) => ({ nome, marcas }));
}

export function tipoArquivoAssiduidade(linhas) {
  for (const l of linhas.slice(0, 40)) {
    const k = l.map((x) => chave(x));
    if (k.includes('funcionario') && k.some((x) => x.startsWith('registro de ponto'))) return 'ponto';
    if (k[1] === 'admissao' && l.some((x) => /^\d{1,2}\/\d{1,2}$/.test(limpo(x)))) return 'planilha';
  }
  return null;
}
