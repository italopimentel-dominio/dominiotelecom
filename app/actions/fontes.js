'use server';
import { revalidatePath } from 'next/cache';
import { sessao, podeEditar } from '@/lib/auth';
import { normalizar } from '@/lib/nomes';
import { linkExportacao, lerPedidos, MODELOS } from '@/lib/fontes';
import { classificarNome } from '@/lib/conferenciaNomes';
import { temMedida } from '@/lib/medida';

const SEM_PERMISSAO = { erro: 'Seu usuário só tem permissão para visualizar.' };
const txt = (fd, k) => String(fd.get(k) ?? '').trim();

async function editor() {
  const s = await sessao();
  return podeEditar(s.perfil) ? s : null;
}

async function todos(consulta) {
  const tudo = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await consulta().range(de, de + 999);
    if (error) return { error };
    tudo.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return { data: tudo };
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
  const db = s.supabase;
  const { data: fonte } = await db.from('fontes_dados').select('*').eq('id', fonteId).maybeSingle();
  if (!fonte) return { erro: 'Fonte não encontrada.' };
  const modelo = MODELOS[fonte.modelo] || MODELOS.pedidos_movel;
  const link = linkExportacao(fonte.url);
  if (!link) return { erro: 'Link inválido.' };

  let texto;
  try {
    const r = await fetch(link, { cache: 'no-store', redirect: 'follow' });
    const tipo = r.headers.get('content-type') || '';
    if (!r.ok || tipo.includes('text/html')) return { erro: 'Não consegui abrir a planilha. Confira se ela está compartilhada como "Qualquer pessoa com o link pode ver".' };
    texto = await r.text();
  } catch {
    return { erro: 'Não consegui acessar o Google agora. Tente de novo em alguns minutos.' };
  }
  const XLSX = await import('xlsx');
  const wb = XLSX.read(texto, { type: 'string', raw: true });
  const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null, blankrows: false });
  const lido = lerPedidos(linhas, modelo);
  if (lido.erro) return { erro: lido.erro };

  const [{ data: colabs }, { data: apelidos }, { data: periodos }, { data: produtos }] = await Promise.all([
    db.from('colaboradores').select('id, nome, ativo, grupo_id'),
    db.from('colaborador_apelidos').select('apelido, colaborador_id'),
    db.from('periodos').select('id, nome, referencia, fechado'),
    db.from('produtos').select('id, nome, medidas, unidade'),
  ]);
  const mapaApelidos = new Map((apelidos || []).map((a) => [a.apelido, a.colaborador_id]));
  const ctx = { colaboradores: colabs || [], mapaApelidos, grupos: [] };
  const pessoas = lido.pessoas.map((p) => ({ ...p, chave: normalizar(p.nome), ...classificarNome(p.nome, p.equipe, ctx) }));

  const meses = lido.meses.map((m) => {
    const per = (periodos || []).find((p) => p.referencia.startsWith(m));
    return { mes: m, periodo: per ? { id: per.id, nome: per.nome, fechado: !!per.fechado } : null };
  });
  const destinos = {};
  Object.entries(modelo.destinos).forEach(([d, rotulo]) => {
    const p = (produtos || []).find((x) => x.id === fonte.config?.[d]);
    destinos[d] = { rotulo, produto: p ? { id: p.id, nome: p.nome, qtd: temMedida(p, 'qtd'), brl: temMedida(p, 'brl') } : null };
  });

  // valores que já estão no sistema, para mostrar o que muda
  const idsPer = meses.filter((m) => m.periodo).map((m) => m.periodo.id);
  const idsProd = Object.values(destinos).filter((d) => d.produto).map((d) => d.produto.id);
  let atuais = [];
  if (idsPer.length && idsProd.length) {
    const r = await todos(() => db.from('realizados').select('periodo_id, colaborador_id, produto_id, medida, valor').in('periodo_id', idsPer).in('produto_id', idsProd).order('colaborador_id'));
    atuais = r.data || [];
  }
  return {
    ok: true,
    lidoEm: new Date().toISOString(),
    pessoas, meses, destinos, atuais,
    pendencias: lido.pendencias, contagem: lido.contagem,
    colaboradores: (colabs || []).map((c) => ({ id: c.id, nome: c.nome, ativo: c.ativo })).sort((a, b) => a.nome.localeCompare(b.nome)),
  };
}

// Grava: em cada mês escolhido, os produtos da fonte passam a ser exatamente o que está na planilha.
// Guarda os valores de antes para poder desfazer.
export async function aplicarFonte(dados) {
  const s = await editor();
  if (!s) return SEM_PERMISSAO;
  const db = s.supabase;
  const { fonte_id, url, periodos: idsPer = [], valores = [], escopo = [], apelidos = [], resumo = {} } = dados || {};
  if (!idsPer.length) return { erro: 'Marque pelo menos um mês.' };
  if (!escopo.length) return { erro: 'Ligue os resultados aos produtos do sistema.' };
  const { data: pers } = await db.from('periodos').select('id, nome, fechado').in('id', idsPer);
  const fechados = (pers || []).filter((p) => p.fechado);
  if (fechados.length) return { erro: `Mês fechado não pode ser alterado: ${fechados.map((p) => p.nome).join(', ')}.` };

  const idsProd = [...new Set(escopo.map((e) => e.produto_id))];
  const noEscopo = (r) => escopo.some((e) => e.produto_id === r.produto_id && e.medida === r.medida);
  const r = await todos(() => db.from('realizados').select('periodo_id, colaborador_id, produto_id, medida, valor').in('periodo_id', idsPer).in('produto_id', idsProd).order('colaborador_id'));
  if (r.error) return { erro: r.error.message };
  const antes = (r.data || []).filter(noEscopo);
  const depois = valores.filter((v) => idsPer.includes(v.periodo_id) && noEscopo(v) && Number(v.valor) !== 0)
    .map((v) => ({ periodo_id: v.periodo_id, colaborador_id: v.colaborador_id, produto_id: v.produto_id, medida: v.medida, valor: Math.round(Number(v.valor) * 100) / 100 }));

  // registra antes de mexer (se falhar no meio, dá para desfazer)
  const { data: sinc, error: e0 } = await db.from('sincronizacoes').insert({
    fonte_id, url, meses: (pers || []).map((p) => p.nome), resumo, antes, depois,
  }).select('id').single();
  if (e0) return { erro: e0.message.includes('sincronizacoes') ? 'Rode o arquivo 017_fonte_dados.sql no Supabase.' : e0.message };

  for (const pid of idsPer) {
    for (const e of escopo) {
      const { error } = await db.from('realizados').delete().eq('periodo_id', pid).eq('produto_id', e.produto_id).eq('medida', e.medida);
      if (error) return { erro: `Erro ao limpar valores antigos: ${error.message}` };
    }
  }
  for (let i = 0; i < depois.length; i += 500) {
    const { error } = await db.from('realizados').upsert(depois.slice(i, i + 500));
    if (error) return { erro: `Erro ao gravar: ${error.message}. Use "Desfazer" na última leitura para voltar.` };
  }
  if (apelidos.length) {
    await db.from('colaborador_apelidos').upsert(apelidos.map((a) => ({ apelido: normalizar(a.apelido), colaborador_id: a.colaborador_id })));
  }
  revalidatePath('/', 'layout');
  return { ok: `Gravado: ${depois.length} valores em ${(pers || []).map((p) => p.nome).join(', ')}.`, id: sinc.id };
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
  for (const v of sinc.depois || []) {
    await db.from('realizados').delete().match({ periodo_id: v.periodo_id, colaborador_id: v.colaborador_id, produto_id: v.produto_id, medida: v.medida });
  }
  for (let i = 0; i < (sinc.antes || []).length; i += 500) {
    const { error } = await db.from('realizados').upsert(sinc.antes.slice(i, i + 500));
    if (error) return { erro: error.message };
  }
  await db.from('sincronizacoes').update({ desfeita_em: new Date().toISOString(), desfeita_por: s.user.id }).eq('id', sinc.id);
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
