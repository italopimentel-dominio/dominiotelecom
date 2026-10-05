'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sessao, podeEditar } from '@/lib/auth';
import { numero } from '@/lib/formato';
import { ultimoDiaDoMes, hojeSP } from '@/lib/datas';

const SEM_PERMISSAO = { erro: 'Seu usuário só tem permissão para visualizar.' };
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

async function editor() {
  const s = await sessao();
  return podeEditar(s.perfil) ? s.supabase : null;
}
function pronto(msg) {
  revalidatePath('/', 'layout');
  return msg ? { ok: msg } : { ok: true };
}
const txt = (fd, k) => String(fd.get(k) ?? '').trim();
const ou = (v) => (v === '' ? null : v);

// ---------- valores numéricos (edição na grade) ----------
async function gravarValor(tabela, chave, valor) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const n = numero(valor);
  if (valor !== null && valor !== '' && n === null) return { erro: 'Valor inválido.' };
  const res = n === null
    ? await db.from(tabela).delete().match(chave)
    : await db.from(tabela).upsert({ ...chave, valor: n });
  if (res.error) return { erro: res.error.message };
  return pronto();
}

const med = (m) => (m === 'brl' ? 'brl' : 'qtd');
// Produto em quantidade, em receita ou nas duas
function medidasDoForm(fd) {
  const v = String(fd.get('medidas') || fd.get('unidade') || 'qtd');
  const medidas = ['qtd', 'brl', 'ambos'].includes(v) ? v : 'qtd';
  return { medidas, unidade: medidas === 'brl' ? 'brl' : 'qtd' };
}
export async function salvarMeta(periodo_id, grupo_id, produto_id, medida, valor) {
  return gravarValor('metas', { periodo_id, grupo_id, produto_id, medida: med(medida) }, valor);
}
export async function salvarMetaIndividual(periodo_id, colaborador_id, produto_id, medida, valor) {
  return gravarValor('metas_individuais', { periodo_id, colaborador_id, produto_id, medida: med(medida) }, valor);
}
export async function salvarRealizado(periodo_id, colaborador_id, produto_id, medida, valor) {
  return gravarValor('realizados', { periodo_id, colaborador_id, produto_id, medida: med(medida) }, valor);
}
export async function salvarRealizadoGrupo(periodo_id, grupo_id, produto_id, medida, valor) {
  return gravarValor('realizados_grupo', { periodo_id, grupo_id, produto_id, medida: med(medida) }, valor);
}

export async function salvarMetaEmpresa(periodo_id, produto_id, medida, valor) {
  return gravarValor('metas_empresa', { periodo_id, produto_id, medida: med(medida) }, valor);
}

export async function salvarIndicadoresResumo(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const ids = [...new Set(fd.getAll('ind').map(String).filter(Boolean))];
  const { error } = await db.from('config').update({ resumo_produtos: ids.length ? ids : null }).eq('id', 1);
  if (error) return { erro: error.message };
  return pronto(ids.length ? `${ids.length} indicadores no resumo.` : 'Voltou para a escolha automática.');
}

export async function copiarMetasEmpresa(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const origem = txt(fd, 'origem');
  const destino = txt(fd, 'destino');
  if (!origem || origem === destino) return { erro: 'Escolha outro mês.' };
  const { data, error } = await db.from('metas_empresa').select('produto_id, valor, medida').eq('periodo_id', origem);
  if (error) return { erro: error.message };
  if (!data.length) return { erro: 'Esse mês não tem meta da empresa.' };
  const { error: e2 } = await db.from('metas_empresa').upsert(data.map((m) => ({ ...m, periodo_id: destino })));
  if (e2) return { erro: e2.message };
  return pronto(`${data.length} metas copiadas.`);
}

export async function copiarMetas(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const origem = txt(fd, 'origem');
  const destino = txt(fd, 'destino');
  if (!origem || origem === destino) return { erro: 'Escolha um período de origem diferente do atual.' };
  const { data, error } = await db.from('metas').select('grupo_id, produto_id, valor, medida').eq('periodo_id', origem);
  if (error) return { erro: error.message };
  if (!data.length) return { erro: 'O período de origem não tem metas.' };
  const { error: e2 } = await db.from('metas').upsert(data.map((m) => ({ ...m, periodo_id: destino })));
  if (e2) return { erro: e2.message };
  return pronto(`${data.length} metas copiadas.`);
}

// ---------- grupos ----------
export async function criarGrupo(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const nome = txt(fd, 'nome');
  if (!nome) return { erro: 'Informe o nome.' };
  const { data: novo, error } = await db.from('grupos').insert({ nome, parent_id: ou(txt(fd, 'parent_id')), ordem: Number(txt(fd, 'ordem')) || 0 }).select('id').single();
  if (error) return { erro: error.message };
  if (txt(fd, 'abrir') === '1') {
    revalidatePath('/', 'layout');
    redirect(`/estrutura/${novo.id}?criada=1`);
  }
  return pronto(`${nome} criado.`);
}

export async function salvarGrupo(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const id = txt(fd, 'id');
  const parent_id = ou(txt(fd, 'parent_id'));
  if (parent_id === id) return { erro: 'Um grupo não pode ficar dentro dele mesmo.' };
  const { error } = await db.from('grupos').update({ nome: txt(fd, 'nome'), parent_id, ordem: Number(txt(fd, 'ordem')) || 0 }).eq('id', id);
  if (error) return { erro: error.message };
  return pronto('Salvo.');
}

export async function alternarGrupo(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const { error } = await db.from('grupos').update({ ativo: fd.get('ativar') === '1' }).eq('id', txt(fd, 'id'));
  if (error) return { erro: error.message };
  return pronto();
}

// ---------- colaboradores ----------
export async function criarColaborador(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const nomes = txt(fd, 'nome').split('\n').map((n) => n.trim()).filter(Boolean);
  const grupo_id = txt(fd, 'grupo_id');
  const peso = numero(txt(fd, 'peso')) ?? 1;
  const data_admissao = ou(txt(fd, 'data_admissao'));
  if (!nomes.length) return { erro: 'Informe pelo menos um nome.' };
  if (!grupo_id) return { erro: 'Escolha a equipe.' };
  const { error } = await db.from('colaboradores').insert(nomes.map((nome) => ({ nome, grupo_id, peso, data_admissao })));
  if (error) return { erro: error.message };
  if (txt(fd, 'abrir') === '1') {
    revalidatePath('/', 'layout');
    redirect(`/estrutura/${grupo_id}?admitidos=${nomes.length}`);
  }
  return pronto(nomes.length === 1 ? `${nomes[0]} adicionado.` : `${nomes.length} colaboradores adicionados.`);
}

export async function salvarColaborador(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const peso = numero(txt(fd, 'peso'));
  if (peso === null || peso < 0) return { erro: 'Peso inválido.' };
  const { error } = await db.from('colaboradores')
    .update({ nome: txt(fd, 'nome'), grupo_id: txt(fd, 'grupo_id'), peso, data_admissao: ou(txt(fd, 'data_admissao')) })
    .eq('id', txt(fd, 'id'));
  if (error) return { erro: error.message };
  return pronto('Salvo.');
}

const MESES_NOME = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// Troca de equipe a partir de um mês. Os meses anteriores continuam na equipe antiga.
export async function transferirColaboradores(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const ids = [...new Set([...fd.getAll('ids'), fd.get('id')].map((x) => String(x || '')).filter(Boolean))];
  const destino = txt(fd, 'grupo_id');
  const mes = txt(fd, 'mes'); // AAAA-MM
  if (!ids.length) return { erro: 'Marque pelo menos uma pessoa.' };
  if (!destino) return { erro: 'Escolha a nova equipe.' };
  if (!/^\d{4}-\d{2}$/.test(mes)) return { erro: 'Escolha o mês em que a troca começa.' };
  const desde = `${mes}-01`;
  const mesAtual = `${hojeSP().slice(0, 7)}-01`;
  const { data: colabs, error } = await db.from('colaboradores').select('id, nome, grupo_id').in('id', ids);
  if (error) return { erro: error.message };
  const { data: vinc, error: e2 } = await db.from('colaborador_equipes').select('*').in('colaborador_id', ids);
  if (e2) return { erro: 'Rode o arquivo 016_historico_equipes.sql no Supabase antes de trocar equipes com histórico.' };
  for (const c of colabs || []) {
    const meus = (vinc || []).filter((v) => v.colaborador_id === c.id);
    // primeira troca: guarda a equipe de origem valendo para todo o passado
    if (!meus.length) {
      const { error: e3 } = await db.from('colaborador_equipes').insert({ colaborador_id: c.id, grupo_id: c.grupo_id, desde: '2000-01-01' });
      if (e3) return { erro: e3.message };
    }
    // uma troca nova substitui as que estavam marcadas para depois dela
    const depois = meus.filter((v) => v.desde > desde).map((v) => v.id);
    if (depois.length) await db.from('colaborador_equipes').delete().in('id', depois);
    const { error: e4 } = await db.from('colaborador_equipes').upsert({ colaborador_id: c.id, grupo_id: destino, desde }, { onConflict: 'colaborador_id,desde' });
    if (e4) return { erro: e4.message };
    if (desde <= mesAtual) await db.from('colaboradores').update({ grupo_id: destino }).eq('id', c.id);
  }
  const nomeMes = `${MESES_NOME[Number(mes.slice(5)) - 1]}/${mes.slice(0, 4)}`;
  return pronto(`${ids.length === 1 ? 'Troca registrada' : `${ids.length} trocas registradas`}: vale a partir de ${nomeMes}. Os meses anteriores continuam na equipe antiga.`);
}

export async function desfazerTransferencia(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const { data: v } = await db.from('colaborador_equipes').select('*').eq('id', txt(fd, 'id')).maybeSingle();
  if (!v) return { erro: 'Troca não encontrada.' };
  const { error } = await db.from('colaborador_equipes').delete().eq('id', v.id);
  if (error) return { erro: error.message };
  // volta a equipe "base" para a do vínculo que ficou valendo hoje
  const { data: resto } = await db.from('colaborador_equipes').select('*').eq('colaborador_id', v.colaborador_id).lte('desde', hojeSP()).order('desde');
  const vigente = (resto || []).at(-1);
  if (vigente) await db.from('colaboradores').update({ grupo_id: vigente.grupo_id }).eq('id', v.colaborador_id);
  return pronto('Troca desfeita.');
}

export async function alternarColaborador(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const ativar = fd.get('ativar') === '1';
  const data = txt(fd, 'data_desligamento');
  if (!ativar && !data) return { erro: 'Informe a data de desligamento.' };
  const { error } = await db.from('colaboradores')
    .update(ativar ? { ativo: true, data_desligamento: null } : { ativo: false, data_desligamento: data })
    .eq('id', txt(fd, 'id'));
  if (error) return { erro: error.message };
  return pronto();
}

// ---------- produtos ----------
export async function criarProduto(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const nome = txt(fd, 'nome');
  if (!nome) return { erro: 'Informe o nome.' };
  const tipo = txt(fd, 'tipo') === 'composto' ? 'composto' : 'simples';
  const { error } = await db.from('produtos').insert({
    nome, tipo, ...medidasDoForm(fd), ciclo: (txt(fd, 'ciclo') || 'GERAL').toUpperCase(), ordem: Number(txt(fd, 'ordem')) || 0,
  });
  if (error) return { erro: error.message };
  return pronto(tipo === 'composto' ? `${nome} criado. Agora escolha quais produtos entram na soma.` : `${nome} criado.`);
}

export async function salvarComposicao(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const produto_id = txt(fd, 'produto_id');
  const ids = [...new Set(fd.getAll('comp').map(String).filter((x) => x && x !== produto_id))];
  const linhas = ids.map((componente_id) => ({ produto_id, componente_id, peso: numero(txt(fd, `peso_${componente_id}`)) || 1 }));
  if (linhas.some((l) => l.peso <= 0)) return { erro: 'O peso precisa ser maior que zero.' };
  const { error: e1 } = await db.from('produto_componentes').delete().eq('produto_id', produto_id);
  if (e1) return { erro: e1.message };
  if (linhas.length) {
    const { error } = await db.from('produto_componentes').insert(linhas);
    if (error) return { erro: error.message };
  }
  return pronto(linhas.length ? `Soma salva com ${linhas.length} produtos.` : 'Nenhum produto marcado: a soma ficou vazia.');
}

export async function salvarProduto(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const { error } = await db.from('produtos').update({
    nome: txt(fd, 'nome'), ...medidasDoForm(fd), ciclo: txt(fd, 'ciclo').toUpperCase(), ordem: Number(txt(fd, 'ordem')) || 0,
  }).eq('id', txt(fd, 'id'));
  if (error) return { erro: error.message };
  return pronto('Salvo.');
}

export async function alternarProduto(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const { error } = await db.from('produtos').update({ ativo: fd.get('ativar') === '1' }).eq('id', txt(fd, 'id'));
  if (error) return { erro: error.message };
  return pronto();
}

// ---------- períodos e ciclos ----------
export async function criarPeriodo(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const mes = txt(fd, 'mes'); // AAAA-MM
  if (!/^\d{4}-\d{2}$/.test(mes)) return { erro: 'Escolha o mês.' };
  const referencia = `${mes}-01`;
  const fim = ultimoDiaDoMes(referencia);
  const fator = 1 + (numero(txt(fd, 'acrescimo')) ?? 30) / 100;
  const nome = `${MESES[Number(mes.slice(5)) - 1]} ${mes.slice(0, 4)}`;
  const { data: per, error } = await db.from('periodos').insert({ nome, referencia, fator_bruto: fator }).select().single();
  if (error) return { erro: error.message.includes('duplicate') ? 'Esse mês já foi cadastrado.' : error.message };
  const { data: prods } = await db.from('produtos').select('ciclo').eq('ativo', true);
  const codigos = [...new Set((prods || []).map((p) => p.ciclo))];
  if (!codigos.length) codigos.push('GERAL');
  await db.from('ciclos').insert(codigos.map((c) => ({
    periodo_id: per.id, codigo: c, nome: c === 'GERAL' ? 'Fechamento geral' : `Fechamento ${c.toLowerCase()}`,
    data_inicio: referencia, data_fim: fim,
  })));
  const origem = txt(fd, 'copiar_de');
  if (origem) {
    const { data: metas } = await db.from('metas').select('grupo_id, produto_id, valor, medida').eq('periodo_id', origem);
    if (metas?.length) await db.from('metas').insert(metas.map((m) => ({ ...m, periodo_id: per.id })));
    const { data: fixas } = await db.from('metas_individuais').select('colaborador_id, produto_id, valor, medida').eq('periodo_id', origem);
    if (fixas?.length) await db.from('metas_individuais').insert(fixas.map((m) => ({ ...m, periodo_id: per.id })));
  }
  if (txt(fd, 'voltar') === 'metas') {
    revalidatePath('/', 'layout');
    redirect(`/metas?p=${per.id}`);
  }
  return pronto(`${nome} criado.`);
}

export async function salvarPeriodo(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const acrescimo = numero(txt(fd, 'acrescimo'));
  if (acrescimo === null || acrescimo < 0) return { erro: 'Acréscimo inválido.' };
  const { error } = await db.from('periodos').update({ nome: txt(fd, 'nome'), fator_bruto: 1 + acrescimo / 100 }).eq('id', txt(fd, 'id'));
  if (error) return { erro: error.message };
  return pronto('Salvo.');
}

export async function salvarCiclo(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const dados = { nome: txt(fd, 'nome'), data_inicio: txt(fd, 'data_inicio'), data_fim: txt(fd, 'data_fim') };
  if (!dados.data_inicio || !dados.data_fim || dados.data_fim < dados.data_inicio) return { erro: 'Confira as datas do fechamento.' };
  const id = txt(fd, 'id');
  const res = id
    ? await db.from('ciclos').update(dados).eq('id', id)
    : await db.from('ciclos').insert({ ...dados, periodo_id: txt(fd, 'periodo_id'), codigo: txt(fd, 'codigo').toUpperCase() });
  if (res.error) return { erro: res.error.message.includes('duplicate') ? 'Já existe um fechamento com esse código.' : res.error.message };
  return pronto('Salvo.');
}

// ---------- feriados e calendário ----------
export async function criarFeriado(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const data = txt(fd, 'data');
  const nome = txt(fd, 'nome');
  if (!data || !nome) return { erro: 'Informe a data e o nome.' };
  const { error } = await db.from('feriados').insert({ data, nome, tipo: txt(fd, 'tipo') || 'feriado', grupo_id: ou(txt(fd, 'grupo_id')) });
  if (error) return { erro: error.message };
  return pronto(`${nome} cadastrado.`);
}

export async function excluirFeriado(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const { error } = await db.from('feriados').delete().eq('id', txt(fd, 'id'));
  if (error) return { erro: error.message };
  return pronto();
}

export async function salvarConfig(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const { error } = await db.from('config').update({
    sabado_util: fd.get('sabado_util') === 'on',
    feriado_carnaval: fd.get('feriado_carnaval') === 'on',
    feriado_corpus_christi: fd.get('feriado_corpus_christi') === 'on',
  }).eq('id', 1);
  if (error) return { erro: error.message };
  return pronto('Calendário salvo.');
}
