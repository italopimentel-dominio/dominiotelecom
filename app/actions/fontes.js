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

  const [{ data: colabs }, { data: apelidos }, { data: periodos }, { data: produtos }, { data: grupos }, aeq] = await Promise.all([
    db.from('colaboradores').select('id, nome, ativo, grupo_id'),
    db.from('colaborador_apelidos').select('apelido, colaborador_id'),
    db.from('periodos').select('id, nome, referencia, fechado'),
    db.from('produtos').select('id, nome, medidas, unidade'),
    db.from('grupos').select('id, nome, parent_id, ativo').order('ordem').order('nome'),
    db.from('apelidos_equipe').select('apelido, grupo_id'),
  ]);
  const porId = new Map((grupos || []).map((g) => [g.id, g]));
  const caminho = (id) => { const l = []; let g = porId.get(id); while (g) { l.unshift(g.nome); g = porId.get(g.parent_id); } return l.join(' / '); };
  const listaGrupos = (grupos || []).filter((g) => g.ativo).map((g) => ({ id: g.id, nome: caminho(g.id) })).sort((a, b) => a.nome.localeCompare(b.nome));
  const nomeParaEquipe = new Map((aeq?.error ? [] : aeq?.data || []).map((a) => [a.apelido, a.grupo_id]));
  const mapaApelidos = new Map((apelidos || []).map((a) => [a.apelido, a.colaborador_id]));
  const ctx = { colaboradores: colabs || [], mapaApelidos, grupos: listaGrupos };
  const pessoas = lido.pessoas.map((p) => {
    const chave = normalizar(p.nome);
    // nome já marcado antes para entrar direto numa equipe
    if (nomeParaEquipe.has(chave) && porId.has(nomeParaEquipe.get(chave))) return { ...p, chave, situacao: 'equipe', grupoDireto: nomeParaEquipe.get(chave) };
    return { ...p, chave, ...classificarNome(p.nome, p.equipe, ctx) };
  });

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
  let atuais = [], atuaisGrupo = [];
  if (idsPer.length && idsProd.length) {
    const r = await todos(() => db.from('realizados').select('periodo_id, colaborador_id, produto_id, medida, valor').in('periodo_id', idsPer).in('produto_id', idsProd).order('colaborador_id'));
    atuais = r.data || [];
    const rg = await todos(() => db.from('realizados_grupo').select('periodo_id, grupo_id, produto_id, medida, valor').in('periodo_id', idsPer).in('produto_id', idsProd).order('grupo_id'));
    atuaisGrupo = rg.data || [];
  }
  return {
    ok: true,
    lidoEm: new Date().toISOString(),
    pessoas, meses, destinos, atuais, atuaisGrupo,
    pendencias: lido.pendencias, contagem: lido.contagem,
    colaboradores: (colabs || []).map((c) => ({ id: c.id, nome: c.nome, ativo: c.ativo })).sort((a, b) => a.nome.localeCompare(b.nome)),
    grupos: listaGrupos,
    gruposDiretos: [...new Set(nomeParaEquipe.values())],
  };
}

// Grava: em cada mês escolhido, os produtos da fonte passam a ser exatamente o que está na planilha.
// valores: { periodo_id, alvo: { tipo: 'colab'|'novo'|'grupo', id?, chave? }, produto_id, medida, valor }
// novos: pessoas cadastradas agora { chave, nome, grupo_id, data_admissao }
// equipes: nomes que entram direto numa equipe { apelido, grupo_id } (ficam guardados para as próximas leituras)
// Guarda os valores de antes para poder desfazer.
export async function aplicarFonte(dados) {
  const s = await editor();
  if (!s) return SEM_PERMISSAO;
  const db = s.supabase;
  const { fonte_id, url, periodos: idsPer = [], valores = [], escopo = [], apelidos = [], novos = [], equipes = [], gruposDiretos = [], resumo = {} } = dados || {};
  if (!idsPer.length) return { erro: 'Marque pelo menos um mês.' };
  if (!escopo.length) return { erro: 'Ligue os resultados aos produtos do sistema.' };
  if (novos.some((n) => !n.grupo_id || !n.nome?.trim())) return { erro: 'Escolha a equipe de todos os colaboradores novos.' };
  const { data: pers } = await db.from('periodos').select('id, nome, fechado').in('id', idsPer);
  const fechados = (pers || []).filter((p) => p.fechado);
  if (fechados.length) return { erro: `Mês fechado não pode ser alterado: ${fechados.map((p) => p.nome).join(', ')}.` };

  // 1) cadastra quem foi marcado como novo
  const idNovo = new Map();
  if (novos.length) {
    const regs = novos.map((n) => { const id = crypto.randomUUID(); idNovo.set(n.chave, id); return { id, nome: n.nome.trim(), grupo_id: n.grupo_id, data_admissao: n.data_admissao || null, peso: 1 }; });
    const { error } = await db.from('colaboradores').insert(regs);
    if (error) return { erro: `Não foi possível cadastrar os novos colaboradores: ${error.message}` };
  }

  // 2) monta os valores finais
  const noEscopo = (r) => escopo.some((e) => e.produto_id === r.produto_id && e.medida === r.medida);
  const somaC = new Map(), somaG = new Map();
  for (const v of valores) {
    if (!idsPer.includes(v.periodo_id) || !noEscopo(v) || !Number(v.valor)) continue;
    if (v.alvo?.tipo === 'grupo') {
      const k = `${v.periodo_id}|${v.alvo.id}|${v.produto_id}|${v.medida}`;
      somaG.set(k, (somaG.get(k) || 0) + Number(v.valor));
    } else {
      const cid = v.alvo?.tipo === 'novo' ? idNovo.get(v.alvo.chave) : v.alvo?.id;
      if (!cid) continue;
      const k = `${v.periodo_id}|${cid}|${v.produto_id}|${v.medida}`;
      somaC.set(k, (somaC.get(k) || 0) + Number(v.valor));
    }
  }
  const linha = (k, campo) => { const [periodo_id, id, produto_id, medida] = k.split('|'); return { periodo_id, [campo]: id, produto_id, medida }; };
  const depoisC = [...somaC.entries()].map(([k, v]) => ({ ...linha(k, 'colaborador_id'), valor: Math.round(v * 100) / 100 }));
  const depoisG = [...somaG.entries()].map(([k, v]) => ({ ...linha(k, 'grupo_id'), valor: Math.round(v * 100) / 100 }));

  // equipes que esta fonte alimenta direto (as de agora e as já marcadas antes)
  const gruposFonte = [...new Set([...gruposDiretos, ...equipes.map((e) => e.grupo_id), ...depoisG.map((g) => g.grupo_id)])];

  // 3) valores de antes (para desfazer)
  const idsProd = [...new Set(escopo.map((e) => e.produto_id))];
  const rc = await todos(() => db.from('realizados').select('periodo_id, colaborador_id, produto_id, medida, valor').in('periodo_id', idsPer).in('produto_id', idsProd).order('colaborador_id'));
  if (rc.error) return { erro: rc.error.message };
  let antesG = [];
  if (gruposFonte.length) {
    const rg = await todos(() => db.from('realizados_grupo').select('periodo_id, grupo_id, produto_id, medida, valor').in('periodo_id', idsPer).in('produto_id', idsProd).in('grupo_id', gruposFonte).order('grupo_id'));
    if (rg.error) return { erro: rg.error.message };
    antesG = (rg.data || []).filter(noEscopo);
  }
  const antes = [...(rc.data || []).filter(noEscopo).map((x) => ({ ...x, tabela: 'colab' })), ...antesG.map((x) => ({ ...x, tabela: 'grupo' }))];
  const depois = [...depoisC.map((x) => ({ ...x, tabela: 'colab' })), ...depoisG.map((x) => ({ ...x, tabela: 'grupo' }))];

  const { data: sinc, error: e0 } = await db.from('sincronizacoes').insert({
    fonte_id, url, meses: (pers || []).map((p) => p.nome), resumo: { ...resumo, gruposFonte, novos: novos.length }, antes, depois,
  }).select('id').single();
  if (e0) return { erro: e0.message.includes('sincronizacoes') ? 'Rode o arquivo 017_fonte_dados.sql no Supabase.' : e0.message };

  // 4) substitui
  for (const pid of idsPer) {
    for (const e of escopo) {
      const { error } = await db.from('realizados').delete().eq('periodo_id', pid).eq('produto_id', e.produto_id).eq('medida', e.medida);
      if (error) return { erro: `Erro ao limpar valores antigos: ${error.message}` };
      if (gruposFonte.length) {
        const { error: eg } = await db.from('realizados_grupo').delete().eq('periodo_id', pid).eq('produto_id', e.produto_id).eq('medida', e.medida).in('grupo_id', gruposFonte);
        if (eg) return { erro: `Erro ao limpar valores antigos das equipes: ${eg.message}` };
      }
    }
  }
  for (let i = 0; i < depoisC.length; i += 500) {
    const { error } = await db.from('realizados').upsert(depoisC.slice(i, i + 500));
    if (error) return { erro: `Erro ao gravar: ${error.message}. Use "Desfazer" na última leitura para voltar.` };
  }
  if (depoisG.length) {
    const { error } = await db.from('realizados_grupo').upsert(depoisG);
    if (error) return { erro: `Erro ao gravar nas equipes: ${error.message}. Use "Desfazer" para voltar.` };
  }
  if (apelidos.length) {
    await db.from('colaborador_apelidos').upsert(apelidos.map((a) => ({ apelido: normalizar(a.apelido), colaborador_id: a.colaborador_id })));
  }
  if (equipes.length) {
    const { error } = await db.from('apelidos_equipe').upsert(equipes.map((e) => ({ apelido: normalizar(e.apelido), grupo_id: e.grupo_id })));
    if (error) return { erro: error.message.includes('apelidos_equipe') ? 'Gravado, mas rode o 018_nome_para_equipe.sql para o sistema lembrar dos nomes que vão direto para equipe.' : error.message };
  }
  revalidatePath('/', 'layout');
  return { ok: `Gravado: ${depois.length} valores em ${(pers || []).map((p) => p.nome).join(', ')}${novos.length ? `, ${novos.length} colaboradores cadastrados` : ''}.`, id: sinc.id };
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
