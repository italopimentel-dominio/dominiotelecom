// Medidas: 'qtd' (quantidade) e 'brl' (receita em R$). Um produto pode ter uma ou as duas ('ambos').
export const MEDIDAS = { qtd: 'Quantidade', brl: 'Receita' };
export const medidasDo = (p) => p.medidas || p.unidade || 'qtd';
export const temMedida = (p, m) => { const x = medidasDo(p); return x === 'ambos' || x === m; };
export const listaMedidas = (p) => (medidasDo(p) === 'ambos' ? ['qtd', 'brl'] : [medidasDo(p)]);

// Produtos vistos numa medida: só os que têm essa medida, já formatados nela
export function produtosDaMedida(produtos, m) {
  const ok = new Set(produtos.filter((p) => temMedida(p, m)).map((p) => p.id));
  return produtos.filter((p) => ok.has(p.id)).map((p) => ({
    ...p,
    unidade: m,
    componentes: (p.componentes || []).filter((c) => ok.has(c.componente_id)),
  }));
}
