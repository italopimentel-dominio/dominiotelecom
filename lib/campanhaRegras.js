// Campanhas: regras sobre as linhas das planilhas (tabela pedidos_linhas).
// Arquivo sem acesso ao banco e sem 'use client': serve no servidor e nas telas.
//
// Formato de campanhas.config:
// {
//   fontes: [{ fonte_id, regras: [{ campo, op, valores: [] }], soma: 'Quant.' }],  // regras de cada fonte valem juntas (E)
//   medida: 'pedidos' | 'soma',        // pedidos = 1 por NEO; soma = soma da coluna "soma" de cada fonte
//   contagem: 'atual' | 'trava',       // atual = status de hoje; trava = bateu a regra uma vez, conta até o fim
//   meta: 3,                           // por pessoa
//   faixas: [{ nome: 'Prata', minimo: 5, premio: 'R$ 100' }],
//   grupos: [uuid],                    // equipes participantes (vazio = todas)
// }
import { normalizar } from './nomes';
import { numero } from './formato';

const chave = (s) => normalizar(String(s ?? '')).replace(/\s+/g, ' ').trim();

// campo especial: produto do sistema em que a linha se encaixa (Alta Fibra, Reno Móvel...)
export const CAMPO_PRODUTO = '__produto';

export const OPERADORES = [
  { id: 'em', rotulo: 'é um de', lista: true },
  { id: 'fora', rotulo: 'não é', lista: true },
  { id: 'contem', rotulo: 'contém', texto: true },
  { id: 'comeca', rotulo: 'começa com', texto: true },
  { id: 'vazio', rotulo: 'está vazio' },
  { id: 'preenchido', rotulo: 'está preenchido' },
];

const valoresDaLinha = (linha, campo) => {
  const bruto = campo === CAMPO_PRODUTO ? linha.destinos || [] : linha.dados?.[campo] ?? '';
  return (Array.isArray(bruto) ? bruto : [bruto]).map(chave).filter(Boolean);
};

// regra incompleta (sem campo ou sem valor quando precisa) não filtra nada
export function regraCompleta(r) {
  if (!r?.campo || !r?.op) return false;
  const op = OPERADORES.find((o) => o.id === r.op);
  if (!op) return false;
  return !(op.lista || op.texto) || (r.valores || []).some((v) => chave(v));
}

export function passaRegra(linha, r) {
  if (!regraCompleta(r)) return true;
  const vals = valoresDaLinha(linha, r.campo);
  const alvo = (r.valores || []).map(chave).filter(Boolean);
  switch (r.op) {
    case 'em': return vals.some((v) => alvo.includes(v));
    case 'fora': return !vals.some((v) => alvo.includes(v));
    case 'contem': return alvo.some((a) => vals.some((v) => v.includes(a)));
    case 'comeca': return alvo.some((a) => vals.some((v) => v.startsWith(a)));
    case 'vazio': return vals.length === 0;
    case 'preenchido': return vals.length > 0;
    default: return true;
  }
}

export const passaRegras = (linha, regras = []) => regras.every((r) => passaRegra(linha, r));

// pedido = NEO; sem NEO (ex.: VADA), a linha da planilha
export const chavePedido = (linha) => (linha.neo ? `neo:${chave(linha.neo)}` : `linha:${linha.linha}`);

// quantidade que a linha soma na campanha (vazia conta 1 por padrão, como no B2C)
export function qtdDaLinha(linha, cfgFonte, medida) {
  if (medida !== 'soma') return 1;
  const v = linha.dados?.[cfgFonte?.soma];
  if (v === undefined || v === null || String(v).trim() === '') return cfgFonte?.vazia ?? 1;
  return numero(v) || 0;
}

// período efetivo: o filtro de datas da tela sempre fica dentro do período da campanha
export function periodoEfetivo(campanha, de, ate) {
  const ini = de && de > campanha.inicio ? de : campanha.inicio;
  const fim = ate && ate < campanha.fim ? ate : campanha.fim;
  return { de: ini, ate: fim };
}

// Linhas que contam na campanha (contagem "atual"): linhas = registros de pedidos_linhas
export function itensDaCampanha(campanha, linhas, { de, ate } = {}) {
  const cfg = campanha.config || {};
  const p = periodoEfetivo(campanha, de, ate);
  const porFonte = new Map((cfg.fontes || []).map((f) => [f.fonte_id, f]));
  const vistos = new Set();
  const itens = [];
  for (const l of linhas) {
    const f = porFonte.get(l.fonte_id);
    if (!f || !l.data_entrada || l.data_entrada < p.de || l.data_entrada > p.ate) continue;
    if (!passaRegras(l, f.regras)) continue;
    const ch = `${l.fonte_id}|${chavePedido(l)}`;
    if (cfg.medida !== 'soma') { if (vistos.has(ch)) continue; vistos.add(ch); }
    itens.push({
      fonte_id: l.fonte_id, chave: chavePedido(l), neo: l.neo || null, linha: l.linha, data_entrada: l.data_entrada,
      consultor: l.consultor, colaborador_id: l.colaborador_id || null, grupo_id: l.grupo_id || null,
      qtd: qtdDaLinha(l, f, cfg.medida), dados: l.dados,
    });
  }
  return itens;
}

// Faixa atingida (a maior com mínimo <= total). A meta simples vira a faixa "Meta".
export function faixaDe(total, cfg = {}) {
  const faixas = [...(cfg.faixas || [])];
  if (cfg.meta && !faixas.some((f) => Number(f.minimo) === Number(cfg.meta))) faixas.push({ nome: 'Meta', minimo: Number(cfg.meta) });
  return faixas.filter((f) => Number(f.minimo) > 0 && total >= Number(f.minimo)).sort((a, b) => b.minimo - a.minimo)[0] || null;
}

// Resultado: por pessoa (ranking), por dia e totais. itens = itensDaCampanha ou campanha_pedidos (contagem "trava").
export function resumirCampanha(campanha, itens) {
  const cfg = campanha.config || {};
  const pessoas = new Map();
  const porDia = {};
  let total = 0;
  for (const it of itens) {
    const k = it.colaborador_id ? `c:${it.colaborador_id}` : it.grupo_id ? `g:${it.grupo_id}` : `n:${chave(it.consultor)}`;
    const p = pessoas.get(k) || { chave: k, colaborador_id: it.colaborador_id || null, grupo_id: it.grupo_id || null, consultor: it.consultor, total: 0, pedidos: 0, semVinculo: !it.colaborador_id && !it.grupo_id };
    p.total += Number(it.qtd) || 0;
    p.pedidos++;
    pessoas.set(k, p);
    porDia[it.data_entrada] = (porDia[it.data_entrada] || 0) + (Number(it.qtd) || 0);
    total += Number(it.qtd) || 0;
  }
  const ranking = [...pessoas.values()]
    .map((p) => ({ ...p, total: Math.round(p.total * 100) / 100, faixa: faixaDe(p.total, cfg), progresso: cfg.meta ? Math.min(1, p.total / cfg.meta) : null }))
    .sort((a, b) => b.total - a.total || a.consultor.localeCompare(b.consultor));
  const comPessoa = ranking.filter((p) => !p.semVinculo);
  return {
    total: Math.round(total * 100) / 100,
    ranking,
    porDia,
    bateram: cfg.meta ? comPessoa.filter((p) => p.total >= cfg.meta).length : null,
    participantes: comPessoa.length,
    media: comPessoa.length ? Math.round((comPessoa.reduce((s, p) => s + p.total, 0) / comPessoa.length) * 10) / 10 : 0,
    semVinculo: ranking.filter((p) => p.semVinculo).reduce((s, p) => s + p.total, 0),
  };
}

// Explicação da campanha em português (balão "i")
// nomesFontes: { fonte_id: 'Básica' }; rotulosProduto: { alta: 'Alta Fibra', ... } por fonte_id
const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '');
export function textoCampanha(campanha, nomesFontes = {}, rotulosProduto = {}) {
  const cfg = campanha.config || {};
  const op = (id) => OPERADORES.find((o) => o.id === id)?.rotulo || id;
  const partes = (cfg.fontes || []).map((f) => {
    const rot = rotulosProduto[f.fonte_id] || {};
    const regras = (f.regras || []).filter(regraCompleta).map((r) => {
      const campo = r.campo === CAMPO_PRODUTO ? 'produto do sistema' : r.campo;
      const vals = (r.valores || []).map((v) => (r.campo === CAMPO_PRODUTO ? rot[v] || v : v));
      return vals.length ? `${campo} ${op(r.op)} ${vals.join(', ')}` : `${campo} ${op(r.op)}`;
    });
    const nome = nomesFontes[f.fonte_id] || 'fonte';
    const soma = cfg.medida === 'soma' ? `, somando ${f.soma || '(coluna não escolhida)'}` : '';
    return `${nome}${regras.length ? ` com ${regras.join(' e ')}` : ' (todas as linhas)'}${soma}`;
  });
  const conta = cfg.medida === 'soma' ? 'Soma' : 'Conta pedidos (1 por NEO)';
  const trava = cfg.contagem === 'trava' ? ' Um pedido que bateu a regra continua contando, mesmo que o status mude depois.' : ' Vale o status de hoje: se o pedido deixar de bater a regra, sai da contagem.';
  return `${conta} da ${partes.join('; da ')}, com data de entrada entre ${dataBR(campanha.inicio)} e ${dataBR(campanha.fim)}.${trava}${cfg.meta ? ` Meta: ${cfg.meta} por pessoa.` : ''}`;
}
