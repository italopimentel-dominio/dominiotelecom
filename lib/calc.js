import { diaDaSemana, inicioDaSemana, intervalo } from './datas';
import { feriadosNacionais } from './feriados';

const CONFIG_PADRAO = { sabado_util: false, feriado_carnaval: true, feriado_corpus_christi: true };

// Calendário de dias úteis: fim de semana, feriados nacionais e feriados cadastrados.
// Feriados cadastrados podem valer para todos ou só para um grupo (e os grupos abaixo dele).
export function montarCalendario(config, feriadosCustom = []) {
  const cfg = { ...CONFIG_PADRAO, ...(config || {}) };
  const nacionaisPorAno = new Map();
  function nacional(iso) {
    const ano = Number(iso.slice(0, 4));
    if (!nacionaisPorAno.has(ano)) {
      const mapa = new Map();
      feriadosNacionais(ano).forEach((f) => {
        if (f.opcional === 'carnaval' && !cfg.feriado_carnaval) return;
        if (f.opcional === 'corpus' && !cfg.feriado_corpus_christi) return;
        mapa.set(f.data, f.nome);
      });
      nacionaisPorAno.set(ano, mapa);
    }
    return nacionaisPorAno.get(ano).get(iso);
  }
  const vale = (f, cadeia) => !f.grupo_id || (cadeia && cadeia.has(f.grupo_id));

  function motivo(iso, cadeia) {
    // devolve null se for dia útil, ou o motivo de não ser
    if (feriadosCustom.some((f) => f.data === iso && f.tipo === 'dia_util' && vale(f, cadeia))) return null;
    const dow = diaDaSemana(iso);
    if (dow === 0) return 'Domingo';
    if (dow === 6 && !cfg.sabado_util) return 'Sábado';
    const custom = feriadosCustom.find((f) => f.data === iso && f.tipo !== 'dia_util' && vale(f, cadeia));
    if (custom) return custom.nome;
    return nacional(iso) || null;
  }
  return { config: cfg, motivo, ehUtil: (iso, cadeia) => motivo(iso, cadeia) === null, nacional };
}

// Resumo de um ciclo de fechamento (ex.: 01/10 a 31/10) para um grupo.
export function resumoCiclo(ciclo, hoje, cal, cadeia) {
  const todos = intervalo(ciclo.data_inicio, ciclo.data_fim);
  const dias = todos.filter((d) => cal.ehUtil(d, cadeia));
  const feriados = todos
    .filter((d) => diaDaSemana(d) !== 0 && diaDaSemana(d) !== 6)
    .map((d) => ({ data: d, nome: cal.motivo(d, cadeia) }))
    .filter((f) => f.nome);
  const total = dias.length;
  const decorridos = dias.filter((d) => d < hoje).length;
  const restantes = total - decorridos;
  const semanaHoje = inicioDaSemana(hoje);
  const mapa = new Map();
  dias.forEach((d) => {
    const k = inicioDaSemana(d);
    if (!mapa.has(k)) mapa.set(k, { chave: k, inicio: d, fim: d, dias: 0, restantes: 0 });
    const s = mapa.get(k);
    s.fim = d;
    s.dias += 1;
    if (d >= hoje) s.restantes += 1;
  });
  const semanas = [...mapa.values()].map((s, i) => ({
    ...s,
    numero: i + 1,
    atual: s.chave === semanaHoje,
    passada: s.restantes === 0,
  }));
  return {
    total, decorridos, restantes, semanas, feriados, dias,
    semanasRestantes: semanas.filter((s) => s.restantes > 0).length,
    encerrado: hoje > ciclo.data_fim,
    naoIniciado: hoje < ciclo.data_inicio,
  };
}

// Reparte um total proporcionalmente aos pesos. Em quantidade, usa inteiros que somam o total arredondado para cima.
function repartir(total, pesos, unidade) {
  const soma = pesos.reduce((a, b) => a + b, 0);
  if (soma <= 0 || total <= 0) return pesos.map(() => 0);
  const brutos = pesos.map((p) => (total * p) / soma);
  if (unidade !== 'qtd') return brutos.map((v) => Math.round(v * 100) / 100);
  const alvo = Math.ceil(total - 1e-9);
  const ints = brutos.map((v) => Math.floor(v));
  let sobra = alvo - ints.reduce((a, b) => a + b, 0);
  brutos.map((v, i) => ({ i, f: v - Math.floor(v), p: pesos[i] }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.f - a.f)
    .forEach((x) => { if (sobra > 0) { ints[x.i] += 1; sobra -= 1; } });
  return ints;
}

const arred = (v, unidade) => (unidade === 'qtd' ? Math.ceil(v - 1e-9) : Math.round(v * 100) / 100);

export function calcularIndicadores({ meta, realizado, unidade, fator, resumo }) {
  const m = Number(meta) || 0;
  const r = Number(realizado) || 0;
  const f = Number(fator) || 1;
  const { total, decorridos, restantes } = resumo;
  const pct = m > 0 ? r / m : null;
  const esperado = total > 0 ? decorridos / total : 0;
  const projecao = decorridos > 0 ? (r / decorridos) * total : null;
  const falta = Math.max(m - r, 0);
  const faltaBruta = arred(falta * f, unidade);
  const base = restantes > 0 ? restantes : 1;
  const porDia = falta / base;
  const planejado = repartir(m, resumo.semanas.map((s) => s.dias), unidade);
  const necessario = repartir(falta, resumo.semanas.map((s) => s.restantes), unidade);
  const necessarioBruto = repartir(faltaBruta, resumo.semanas.map((s) => s.restantes), unidade);
  const semanas = resumo.semanas.map((s, i) => ({
    ...s, planejado: planejado[i], necessario: necessario[i], necessarioBruto: necessarioBruto[i],
  }));
  const semanaAtual = semanas.find((s) => s.atual && s.restantes > 0) || semanas.find((s) => s.restantes > 0) || null;
  let status = 'sem-meta';
  if (m > 0) {
    if (r >= m) status = 'batida';
    else if (resumo.encerrado) status = 'risco';
    else if (esperado === 0) status = 'inicio';
    else {
      const razao = pct / esperado;
      status = razao >= 1 ? 'em-dia' : razao >= 0.85 ? 'atencao' : 'risco';
    }
  }
  return {
    meta: m, realizado: r, pct, esperado, falta, faltaBruta, porDia,
    porDiaBruto: porDia * f, semanas, semanaAtual, status,
    projecao, projecaoPct: projecao != null && m > 0 ? projecao / m : null,
  };
}

// Divide a meta do grupo entre os colaboradores ativos.
// Quem tem meta fixa recebe o valor fixo; o restante é dividido pelo peso dos demais.
export function distribuir(metaValor, colaboradores, fixos, unidade) {
  const res = new Map();
  const comFixo = colaboradores.filter((c) => fixos.has(c.id));
  const livres = colaboradores.filter((c) => !fixos.has(c.id));
  comFixo.forEach((c) => res.set(c.id, Number(fixos.get(c.id)) || 0));
  const somaFixos = comFixo.reduce((s, c) => s + res.get(c.id), 0);
  const resto = Math.max((Number(metaValor) || 0) - somaFixos, 0);
  const somaPeso = livres.reduce((s, c) => s + (Number(c.peso) || 0), 0);
  const brutos = livres.map((c) => ({ id: c.id, v: somaPeso > 0 ? (resto * (Number(c.peso) || 0)) / somaPeso : 0 }));
  if (unidade === 'qtd') {
    // maior resto: valores inteiros que somam exatamente a meta
    const alvo = Math.round(resto);
    const base = brutos.map((b) => ({ ...b, int: Math.floor(b.v), frac: b.v - Math.floor(b.v) }));
    let sobra = alvo - base.reduce((s, b) => s + b.int, 0);
    [...base].sort((a, b) => b.frac - a.frac).forEach((b) => { if (sobra > 0 && somaPeso > 0) { b.int += 1; sobra -= 1; } });
    base.forEach((b) => res.set(b.id, b.int));
  } else {
    brutos.forEach((b) => res.set(b.id, Math.round(b.v * 100) / 100));
  }
  return { valores: res, somaFixos, resto, excedeu: somaFixos > (Number(metaValor) || 0) };
}
