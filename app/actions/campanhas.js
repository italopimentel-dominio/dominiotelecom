'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sessao, podeEditar } from '@/lib/auth';
import { numero } from '@/lib/formato';

const SEM_PERMISSAO = { erro: 'Seu usuário só tem permissão para visualizar.' };
const txt = (fd, k) => String(fd.get(k) ?? '').trim();
const ou = (v) => (v === '' ? null : v);
async function editor() {
  const s = await sessao();
  return podeEditar(s.perfil) ? s.supabase : null;
}
const atualizar = () => { revalidatePath('/campanhas', 'layout'); revalidatePath('/tv', 'layout'); };

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
  const { error } = await db.from('campanha_itens').delete().eq('id', txt(fd, 'id'));
  if (error) return { erro: error.message };
  atualizar();
  return { ok: true };
}

export async function adicionarParticipantes(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const campanha_id = txt(fd, 'campanha_id');
  const { data: camp } = await db.from('campanhas').select('participacao').eq('id', campanha_id).single();
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
  const { error } = await db.from('campanha_participantes').delete().eq('id', txt(fd, 'id'));
  if (error) return { erro: error.message };
  atualizar();
  return { ok: true };
}

export async function salvarResultadoCampanha(participante_id, item_id, valor) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const n = numero(valor);
  if (valor !== null && valor !== '' && n === null) return { erro: 'Valor inválido.' };
  const res = n === null
    ? await db.from('campanha_resultados').delete().match({ participante_id, item_id })
    : await db.from('campanha_resultados').upsert({ participante_id, item_id, valor: n, atualizado_em: new Date().toISOString() });
  if (res.error) return { erro: res.error.message };
  atualizar();
  return { ok: true };
}
