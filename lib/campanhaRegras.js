// Regras automáticas dos itens das campanhas, aplicadas sobre as linhas das planilhas (tabela pedidos_linhas).
// Arquivo sem acesso ao banco e sem 'use client': serve no servidor e nas telas.
//
// campanha_itens.regra (null = lançado à mão):
// {
//   fontes: [{ fonte_id, condicoes: [{ campo, op, valores: [] }], soma: 'Quant.' }], // condições de cada fonte valem juntas (E)
//   medida: 'pedidos' | 'soma',   // pedidos = 1 por NEO; soma = soma da coluna "soma" de cada fonte
// }
// O pedido entra pela data de entrada, dentro do período da campanha.
import { normalizar } from './nomes';
import { numero } from './formato';

const chave = (s) => normalizar(String(s ?? '')).replace(/\s+/g, ' ').trim();

// campo especial: produto do sistema em que a linha se encaixa pela classe/tipo (Alta Fibra, Reno Móvel...)
export const CAMPO_PRODUTO = '__produto';

export const OPERADORES = [
  { id: 'em', rotulo: 'é um de', lista: true },
  { id: 'fora', rotulo: 'não é', lista: true },
  { id: 'contem', rotulo: 'contém', texto: true },
  { id: 'comeca', rotulo: 'começa com', texto: true },
  { id: 'vazio', rotulo: 'está vazio' },
  { id: 'preenchido', rotulo: 'está preenchido' },
];
export const operador = (id) => OPERADORES.find((o) => o.id === id);

const valoresDaLinha = (linha, campo) => {
  const bruto = campo === CAMPO_PRODUTO ? linha.destinos || [] : linha.dados?.[campo] ?? '';
  return (Array.isArray(bruto) ? bruto : [bruto]).map(chave).filter(Boolean);
};

// condição incompleta (sem campo ou sem valor quando precisa) não filtra nada
export function condicaoCompleta(c) {
  const op = operador(c?.op);
  if (!c?.campo || !op) return false;
  return !(op.lista || op.texto) || (c.valores || []).some((v) => chave(v));
}

export function passaCondicao(linha, c) {
  if (!condicaoCompleta(c)) return true;
  const vals = valoresDaLinha(linha, c.campo);
  const alvo = (c.valores || []).map(chave).filter(Boolean);
  switch (c.op) {
    case 'em': return vals.some((v) => alvo.includes(v));
    case 'fora': return !vals.some((v) => alvo.includes(v));
    case 'contem': return alvo.some((a) => vals.some((v) => v.includes(a)));
    case 'comeca': return alvo.some((a) => vals.some((v) => v.startsWith(a)));
    case 'vazio': return vals.length === 0;
    case 'preenchido': return vals.length > 0;
    default: return true;
  }
}
export const passaCondicoes = (linha, condicoes = []) => condicoes.every((c) => passaCondicao(linha, c));

// pedido = NEO; sem NEO (ex.: VADA), a linha da planilha
export const chavePedido = (linha) => (linha.neo ? `neo:${chave(linha.neo)}` : `linha:${linha.linha}`);

// quantidade da linha (na soma, célula vazia conta 1, como no B2C)
export function qtdDaLinha(linha, cfgFonte, medida) {
  if (medida !== 'soma') return 1;
  const v = linha.dados?.[cfgFonte?.soma];
  if (v === undefined || v === null || String(v).trim() === '') return 1;
  return numero(v) || 0;
}

export const regraValida = (regra) => !!regra && (regra.fontes || []).some((f) => f.fonte_id);
export const fontesDaRegra = (regra) => [...new Set((regra?.fontes || []).map((f) => f.fonte_id).filter(Boolean))];

// Pedidos que contam no item: linhas de pedidos_linhas já filtradas pelo período.
// Devolve [{ fonte_id, chave, neo, data_entrada, consultor, colaborador_id, grupo_id, qtd }]
export function aplicarRegra(regra, linhas) {
  if (!regraValida(regra)) return [];
  const porFonte = new Map(regra.fontes.filter((f) => f.fonte_id).map((f) => [f.fonte_id, f]));
  const vistos = new Map();
  const itens = [];
  for (const l of linhas) {
    const f = porFonte.get(l.fonte_id);
    if (!f || !passaCondicoes(l, f.condicoes)) continue;
    const k = `${l.fonte_id}|${chavePedido(l)}`;
    const q = qtdDaLinha(l, f, regra.medida);
    const ja = vistos.get(k);
    if (ja) { if (regra.medida === 'soma') ja.qtd += q; continue; } // pedidos: 1 por NEO; soma: junta as linhas do pedido
    const it = { fonte_id: l.fonte_id, chave: chavePedido(l), neo: l.neo || null, data_entrada: l.data_entrada, consultor: l.consultor, colaborador_id: l.colaborador_id || null, grupo_id: l.grupo_id || null, qtd: q };
    vistos.set(k, it);
    itens.push(it);
  }
  return itens;
}

// Explicação da regra em português. fontes: [{ id, nome, destinos: { alta: 'Alta Fibra', ... } }]
export function textoRegra(regra, fontes = []) {
  if (!regraValida(regra)) return 'Lançado à mão.';
  const partes = regra.fontes.filter((f) => f.fonte_id).map((f) => {
    const fonte = fontes.find((x) => x.id === f.fonte_id) || {};
    const conds = (f.condicoes || []).filter(condicaoCompleta).map((c) => {
      const campo = c.campo === CAMPO_PRODUTO ? 'produto do sistema' : c.campo;
      const vals = (c.valores || []).map((v) => (c.campo === CAMPO_PRODUTO ? fonte.destinos?.[v] || v : v));
      return vals.length ? `${campo} ${operador(c.op).rotulo} ${vals.join(', ')}` : `${campo} ${operador(c.op).rotulo}`;
    });
    const soma = regra.medida === 'soma' ? `, somando ${f.soma || '(coluna não escolhida)'}` : '';
    return `${fonte.nome || 'fonte'}${conds.length ? ` com ${conds.join(' e ')}` : ' (todas as linhas)'}${soma}`;
  });
  return `${regra.medida === 'soma' ? 'Soma' : 'Conta pedidos (1 por NEO)'} da ${partes.join('; da ')}, pela data de entrada.`;
}
