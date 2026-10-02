import { hojeSP } from './datas';
import { montarCalendario, resumoCiclo, calcularIndicadores, distribuir } from './calc';

export async function listarPeriodos(supabase) {
  const { data } = await supabase.from('periodos').select('*').order('referencia', { ascending: false });
  return data || [];
}

export function escolherPeriodo(periodos, id) {
  if (id) {
    const p = periodos.find((x) => x.id === id);
    if (p) return p;
  }
  const mes = hojeSP().slice(0, 7) + '-01';
  return periodos.find((p) => p.referencia === mes) || periodos[0] || null;
}

export async function carregarEstrutura(supabase) {
  const [g, c, p] = await Promise.all([
    supabase.from('grupos').select('*').order('ordem').order('nome'),
    supabase.from('colaboradores').select('*').order('nome'),
    supabase.from('produtos').select('*').order('ordem').order('nome'),
  ]);
  return montarArvore(g.data || [], c.data || [], p.data || []);
}

function montarArvore(grupos, colaboradores, produtos) {
  const porId = new Map(grupos.map((g) => [g.id, g]));
  const filhos = new Map();
  grupos.forEach((g) => {
    const k = g.parent_id || 'raiz';
    if (!filhos.has(k)) filhos.set(k, []);
    filhos.get(k).push(g);
  });
  const filhosDe = (id) => filhos.get(id || 'raiz') || [];
  const cadeia = (id) => {
    const s = new Set();
    let atual = porId.get(id);
    while (atual) { s.add(atual.id); atual = porId.get(atual.parent_id); }
    return s;
  };
  const caminho = (id) => {
    const lista = [];
    let atual = porId.get(id);
    while (atual) { lista.unshift(atual); atual = porId.get(atual.parent_id); }
    return lista;
  };
  const subarvore = (id) => {
    const lista = [id];
    filhosDe(id).forEach((f) => lista.push(...subarvore(f.id)));
    return lista;
  };
  // lista achatada (com nível) para desenhar a árvore
  const achatar = (id = null, nivel = 0, soAtivos = false) => {
    const out = [];
    filhosDe(id).forEach((g) => {
      if (soAtivos && !g.ativo) return;
      out.push({ ...g, nivel });
      out.push(...achatar(g.id, nivel + 1, soAtivos));
    });
    return out;
  };
  return { grupos, colaboradores, produtos, porId, filhosDe, cadeia, caminho, subarvore, achatar, raizes: filhosDe(null) };
}

export async function carregarBase(supabase, periodo) {
  const id = periodo.id;
  const [est, ciclos, metas, ind, real, realG, feriados, config] = await Promise.all([
    carregarEstrutura(supabase),
    supabase.from('ciclos').select('*').eq('periodo_id', id).order('data_inicio'),
    supabase.from('metas').select('*').eq('periodo_id', id),
    supabase.from('metas_individuais').select('*').eq('periodo_id', id),
    supabase.from('realizados').select('*').eq('periodo_id', id),
    supabase.from('realizados_grupo').select('*').eq('periodo_id', id),
    supabase.from('feriados').select('*').order('data'),
    supabase.from('config').select('*').eq('id', 1).maybeSingle(),
  ]);
  return {
    ...est,
    periodo,
    ciclos: ciclos.data || [],
    metas: metas.data || [],
    metasIndividuais: ind.data || [],
    realizados: real.data || [],
    realizadosGrupo: realG.data || [],
    feriados: feriados.data || [],
    config: config.data || null,
  };
}

// Junta tudo e devolve funções prontas para as telas.
export function analisar(base, hoje = hojeSP()) {
  const cal = montarCalendario(base.config, base.feriados);
  const k = (a, b) => `${a}|${b}`;
  const metaMap = new Map(base.metas.map((m) => [k(m.grupo_id, m.produto_id), Number(m.valor)]));
  const grupoDoColab = new Map(base.colaboradores.map((c) => [c.id, c.grupo_id]));
  const direto = new Map();
  const somar = (g, p, v) => direto.set(k(g, p), (direto.get(k(g, p)) || 0) + (Number(v) || 0));
  base.realizados.forEach((r) => somar(grupoDoColab.get(r.colaborador_id), r.produto_id, r.valor));
  base.realizadosGrupo.forEach((r) => somar(r.grupo_id, r.produto_id, r.valor));
  const realColab = new Map(base.realizados.map((r) => [k(r.colaborador_id, r.produto_id), Number(r.valor)]));
  const realGrupo = new Map(base.realizadosGrupo.map((r) => [k(r.grupo_id, r.produto_id), Number(r.valor)]));
  const fixos = new Map(base.metasIndividuais.map((m) => [k(m.colaborador_id, m.produto_id), Number(m.valor)]));

  const cicloDe = (produto) => base.ciclos.find((c) => c.codigo === produto.ciclo) || base.ciclos[0] || null;
  const cacheResumo = new Map();
  const resumo = (ciclo, grupoId) => {
    const chave = k(ciclo.id, grupoId);
    if (!cacheResumo.has(chave)) cacheResumo.set(chave, resumoCiclo(ciclo, hoje, cal, base.cadeia(grupoId)));
    return cacheResumo.get(chave);
  };
  // Grupo com equipes ativas abaixo: a meta é a soma delas. Grupo sem equipes abaixo: meta lançada.
  const filhosAtivos = (g) => base.filhosDe(g).filter((f) => f.ativo);
  const ehSoma = (g) => filhosAtivos(g).length > 0;
  const cacheMeta = new Map();
  const meta = (g, p) => {
    const chave = k(g, p);
    if (cacheMeta.has(chave)) return cacheMeta.get(chave);
    let v;
    if (ehSoma(g)) {
      const valores = filhosAtivos(g).map((f) => meta(f.id, p)).filter((x) => x !== null);
      v = valores.length ? valores.reduce((s, x) => s + x, 0) : null;
    } else {
      v = metaMap.has(chave) ? metaMap.get(chave) : null;
    }
    cacheMeta.set(chave, v);
    return v;
  };
  const realizado = (g, p) => base.subarvore(g).reduce((s, id) => s + (direto.get(k(id, p)) || 0), 0);
  const colabsDiretos = (g) => base.colaboradores.filter((c) => c.grupo_id === g);
  const colabsAtivosSub = (g) => {
    const ids = new Set(base.subarvore(g));
    return base.colaboradores.filter((c) => c.ativo && ids.has(c.grupo_id)).length;
  };

  function indicador(grupoId, produto) {
    const ciclo = cicloDe(produto);
    if (!ciclo) return null;
    const res = resumo(ciclo, grupoId);
    const m = meta(grupoId, produto.id);
    const r = realizado(grupoId, produto.id);
    return {
      produto, ciclo, resumo: res, temMeta: m !== null,
      ...calcularIndicadores({ meta: m ?? 0, realizado: r, unidade: produto.unidade, fator: base.periodo.fator_bruto, resumo: res }),
    };
  }

  function individuais(grupoId, produto) {
    const ciclo = cicloDe(produto);
    if (!ciclo) return { linhas: [], dist: null };
    const res = resumo(ciclo, grupoId);
    const todos = colabsDiretos(grupoId);
    const ativos = todos.filter((c) => c.ativo);
    const fixosGrupo = new Map(ativos.filter((c) => fixos.has(k(c.id, produto.id))).map((c) => [c.id, fixos.get(k(c.id, produto.id))]));
    const dist = distribuir(meta(grupoId, produto.id) ?? 0, ativos, fixosGrupo, produto.unidade);
    const linhas = todos
      .filter((c) => c.ativo || realColab.has(k(c.id, produto.id)))
      .map((c) => {
        const m = c.ativo ? dist.valores.get(c.id) ?? 0 : 0;
        const r = realColab.get(k(c.id, produto.id)) ?? null;
        return {
          colaborador: c,
          fixo: fixosGrupo.has(c.id) ? fixosGrupo.get(c.id) : null,
          realizadoBruto: r,
          ...calcularIndicadores({ meta: m, realizado: r ?? 0, unidade: produto.unidade, fator: base.periodo.fator_bruto, resumo: res }),
        };
      });
    return { linhas, dist, resumo: res };
  }

  return {
    cal, hoje, cicloDe, resumo, meta, ehSoma, realizado, indicador, individuais, colabsAtivosSub,
    realizadoGrupoDireto: (g, p) => realGrupo.get(k(g, p)) ?? null,
  };
}
