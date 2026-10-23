import { nomeCurto, capitalizar } from './nomes';
import { calcularCampanha } from './campanhas';
import { aplicarRegra, regraValida, fontesDaRegra } from './campanhaRegras';
import { MODELOS } from './fontes';

const arred = (n) => Math.round(n * 100) / 100;

// Fontes de pedidos (para as regras): [{ id, nome, modelo, destinos: { alta: 'Alta Fibra', ... } }]
export async function listaFontes(supabase) {
  const { data } = await supabase.from('fontes_dados').select('*');
  return (data || []).filter((f) => MODELOS[f.modelo]).map((f) => ({
    id: f.id, nome: f.nome || MODELOS[f.modelo].nomePadrao, modelo: f.modelo, destinos: MODELOS[f.modelo].destinos || {},
  })).sort((a, b) => a.nome.localeCompare(b.nome));
}

// Período usado nos itens automáticos: o filtro de datas da tela, sempre dentro do período da campanha
export function periodoCampanha(c, { de, ate } = {}) {
  const ok = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
  return {
    de: ok(de) && de > c.data_inicio ? de : c.data_inicio,
    ate: ok(ate) && ate < c.data_fim ? ate : c.data_fim,
  };
}

// Linhas das planilhas das fontes, no período (lê de 1.000 em 1.000, com ordem estável)
export async function linhasDoPeriodo(supabase, fontes, de, ate) {
  const linhas = [];
  if (!fontes.length) return { linhas };
  for (let i = 0; ; i += 1000) {
    const { data, error } = await supabase.from('pedidos_linhas')
      .select('id, fonte_id, linha, neo, consultor, colaborador_id, grupo_id, data_entrada, destinos, dados')
      .in('fonte_id', fontes).gte('data_entrada', de).lte('data_entrada', ate)
      .order('id').range(i, i + 999);
    if (error) return { linhas, erro: /pedidos_linhas/.test(error.message) ? 'Rode o 045_campanhas.sql no Supabase.' : error.message };
    linhas.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return { linhas };
}

// Distribui os pedidos de um item entre os participantes.
// Individual: pelo colaborador vinculado. Equipe: pela equipe do colaborador (ou a equipe direta do nome),
// subindo no organograma até achar uma equipe participante.
export function distribuirItem(campanha, regra, linhas, parts, colabs, grupos) {
  const pedidos = aplicarRegra(regra, linhas);
  const grupoDoColab = new Map((colabs || []).map((c) => [c.id, c.grupo_id]));
  const pai = new Map((grupos || []).map((g) => [g.id, g.parent_id]));
  const porColab = new Map((parts || []).filter((p) => p.colaborador_id).map((p) => [p.colaborador_id, p.id]));
  const porGrupo = new Map((parts || []).filter((p) => p.grupo_id).map((p) => [p.grupo_id, p.id]));
  const valores = new Map();
  const neos = {}; // NEO -> participante que recebeu (para não contar duas vezes num ajuste manual)
  const foraNomes = new Map();
  const diag = { total: 0, contado: 0, fora: 0, semVinculo: 0, pedidos: pedidos.length };
  for (const p of pedidos) {
    diag.total += p.qtd;
    let pid = null;
    if (campanha.participacao === 'equipe') {
      let g = p.grupo_id || grupoDoColab.get(p.colaborador_id);
      for (let n = 0; g && n < 50 && !pid; n++) { pid = porGrupo.get(g) || null; g = pai.get(g); }
    } else pid = porColab.get(p.colaborador_id) || null;
    if (pid) { valores.set(pid, (valores.get(pid) || 0) + p.qtd); diag.contado += p.qtd; if (p.neo) neos[String(p.neo).trim()] = pid; }
    else if (!p.colaborador_id && !p.grupo_id) diag.semVinculo += p.qtd;
    else { diag.fora += p.qtd; foraNomes.set(p.consultor, (foraNomes.get(p.consultor) || 0) + p.qtd); }
  }
  return {
    valores,
    neos,
    diag: {
      total: arred(diag.total), contado: arred(diag.contado), fora: arred(diag.fora), semVinculo: arred(diag.semVinculo), pedidos: diag.pedidos,
      foraNomes: [...foraNomes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([nome, qtd]) => ({ nome, qtd: arred(qtd) })),
    },
  };
}

// filtro: { de, ate } (datas 'AAAA-MM-DD'); vale só para os itens automáticos
export async function carregarCampanha(supabase, id, filtro = {}) {
  const [{ data: campanha }, { data: itens }, { data: parts }, { data: colabs }, { data: grupos }] = await Promise.all([
    supabase.from('campanhas').select('*').eq('id', id).maybeSingle(),
    supabase.from('campanha_itens').select('*').eq('campanha_id', id).order('ordem').order('nome'),
    supabase.from('campanha_participantes').select('*').eq('campanha_id', id),
    supabase.from('colaboradores').select('id, nome, grupo_id, ativo, foto_url'),
    supabase.from('grupos').select('id, nome, parent_id, ativo'),
  ]);
  if (!campanha) return null;
  const ids = (parts || []).map((p) => p.id);
  const { data: lancados } = ids.length
    ? await supabase.from('campanha_resultados').select('*').in('participante_id', ids)
    : { data: [] };
  const colab = new Map((colabs || []).map((c) => [c.id, c]));
  const grupo = new Map((grupos || []).map((g) => [g.id, g]));
  const participantes = (parts || []).map((p) => {
    if (p.colaborador_id) {
      const c = colab.get(p.colaborador_id);
      return { ...p, nome: c ? nomeCurto(c.nome) : '—', nomeCompleto: c ? capitalizar(c.nome) : '—', equipe: c ? capitalizar(grupo.get(c.grupo_id)?.nome || '') : '', foto: c?.foto_url || null };
    }
    const g = grupo.get(p.grupo_id);
    return { ...p, nome: g ? capitalizar(g.nome) : '—', nomeCompleto: g ? g.nome : '—', equipe: g?.parent_id ? capitalizar(grupo.get(g.parent_id)?.nome || '') : '' };
  });

  // itens automáticos: o resultado vem das planilhas (o que foi lançado à mão nesses itens é ignorado)
  const autos = (itens || []).filter((it) => regraValida(it.regra));
  const periodo = periodoCampanha(campanha, campanha.fechada_em ? {} : filtro);
  const automatico = {};
  let resultados = lancados || [];
  let fontes = [];
  let erroAuto = null;
  const congelado = campanha.fechada_em && campanha.resultado_fechado ? campanha.resultado_fechado : null;
  const valoresAuto = {}; // item_id -> { participante_id: valor } (só o que veio das planilhas)
  const neosAuto = {};    // item_id -> { NEO: participante_id }
  if (autos.length) {
    fontes = await listaFontes(supabase);
    if (congelado) {
      // campanha fechada: os itens automáticos usam a foto gravada ao fechar (não leem mais as planilhas)
      for (const it of autos) {
        automatico[it.id] = congelado.automatico?.[it.id] || { total: 0, contado: 0, fora: 0, semVinculo: 0, pedidos: 0, foraNomes: [] };
        valoresAuto[it.id] = congelado.valores?.[it.id] || {};
        neosAuto[it.id] = congelado.neos?.[it.id] || {};
      }
    } else {
      const { linhas, erro } = await linhasDoPeriodo(supabase, [...new Set(autos.flatMap((it) => fontesDaRegra(it.regra)))], periodo.de, periodo.ate);
      erroAuto = erro || null;
      for (const it of autos) {
        const { valores, diag, neos } = distribuirItem(campanha, it.regra, linhas, parts || [], colabs || [], grupos || []);
        automatico[it.id] = diag;
        valoresAuto[it.id] = Object.fromEntries([...valores].map(([pid, v]) => [pid, arred(v)]));
        neosAuto[it.id] = neos;
      }
    }
  }

  // ajustes manuais nos itens automáticos (somam por cima do que veio das planilhas)
  let ajustes = [];
  if (autos.length && ids.length) {
    const { data } = await supabase.from('campanha_ajustes').select('*').in('participante_id', ids).order('criado_em');
    const idsAuto = new Set(autos.map((it) => it.id));
    ajustes = (data || []).filter((a) => idsAuto.has(a.item_id));
  }
  if (autos.length) {
    const idsAuto = new Set(autos.map((it) => it.id));
    resultados = resultados.filter((r) => !idsAuto.has(r.item_id));
    const soma = new Map();
    for (const it of autos) Object.entries(valoresAuto[it.id] || {}).forEach(([pid, v]) => soma.set(`${pid}|${it.id}`, Number(v) || 0));
    for (const a of ajustes) {
      const k = `${a.participante_id}|${a.item_id}`;
      soma.set(k, (soma.get(k) || 0) + (Number(a.qtd) || 0));
      if (automatico[a.item_id]) automatico[a.item_id] = { ...automatico[a.item_id], ajustes: arred((automatico[a.item_id].ajustes || 0) + (Number(a.qtd) || 0)) };
    }
    soma.forEach((v, k) => { const [pid, item_id] = k.split('|'); resultados.push({ participante_id: pid, item_id, valor: arred(v), automatico: true }); });
  }

  const calc = calcularCampanha(campanha, itens || [], participantes, resultados);
  return { campanha, itens: itens || [], participantes, resultados, calc, colabs: colabs || [], grupos: grupos || [], automatico, periodo, fontes, erroAuto, valoresAuto, neosAuto, ajustes };
}
