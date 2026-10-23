// Núcleo da fonte de dados (leitura e gravação), usado pelos botões e pela atualização automática.
// Recebe o cliente do banco: o do usuário logado (botões) ou o admin (rodada agendada).
import { normalizar } from '@/lib/nomes';
import { linkExportacao, lerPedidos, lerCarteira, MODELOS, destinosExtras } from '@/lib/fontes';
import { classificarNome } from '@/lib/conferenciaNomes';
import { temMedida } from '@/lib/medida';
import { gravarLinhasCampanhas } from '@/lib/campanhaRegrasServidor';

export async function todos(consulta) {
  const tudo = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await consulta().range(de, de + 999);
    if (error) return { error };
    tudo.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return { data: tudo };
}

// Baixa a aba da planilha da fonte e devolve as linhas (array de arrays)
export async function baixarLinhas(fonte) {
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
  return { linhas: XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null, blankrows: false }) };
}

// Lê a planilha da fonte e classifica os nomes (não grava nada)
export async function montarLeitura(db, fonte) {
  const modelo = MODELOS[fonte.modelo] || MODELOS.pedidos_movel;
  const baixado = await baixarLinhas(fonte);
  if (baixado.erro) return { erro: baixado.erro };
  const lido = lerPedidos(baixado.linhas, modelo);
  if (lido.erro) return { erro: lido.erro };

  const [{ data: colabs }, { data: apelidos }, { data: periodos }, { data: produtos }, { data: grupos }, aeq, ign] = await Promise.all([
    db.from('colaboradores').select('id, nome, ativo, grupo_id'),
    db.from('colaborador_apelidos').select('apelido, colaborador_id'),
    db.from('periodos').select('id, nome, referencia, fechado'),
    db.from('produtos').select('id, nome, medidas, unidade'),
    db.from('grupos').select('id, nome, parent_id, ativo').order('ordem').order('nome'),
    db.from('apelidos_equipe').select('apelido, grupo_id'),
    db.from('nomes_ignorados').select('apelido').eq('fonte_id', fonte.id),
  ]);
  const ignorados = new Set(((ign && !ign.error && ign.data) || []).map((x) => x.apelido));
  const porId = new Map((grupos || []).map((g) => [g.id, g]));
  const caminho = (id) => { const l = []; let g = porId.get(id); while (g) { l.unshift(g.nome); g = porId.get(g.parent_id); } return l.join(' / '); };
  const listaGrupos = (grupos || []).filter((g) => g.ativo).map((g) => ({ id: g.id, nome: caminho(g.id) })).sort((a, b) => a.nome.localeCompare(b.nome));
  const nomeParaEquipe = new Map((aeq?.error ? [] : aeq?.data || []).map((a) => [a.apelido, a.grupo_id]));
  const mapaApelidos = new Map((apelidos || []).map((a) => [a.apelido, a.colaborador_id]));
  const ctx = { colaboradores: colabs || [], mapaApelidos, grupos: listaGrupos };
  const pessoas = lido.pessoas.map((p) => {
    const chave = normalizar(p.nome);
    // nome marcado antes como "ignorar" nesta fonte
    if (ignorados.has(chave)) return { ...p, chave, situacao: 'ignorado' };
    // nome já marcado antes para entrar direto numa equipe
    if (nomeParaEquipe.has(chave) && porId.has(nomeParaEquipe.get(chave))) return { ...p, chave, situacao: 'equipe', grupoDireto: nomeParaEquipe.get(chave) };
    return { ...p, chave, ...classificarNome(p.nome, p.equipe, ctx) };
  });

  const meses = lido.meses.map((m) => {
    const per = (periodos || []).find((p) => p.referencia.startsWith(m));
    return { mes: m, periodo: per ? { id: per.id, nome: per.nome, fechado: !!per.fechado } : null };
  });
  const destinos = {};
  const extras = destinosExtras(modelo);
  Object.entries(modelo.destinos).forEach(([d, rotulo]) => {
    const p = (produtos || []).find((x) => x.id === fonte.config?.[d]);
    destinos[d] = { rotulo, extra: extras.has(d), produto: p ? { id: p.id, nome: p.nome, qtd: temMedida(p, 'qtd'), brl: temMedida(p, 'brl') } : null };
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
    pendencias: lido.pendencias, contagem: lido.contagem, statusConta: modelo.statusConta,
    colaboradores: (colabs || []).map((c) => ({ id: c.id, nome: c.nome, ativo: c.ativo })).sort((a, b) => a.nome.localeCompare(b.nome)),
    grupos: listaGrupos,
    gruposDiretos: [...new Set(nomeParaEquipe.values())],
  };
}

// Grava: em cada mês escolhido, os produtos da fonte passam a ser exatamente o que está na planilha.
// valores: { periodo_id, alvo: { tipo: 'colab'|'novo'|'grupo', id?, chave? }, produto_id, medida, valor }
// novos: pessoas cadastradas agora { chave, nome, grupo_id, data_admissao }
// equipes: nomes que entram direto numa equipe { apelido, grupo_id } (ficam guardados para as próximas leituras)
// Guarda os valores de antes para poder desfazer. automatica = rodada agendada (sem usuário).
export async function gravarLeitura(db, dados, { automatica = false } = {}) {
  const { fonte_id, url, periodos: idsPer = [], valores = [], escopo = [], apelidos = [], novos = [], equipes = [], gruposDiretos = [], resumo = {}, vendasParceiros = [], ignorados = [], designorados = [] } = dados || {};
  if (!idsPer.length) return { erro: 'Marque pelo menos um mês.' };
  if (!escopo.length) return { erro: 'Ligue os resultados aos produtos do sistema.' };
  if (novos.some((n) => !n.grupo_id || !n.nome?.trim())) return { erro: 'Escolha a equipe de todos os colaboradores novos.' };
  const { data: pers } = await db.from('periodos').select('id, nome, fechado, referencia').in('id', idsPer);
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
    fonte_id, url, meses: (pers || []).map((p) => p.nome), resumo: { ...resumo, gruposFonte, novos: novos.length, automatica }, antes, depois,
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
  if (ignorados.length) {
    await db.from('nomes_ignorados').upsert(ignorados.map((n) => ({ fonte_id, apelido: normalizar(n) })));
  }
  if (designorados.length) {
    await db.from('nomes_ignorados').delete().eq('fonte_id', fonte_id).in('apelido', designorados.map(normalizar));
  }
  if (equipes.length) {
    const { error } = await db.from('apelidos_equipe').upsert(equipes.map((e) => ({ apelido: normalizar(e.apelido), grupo_id: e.grupo_id })));
    if (error) return { erro: error.message.includes('apelidos_equipe') ? 'Gravado, mas rode o 018_nome_para_equipe.sql para o sistema lembrar dos nomes que vão direto para equipe.' : error.message };
  }
  // 5) vendas linha a linha (com CNPJ), para cruzar com os materiais enviados.
  // A gravação anterior do mesmo mês fica marcada como substituída (o "Desfazer" volta ela).
  let linhasGravadas = 0, avisoLinhas = '';
  const { data: fonteReg } = await db.from('fontes_dados').select('*').eq('id', fonte_id).maybeSingle();
  if (fonteReg) {
    const modelo = MODELOS[fonteReg.modelo] || MODELOS.pedidos_movel;
    const baixado = await baixarLinhas({ ...fonteReg, url: url || fonteReg.url });
    const lido = baixado.erro ? { erro: baixado.erro } : lerPedidos(baixado.linhas, modelo, { comLinhas: true });
    const mesesSinc = (pers || []).map((p) => String(p.referencia).slice(0, 7));
    if (lido.erro) avisoLinhas = ` (vendas com CNPJ não gravadas: ${lido.erro})`;
    else {
      // manual: guarda as linhas antigas para o "Desfazer"; automático: substitui (não acumula histórico)
      const { error: es } = automatica
        ? await db.from('vendas_linhas').delete().eq('fonte_id', fonte_id).in('mes', mesesSinc).is('substituida_por', null)
        : await db.from('vendas_linhas').update({ substituida_por: sinc.id }).eq('fonte_id', fonte_id).in('mes', mesesSinc).is('substituida_por', null);
      if (es) avisoLinhas = es.message.includes('vendas_linhas') ? ' (rode o 021_vendas_linhas.sql para gravar as vendas com CNPJ)' : ` (vendas com CNPJ: ${es.message})`;
      else {
        const cfg = fonteReg.config || {};
        const regs = lido.vendas.filter((v) => mesesSinc.includes(v.mes)).map((v) => ({
          fonte_id, sincronizacao_id: sinc.id, mes: v.mes, consultor: v.consultor, cnpj: v.cnpj, documento_valido: v.valido,
          destino: v.destino, produto_id: cfg[v.destino] || null, qtd: v.qtd, valor: v.valor, pedido: v.pedido, classe: v.classe,
        }));
        for (let i = 0; i < regs.length && !avisoLinhas; i += 1000) {
          const { error: ei } = await db.from('vendas_linhas').insert(regs.slice(i, i + 1000));
          if (ei) avisoLinhas = ` (vendas com CNPJ: ${ei.message})`;
        }
        if (!avisoLinhas) linhasGravadas = regs.length;
        // limpeza: linhas substituídas há mais de 30 dias não podem mais ser desfeitas
        const limite = new Date(Date.now() - 30 * 86400000).toISOString();
        const { data: velhas } = await db.from('sincronizacoes').select('id').eq('fonte_id', fonte_id).lt('executado_em', limite);
        if (velhas?.length) await db.from('vendas_linhas').delete().in('substituida_por', velhas.map((v) => v.id));
      }
    }
  }

  // 5b) carteira de pedidos (Painel – Projeção). Não interfere no executado.
  let avisoPedidos = '';
  if (fonteReg) {
    try {
      avisoPedidos = await gravarCarteira(db, { fonte_id, fonte: fonteReg, url });
    } catch (e) {
      avisoPedidos = ` (projeção: ${e.message})`;
    }
  }

  // 6) parceiros do Indireto: grava a primeira venda de quem ainda não tem (vínculo pelo nome)
  let parceirosComVenda = 0, avisoParceiros = '';
  if (vendasParceiros.length) {
    const { data: n, error: ev } = await db.rpc('registrar_vendas_parceiros', { p_sinc: sinc.id, p_vendas: vendasParceiros });
    if (ev) avisoParceiros = ev.message.includes('registrar_vendas_parceiros') ? ' (rode o 019_status_venda_parceiros.sql para vincular as vendas dos parceiros)' : ` (vendas dos parceiros: ${ev.message})`;
    else parceirosComVenda = n || 0;
  }
  // a gravação resolve as pendências da atualização automática desta fonte (a próxima rodada confere de novo)
  if (!automatica) await db.from('fontes_dados').update({ auto_status: 'ok', auto_pendentes: [], auto_msg: 'Gravado manualmente.' }).eq('id', fonte_id);
  return { ok: `Gravado: ${depois.length} valores em ${(pers || []).map((p) => p.nome).join(', ')}${novos.length ? `, ${novos.length} colaboradores cadastrados` : ''}${linhasGravadas ? `, ${linhasGravadas} linhas de venda guardadas para o cruzamento por CNPJ` : ''}${parceirosComVenda ? `, ${parceirosComVenda} parceiros do Indireto com a primeira venda vinculada` : ''}.${avisoParceiros}${avisoLinhas}${avisoPedidos}`, id: sinc.id };
}


// Carteira de pedidos (Painel – Projeção): grava a foto atual de TODOS os pedidos da fonte
// (situação, safra = mês de entrada, mês de conclusão). Cada gravação substitui a foto anterior da fonte.
// Usa o mesmo vínculo de nomes das fontes; quem não é reconhecido fica de fora (como no executado).
export async function gravarCarteira(db, { fonte_id, fonte, url }) {
  const modelo = MODELOS[fonte.modelo] || MODELOS.pedidos_movel;
  if (!modelo.statusTramitando) return '';
  const baixado = await baixarLinhas({ ...fonte, url: url || fonte.url });
  if (baixado.erro) return ` (projeção: ${baixado.erro})`;
  const lido = lerCarteira(baixado.linhas, modelo);
  if (lido.erro) return ` (projeção não atualizada: ${lido.erro})`;

  const [{ data: colabs }, { data: apelidos }, { data: grupos }, aeq, ign] = await Promise.all([
    db.from('colaboradores').select('id, nome, ativo, grupo_id'),
    db.from('colaborador_apelidos').select('apelido, colaborador_id'),
    db.from('grupos').select('id, nome, parent_id, ativo').order('ordem').order('nome'),
    db.from('apelidos_equipe').select('apelido, grupo_id'),
    db.from('nomes_ignorados').select('apelido').eq('fonte_id', fonte_id),
  ]);
  const porId = new Map((grupos || []).map((g) => [g.id, g]));
  const caminho = (id) => { const l = []; let g = porId.get(id); while (g) { l.unshift(g.nome); g = porId.get(g.parent_id); } return l.join(' / '); };
  const ctx = {
    colaboradores: colabs || [],
    mapaApelidos: new Map((apelidos || []).map((a) => [a.apelido, a.colaborador_id])),
    grupos: (grupos || []).filter((g) => g.ativo).map((g) => ({ id: g.id, nome: caminho(g.id) })),
  };
  const ignorados = new Set(((ign && !ign.error && ign.data) || []).map((x) => x.apelido));
  const paraEquipe = new Map(((aeq && !aeq.error && aeq.data) || []).map((a) => [a.apelido, a.grupo_id]));
  const cfg = fonte.config || {};

  // Campanhas: guarda as linhas da planilha (todas as colunas) com o mesmo vínculo de nomes.
  // Não interfere na projeção: qualquer erro aqui vira só um aviso na mensagem.
  let avisoCampanhas = '';
  try {
    const alvoDe = (nome, equipe) => {
      const k = normalizar(nome);
      if (ignorados.has(k)) return 'ignorado';
      if (paraEquipe.has(k) && porId.has(paraEquipe.get(k))) return ['g', paraEquipe.get(k)];
      const c = classificarNome(nome, equipe, ctx);
      return c.situacao === 'encontrado' && c.sugerido ? ['c', c.sugerido] : null;
    };
    avisoCampanhas = await gravarLinhasCampanhas(db, { fonte_id, modelo, linhas: baixado.linhas, alvoDe });
  } catch (e) {
    avisoCampanhas = ` (campanhas: ${e.message})`;
  }

  const soma = new Map();
  let foraNomes = 0;
  for (const p of lido.pessoas) {
    const k = normalizar(p.nome);
    if (ignorados.has(k)) continue;
    let alvo = null;
    if (paraEquipe.has(k) && porId.has(paraEquipe.get(k))) alvo = ['g', paraEquipe.get(k)];
    else {
      const c = classificarNome(p.nome, p.equipe, ctx);
      if (c.situacao === 'encontrado' && c.sugerido) alvo = ['c', c.sugerido];
    }
    if (!alvo) { foraNomes++; continue; }
    p.itens.forEach((it) => {
      const produto = cfg[it.destino];
      if (!produto || (!it.qtd && !it.valor)) return;
      const ch = `${alvo[0]}|${alvo[1]}|${produto}|${it.situacao}|${it.safra || ''}|${it.conclusao || ''}|${it.assumida ? 1 : 0}`;
      const t = soma.get(ch) || { qtd: 0, valor: 0 };
      t.qtd += it.qtd; t.valor += it.valor;
      soma.set(ch, t);
    });
  }
  const regs = [...soma.entries()].map(([ch, v]) => {
    const [tipo, id, produto_id, situacao, safra, conclusao, assumida] = ch.split('|');
    return { fonte_id, colaborador_id: tipo === 'c' ? id : null, grupo_id: tipo === 'g' ? id : null, produto_id, situacao,
      safra: safra || null, conclusao: conclusao || null, classe_assumida: assumida === '1', qtd: Math.round(v.qtd * 100) / 100, valor: Math.round(v.valor * 100) / 100 };
  });
  const { error: ed } = await db.from('pedidos_carteira').delete().eq('fonte_id', fonte_id);
  if (ed) return (/pedidos_carteira/.test(ed.message) ? ' (rode o 041_carteira_pedidos.sql para gravar a projeção)' : ` (projeção: ${ed.message})`) + avisoCampanhas;
  for (let i = 0; i < regs.length; i += 1000) {
    const { error } = await db.from('pedidos_carteira').insert(regs.slice(i, i + 1000));
    if (error) return (/classe_assumida/.test(error.message) ? ' (rode o 042_classe_assumida.sql para gravar a projeção)' : ` (projeção: ${error.message})`) + avisoCampanhas;
  }
  const c = lido.contagem;
  const fora = [lido.semEntrada && `${lido.semEntrada} sem data de entrada`, foraNomes && `${foraNomes} nomes sem vínculo`,
  ].filter(Boolean);
  // diagnóstico sempre visível na mensagem da fonte
  return ` (projeção: ${c.exec} executados, ${c.tram} tramitando, ${c.canc} pendentes/cancelados lidos${c.assumidas ? `, ${c.assumidas} sem classe contados como Alta` : ''}${c.altas.length ? `; confira quantidades altas: ${c.altas.join('; ')}` : ''}${lido.mesPrimeiro ? ', datas em mês/dia/ano' : ''}${fora.length ? `; fora: ${fora.join(', ')}` : ''})${avisoCampanhas}`;
}
