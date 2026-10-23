'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sessao, podeEditar } from '@/lib/auth';
import { numero } from '@/lib/formato';
import { regraValida, OPERADORES } from '@/lib/campanhaRegras';
import { periodoCampanha, linhasDoPeriodo, distribuirItem, carregarCampanha } from '@/lib/campanhasDados';

const SEM_PERMISSAO = { erro: 'Seu usuário só tem permissão para visualizar.' };
const txt = (fd, k) => String(fd.get(k) ?? '').trim();
const ou = (v) => (v === '' ? null : v);
async function editor() {
  const s = await sessao();
  return podeEditar(s.perfil) ? s.supabase : null;
}
const atualizar = () => { revalidatePath('/campanhas', 'layout'); revalidatePath('/tv', 'layout'); };

// Campanha fechada não aceita mudanças (resultados, itens, regras, participantes)
const FECHADA = { erro: 'Campanha fechada: reabra a campanha para alterar.' };
async function estaFechada(db, { campanha_id, item_id, participante_id }) {
  let id = campanha_id;
  if (!id && item_id) id = (await db.from('campanha_itens').select('campanha_id').eq('id', item_id).maybeSingle()).data?.campanha_id;
  if (!id && participante_id) id = (await db.from('campanha_participantes').select('campanha_id').eq('id', participante_id).maybeSingle()).data?.campanha_id;
  if (!id) return false;
  const { data } = await db.from('campanhas').select('fechada_em').eq('id', id).maybeSingle();
  return !!data?.fechada_em;
}

function dadosCampanha(fd) {
  return {
    nome: txt(fd, 'nome'),
    regras: ou(txt(fd, 'regras')),
    premio: ou(txt(fd, 'premio')),
    data_inicio: txt(fd, 'data_inicio'),
    data_fim: txt(fd, 'data_fim'),
    tema: txt(fd, 'tema') || 'corrida',
    participacao: txt(fd, 'participacao') || 'colaborador',
    modo: txt(fd, 'modo') || 'individual',
  };
}
function validar(d) {
  if (!d.nome) return 'Dê um nome para a campanha.';
  if (!d.data_inicio || !d.data_fim || d.data_fim < d.data_inicio) return 'Confira as datas de início e fim.';
  return null;
}

export async function criarCampanha(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const dados = dadosCampanha(fd);
  const erro = validar(dados);
  if (erro) return { erro };
  const itens = [];
  for (let i = 0; i < 6; i++) {
    const nome = txt(fd, `item_nome_${i}`);
    const alvo = numero(txt(fd, `item_alvo_${i}`));
    if (nome && alvo > 0) itens.push({ nome, alvo, unidade: txt(fd, `item_unidade_${i}`) || 'qtd', ordem: i });
  }
  if (!itens.length) return { erro: 'Inclua pelo menos um item com alvo (ex.: Móveis, 10).' };
  const { data, error } = await db.from('campanhas').insert(dados).select('id').single();
  if (error) return { erro: error.message };
  const { error: e2 } = await db.from('campanha_itens').insert(itens.map((it) => ({ ...it, campanha_id: data.id })));
  if (e2) return { erro: e2.message };
  atualizar();
  redirect(`/campanhas/${data.id}`);
}

export async function salvarCampanha(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const dados = dadosCampanha(fd);
  const erro = validar(dados);
  if (erro) return { erro };
  const { error } = await db.from('campanhas').update(dados).eq('id', txt(fd, 'id'));
  if (error) return { erro: error.message };
  atualizar();
  return { ok: 'Campanha salva.' };
}

export async function excluirCampanha(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const { error } = await db.from('campanhas').delete().eq('id', txt(fd, 'id'));
  if (error) return { erro: error.message };
  atualizar();
  redirect('/campanhas');
}

export async function salvarItem(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const id = txt(fd, 'id');
  const dados = { nome: txt(fd, 'nome'), alvo: numero(txt(fd, 'alvo')), unidade: txt(fd, 'unidade') || 'qtd', ordem: Number(txt(fd, 'ordem')) || 0 };
  if (!dados.nome || !(dados.alvo > 0)) return { erro: 'Informe o nome e um alvo maior que zero.' };
  if (await estaFechada(db, { item_id: id || null, campanha_id: id ? null : txt(fd, 'campanha_id') })) return FECHADA;
  const res = id
    ? await db.from('campanha_itens').update(dados).eq('id', id)
    : await db.from('campanha_itens').insert({ ...dados, campanha_id: txt(fd, 'campanha_id') });
  if (res.error) return { erro: res.error.message };
  atualizar();
  return { ok: id ? 'Salvo.' : `${dados.nome} incluído.` };
}

export async function excluirItem(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  if (await estaFechada(db, { item_id: txt(fd, 'id') })) return FECHADA;
  const { error } = await db.from('campanha_itens').delete().eq('id', txt(fd, 'id'));
  if (error) return { erro: error.message };
  atualizar();
  return { ok: true };
}

export async function adicionarParticipantes(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const campanha_id = txt(fd, 'campanha_id');
  const { data: camp } = await db.from('campanhas').select('participacao, fechada_em').eq('id', campanha_id).single();
  if (camp?.fechada_em) return FECHADA;
  const grupo = txt(fd, 'grupo_id');
  const colab = txt(fd, 'colaborador_id');
  let linhas = [];
  if (camp.participacao === 'equipe') {
    if (!grupo) return { erro: 'Escolha a equipe.' };
    linhas = [{ campanha_id, grupo_id: grupo }];
  } else if (colab) {
    linhas = [{ campanha_id, colaborador_id: colab }];
  } else if (grupo) {
    // todos os colaboradores ativos da equipe e das equipes abaixo dela
    const { data: grupos } = await db.from('grupos').select('id, parent_id');
    const ids = new Set([grupo]);
    let mudou = true;
    while (mudou) { mudou = false; (grupos || []).forEach((g) => { if (g.parent_id && ids.has(g.parent_id) && !ids.has(g.id)) { ids.add(g.id); mudou = true; } }); }
    const { data: colabs } = await db.from('colaboradores').select('id').eq('ativo', true).in('grupo_id', [...ids]);
    linhas = (colabs || []).map((c) => ({ campanha_id, colaborador_id: c.id }));
  } else return { erro: 'Escolha uma equipe ou um colaborador.' };
  if (!linhas.length) return { erro: 'Nenhum colaborador ativo nessa equipe.' };
  const conflito = camp.participacao === 'equipe' ? 'campanha_id,grupo_id' : 'campanha_id,colaborador_id';
  const { error } = await db.from('campanha_participantes').upsert(linhas, { onConflict: conflito, ignoreDuplicates: true });
  if (error) return { erro: error.message };
  atualizar();
  return { ok: linhas.length === 1 ? 'Participante incluído.' : `${linhas.length} participantes incluídos.` };
}

export async function removerParticipante(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  if (await estaFechada(db, { participante_id: txt(fd, 'id') })) return FECHADA;
  const { error } = await db.from('campanha_participantes').delete().eq('id', txt(fd, 'id'));
  if (error) return { erro: error.message };
  atualizar();
  return { ok: true };
}

export async function salvarResultadoCampanha(participante_id, item_id, valor) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  if (await estaFechada(db, { participante_id })) return FECHADA;
  const n = numero(valor);
  if (valor !== null && valor !== '' && n === null) return { erro: 'Valor inválido.' };
  const res = n === null
    ? await db.from('campanha_resultados').delete().match({ participante_id, item_id })
    : await db.from('campanha_resultados').upsert({ participante_id, item_id, valor: n, atualizado_em: new Date().toISOString() });
  if (res.error) return { erro: res.error.message };
  atualizar();
  return { ok: true };
}


// ---------- Itens automáticos (regra sobre as planilhas) ----------
const OPS = new Set(OPERADORES.map((o) => o.id));
const curto = (v, n = 200) => String(v ?? '').trim().slice(0, n);
function limparRegra(regra) {
  if (!regra) return null;
  const fontes = (Array.isArray(regra.fontes) ? regra.fontes : []).slice(0, 6).filter((f) => f?.fonte_id).map((f) => ({
    fonte_id: curto(f.fonte_id, 60),
    condicoes: (Array.isArray(f.condicoes) ? f.condicoes : []).slice(0, 12)
      .filter((c) => c?.campo && OPS.has(c.op))
      .map((c) => ({ campo: curto(c.campo), op: c.op, valores: (Array.isArray(c.valores) ? c.valores : []).map((v) => curto(v)).filter(Boolean).slice(0, 300) })),
    soma: f.soma ? curto(f.soma) : null,
  }));
  return { fontes, medida: regra.medida === 'soma' ? 'soma' : 'pedidos' };
}

// regra = null volta o item para "lançado à mão"
export async function salvarRegraItem(item_id, regra) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  if (await estaFechada(db, { item_id })) return FECHADA;
  const r = limparRegra(regra);
  if (r && !regraValida(r)) return { erro: 'Escolha pelo menos uma fonte.' };
  if (r && r.medida === 'soma' && r.fontes.some((f) => !f.soma)) return { erro: 'Escolha a coluna a somar em cada fonte.' };
  const { error } = await db.from('campanha_itens').update({ regra: r }).eq('id', item_id);
  if (error) return { erro: /regra/.test(error.message) ? 'Rode o 047_campanha_itens_regra.sql no Supabase.' : error.message };
  atualizar();
  return { ok: r ? 'Regra salva. O resultado deste item agora vem das planilhas.' : 'Item voltou a ser lançado à mão.' };
}

// Colunas da planilha da fonte, com os valores mais frequentes (para montar as condições)
export async function camposDaFonte(fonte_id) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const { data, error } = await db.from('fontes_campos').select('coluna, ordem, muitos, distintos, valores, atualizado_em').eq('fonte_id', fonte_id).order('ordem');
  if (error) return { erro: /fontes_campos/.test(error.message) ? 'Rode o 045_campanhas.sql no Supabase.' : error.message };
  if (!data?.length) return { erro: 'Ainda não há colunas desta fonte. Clique em "Rodar agora" na tela de fontes e tente de novo.' };
  return { campos: data.map((c) => ({ coluna: c.coluna, muitos: c.muitos, distintos: c.distintos, valores: (c.valores || []).slice(0, 200) })), atualizado: data[0].atualizado_em };
}

// Prévia: quanto a regra daria hoje, no período da campanha (ou no filtro de datas)
export async function previaRegra(campanha_id, regra, filtro = {}) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const r = limparRegra(regra);
  if (!regraValida(r)) return { erro: 'Escolha pelo menos uma fonte.' };
  const [{ data: campanha }, { data: parts }, { data: colabs }, { data: grupos }] = await Promise.all([
    db.from('campanhas').select('*').eq('id', campanha_id).maybeSingle(),
    db.from('campanha_participantes').select('*').eq('campanha_id', campanha_id),
    db.from('colaboradores').select('id, grupo_id'),
    db.from('grupos').select('id, parent_id'),
  ]);
  if (!campanha) return { erro: 'Campanha não encontrada.' };
  const periodo = periodoCampanha(campanha, filtro);
  const { linhas, erro } = await linhasDoPeriodo(db, r.fontes.map((f) => f.fonte_id), periodo.de, periodo.ate);
  if (erro) return { erro };
  const { valores, diag } = distribuirItem(campanha, r, linhas, parts || [], colabs || [], grupos || []);
  return { ok: true, ...diag, comResultado: valores.size, participantes: (parts || []).length, periodo, linhasLidas: linhas.length };
}


// ---------- Fechar e reabrir ----------
// Fechar grava a foto dos itens automáticos (valores por participante) e trava a campanha:
// ela para de ser atualizada pelas planilhas e não aceita mais lançamentos.
export async function fecharCampanha(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const id = txt(fd, 'id');
  const d = await carregarCampanha(db, id);
  if (!d) return { erro: 'Campanha não encontrada.' };
  if (d.campanha.fechada_em) return { erro: 'A campanha já está fechada.' };
  if (d.erroAuto) return { erro: `Não deu para ler os itens automáticos: ${d.erroAuto}` };
  const valores = {};
  d.resultados.filter((r) => r.automatico).forEach((r) => { (valores[r.item_id] ||= {})[r.participante_id] = Number(r.valor) || 0; });
  const agora = new Date().toISOString();
  const { error } = await db.from('campanhas').update({
    fechada_em: agora,
    resultado_fechado: { valores, automatico: d.automatico, periodo: d.periodo, gravado_em: agora },
  }).eq('id', id);
  if (error) return { erro: /fechada_em|resultado_fechado/.test(error.message) ? 'Rode o 048_campanhas_fechar.sql no Supabase.' : error.message };
  atualizar();
  return { ok: 'Campanha fechada. Os resultados ficaram congelados.' };
}

export async function reabrirCampanha(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const { error } = await db.from('campanhas').update({ fechada_em: null, resultado_fechado: null }).eq('id', txt(fd, 'id'));
  if (error) return { erro: error.message };
  atualizar();
  return { ok: 'Campanha reaberta. Os itens automáticos voltam a ler as planilhas.' };
}
