'use server';
import { revalidatePath } from 'next/cache';
import { sessao, podeEditar } from '@/lib/auth';
import { normalizar } from '@/lib/nomes';
import { linkExportacao, MODELOS } from '@/lib/fontes';
import { montarLeitura, gravarLeitura } from '@/lib/fontesServidor';
import { rodarFonteAutomatica } from '@/lib/fontesAuto';

const SEM_PERMISSAO = { erro: 'Seu usuário só tem permissão para visualizar.' };
const txt = (fd, k) => String(fd.get(k) ?? '').trim();

async function editor() {
  const s = await sessao();
  return podeEditar(s.perfil) ? s : null;
}

export async function salvarFonte(_prev, fd) {
  const s = await editor();
  if (!s) return SEM_PERMISSAO;
  const id = txt(fd, 'id');
  const url = txt(fd, 'url');
  if (!txt(fd, 'nome')) return { erro: 'Dê um nome para a fonte.' };
  if (!linkExportacao(url)) return { erro: 'Cole o link da planilha do Google (docs.google.com/spreadsheets/...).' };
  const modelo = MODELOS[txt(fd, 'modelo')] ? txt(fd, 'modelo') : 'pedidos_movel';
  const config = {};
  Object.keys(MODELOS[modelo].destinos).forEach((d) => { config[d] = txt(fd, `produto_${d}`) || null; });
  const dados = { nome: txt(fd, 'nome'), url, modelo, config, atualizado_em: new Date().toISOString() };
  const res = id ? await s.supabase.from('fontes_dados').update(dados).eq('id', id) : await s.supabase.from('fontes_dados').insert(dados);
  if (res.error) return { erro: res.error.message.includes('fontes_dados') ? 'Rode o arquivo 017_fonte_dados.sql no Supabase.' : res.error.message };
  revalidatePath('/fontes');
  return { ok: id ? 'Fonte salva.' : 'Fonte cadastrada. Agora clique em "Ler planilha".' };
}

export async function excluirFonte(_prev, fd) {
  const s = await editor();
  if (!s) return SEM_PERMISSAO;
  const { error } = await s.supabase.from('fontes_dados').delete().eq('id', txt(fd, 'id'));
  if (error) return { erro: error.message };
  revalidatePath('/fontes');
  return { ok: true };
}

// Lê a planilha e devolve a prévia (não grava nada)
export async function lerFonte(fonteId) {
  const s = await editor();
  if (!s) return SEM_PERMISSAO;
  const { data: fonte } = await s.supabase.from('fontes_dados').select('*').eq('id', fonteId).maybeSingle();
  if (!fonte) return { erro: 'Fonte não encontrada.' };
  return montarLeitura(s.supabase, fonte);
}

// Grava o que foi conferido na tela (ver gravarLeitura em lib/fontesServidor.js)
export async function aplicarFonte(dados) {
  const s = await editor();
  if (!s) return SEM_PERMISSAO;
  const r = await gravarLeitura(s.supabase, dados);
  revalidatePath('/', 'layout');
  return r;
}

export async function desfazerSincronizacao(_prev, fd) {
  const s = await editor();
  if (!s) return SEM_PERMISSAO;
  const db = s.supabase;
  const { data: sinc } = await db.from('sincronizacoes').select('*').eq('id', txt(fd, 'id')).maybeSingle();
  if (!sinc || sinc.desfeita_em) return { erro: 'Essa gravação já foi desfeita ou não existe.' };
  const { data: depoisDela } = await db.from('sincronizacoes').select('id, meses').eq('fonte_id', sinc.fonte_id).is('desfeita_em', null).gt('executado_em', sinc.executado_em);
  if ((depoisDela || []).length) return { erro: 'Houve gravações depois desta. Desfaça a mais recente primeiro.' };
  const perIds = [...new Set([...(sinc.antes || []), ...(sinc.depois || [])].map((x) => x.periodo_id))];
  const { data: pers } = await db.from('periodos').select('id, nome, fechado').in('id', perIds.length ? perIds : ['00000000-0000-0000-0000-000000000000']);
  if ((pers || []).some((p) => p.fechado)) return { erro: 'Um dos meses desta gravação foi fechado. Reabra o mês para desfazer.' };
  const tabelaDe = (v) => (v.tabela === 'grupo' ? 'realizados_grupo' : 'realizados');
  const limpar = ({ tabela, ...v }) => v;
  for (const v of sinc.depois || []) {
    const chaveV = v.tabela === 'grupo' ? { grupo_id: v.grupo_id } : { colaborador_id: v.colaborador_id };
    await db.from(tabelaDe(v)).delete().match({ periodo_id: v.periodo_id, ...chaveV, produto_id: v.produto_id, medida: v.medida });
  }
  for (const t of ['realizados', 'realizados_grupo']) {
    const lista = (sinc.antes || []).filter((v) => tabelaDe(v) === t).map(limpar);
    for (let i = 0; i < lista.length; i += 500) {
      const { error } = await db.from(t).upsert(lista.slice(i, i + 500));
      if (error) return { erro: error.message };
    }
  }
  await db.from('sincronizacoes').update({ desfeita_em: new Date().toISOString(), desfeita_por: s.user.id }).eq('id', sinc.id);
  await db.rpc('desfazer_vendas_parceiros', { p_sinc: sinc.id });
  // vendas linha a linha: apaga as desta gravação e devolve as que ela tinha substituído
  await db.from('vendas_linhas').delete().eq('sincronizacao_id', sinc.id);
  await db.from('vendas_linhas').update({ substituida_por: null }).eq('substituida_por', sinc.id); // solta as vendas de parceiros que esta gravação vinculou
  revalidatePath('/', 'layout');
  return { ok: 'Desfeito: os valores voltaram a ser os de antes desta gravação.' };
}

export async function alternarMesFechado(_prev, fd) {
  const s = await editor();
  if (!s) return SEM_PERMISSAO;
  const fechar = fd.get('fechar') === '1';
  const { error } = await s.supabase.from('periodos').update({ fechado: fechar }).eq('id', txt(fd, 'id'));
  if (error) return { erro: error.message.includes('fechado') ? 'Rode o arquivo 017_fonte_dados.sql no Supabase.' : error.message };
  revalidatePath('/', 'layout');
  return { ok: fechar ? 'Mês fechado: nenhuma leitura de planilha altera mais este mês.' : 'Mês reaberto.' };
}

// Pausa ou ativa a atualização automática (vale para todas as fontes)
export async function alternarAutomatico(_prev, fd) {
  const s = await editor();
  if (!s) return SEM_PERMISSAO;
  const ativo = fd.get('ativo') === '1';
  const { error } = await s.supabase.from('config_sistema')
    .upsert({ chave: 'fontes_auto', valor: { ativo }, atualizado_em: new Date().toISOString(), atualizado_por: s.user.id });
  if (error) return { erro: error.message.includes('config_sistema') ? 'Rode o arquivo 030_pausar_automatico.sql no Supabase.' : error.message };
  revalidatePath('/', 'layout');
  return { ok: ativo ? 'Atualização automática ativada.' : 'Atualização automática pausada. Os botões continuam funcionando.' };
}

// Roda a atualização automática agora (para testar ou adiantar), mesmo se estiver pausada
export async function rodarAutomaticoAgora(_prev) {
  const s = await editor();
  if (!s) return SEM_PERMISSAO;
  const { data: fontes } = await s.supabase.from('fontes_dados').select('*').eq('ativo', true).order('criado_em');
  const linhas = [];
  for (const f of fontes || []) {
    try {
      const r = await rodarFonteAutomatica(s.supabase, f);
      const st = { gravado: 'gravado', sem_mudanca: 'sem mudanças', sem_mes: 'sem vendas do mês atual', fechado: 'mês fechado', erro: 'erro' }[r.status] || r.status;
      linhas.push(`${f.nome}: ${st}${r.pendentes ? ` (${r.pendentes} nomes pendentes)` : ''}${r.msg ? ` — ${r.msg}` : ''}`);
    } catch (e) {
      linhas.push(`${f.nome}: erro — ${e.message}`);
    }
  }
  revalidatePath('/', 'layout');
  return { ok: linhas.length ? `Rodada concluída. ${linhas.join(' · ')}` : 'Nenhuma fonte cadastrada.' };
}
