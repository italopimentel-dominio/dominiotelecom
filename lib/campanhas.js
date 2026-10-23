export const TEMAS = {
  corrida: { nome: 'Corrida', emoji: '🏁' },
  foguete: { nome: 'Foguete', emoji: '🚀' },
  podio: { nome: 'Pódio', emoji: '🏆' },
  termometro: { nome: 'Termômetro', emoji: '🌡️' },
};
export const VEICULOS = ['🏎️', '🚗', '🚙', '🚕', '🛻', '🏍️', '🚓', '🚌', '🚐', '🚜'];

export function situacaoCampanha(c, hoje) {
  if (c.fechada_em) return { estado: 'encerrada', texto: '🔒 Fechada', fechada: true };
  if (hoje < c.data_inicio) return { estado: 'futura', texto: 'Ainda não começou' };
  if (hoje > c.data_fim) return { estado: 'encerrada', texto: 'Encerrada' };
  return { estado: 'andamento', texto: 'Em andamento' };
}

// Calcula progresso de cada participante e o geral.
// individual: cada participante precisa atingir o alvo de cada item.
// coletiva: o alvo é da soma de todos; o progresso individual é a contribuição.
export function calcularCampanha(campanha, itens, participantes, resultados) {
  const val = new Map(resultados.map((r) => [`${r.participante_id}|${r.item_id}`, Number(r.valor) || 0]));
  const lista = participantes.map((p) => {
    const porItem = itens.map((it) => {
      const r = val.get(`${p.id}|${it.id}`) || 0;
      return { item: it, realizado: r, pct: it.alvo > 0 ? r / it.alvo : 0 };
    });
    const progresso = porItem.length ? porItem.reduce((s, x) => s + Math.min(x.pct, 2), 0) / porItem.length : 0;
    const completo = campanha.modo === 'individual' && porItem.length > 0 && porItem.every((x) => x.realizado >= x.item.alvo);
    const soma = porItem.reduce((s, x) => s + x.realizado, 0);
    return { ...p, porItem, progresso, completo, soma };
  });
  lista.sort((a, b) => b.progresso - a.progresso || b.soma - a.soma || a.nome.localeCompare(b.nome));
  lista.forEach((p, i) => { p.posicao = i + 1; });
  const totais = itens.map((it) => {
    const realizado = lista.reduce((s, p) => s + (p.porItem.find((x) => x.item.id === it.id)?.realizado || 0), 0);
    const alvo = campanha.modo === 'coletiva' ? it.alvo : it.alvo * Math.max(lista.length, 1);
    return { item: it, realizado, alvo, pct: alvo > 0 ? realizado / alvo : 0 };
  });
  const geral = totais.length ? totais.reduce((s, t) => s + Math.min(t.pct, 1), 0) / totais.length : 0;
  return { ranking: lista, totais, geral, completos: lista.filter((p) => p.completo).length };
}

export const PERSONAGENS = {
  carros: { nome: 'Carros', lista: ['🏎️', '🚗', '🚙', '🚕', '🛻', '🚓'] },
  motos: { nome: 'Motos', lista: ['🏍️', '🛵', '🛺'] },
  cavalos: { nome: 'Cavalos', lista: ['🏇', '🐎'] },
  animais: { nome: 'Bichos', lista: ['🐆', '🐎', '🦄', '🐇', '🐢', '🦊', '🐕', '🦖'] },
  corredores: { nome: 'Corredores', lista: ['🏃‍♂️', '🏃‍♀️', '🏃'] },
  espaciais: { nome: 'Naves', lista: ['🚀', '🛸', '🛰️'] },
};
// Lista de personagens da campanha: um conjunto pronto ou um emoji próprio digitado
export function personagensDe(campanha, tema) {
  const p = campanha.personagem;
  if (p && PERSONAGENS[p]) return PERSONAGENS[p].lista;
  if (p && p.trim()) return [p.trim()];
  return tema === 'foguete' ? ['🚀'] : PERSONAGENS.carros.lista;
}

// Ganhadores: individual = quem atingiu o alvo de todos os itens;
// coletiva = todos que contribuíram, se a soma da equipe bateu todos os alvos.
// Sem ganhadores, "maisPerto" traz os 3 primeiros do ranking (com algum resultado).
export function ganhadoresDe(campanha, calc) {
  let ganhadores = [];
  if (campanha.modo === 'coletiva') {
    const bateu = calc.totais.length > 0 && calc.totais.every((t) => t.realizado >= t.alvo);
    if (bateu) ganhadores = calc.ranking.filter((p) => p.soma > 0);
  } else ganhadores = calc.ranking.filter((p) => p.completo);
  const maisPerto = ganhadores.length ? [] : calc.ranking.filter((p) => p.progresso > 0).slice(0, 3);
  return { ganhadores, maisPerto };
}
