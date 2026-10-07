// Atualização automática de uma fonte de dados (chamada pelo agendamento, sem usuário).
// Grava só o mês atual, só nomes já reconhecidos, e só quando a planilha mudou.
// Nomes novos/parecidos/duplicados ficam de fora e viram pendência (aviso no sistema).
import { createHash } from 'crypto';
import { hojeSP } from '@/lib/datas';
import { montarLeitura, gravarLeitura } from '@/lib/fontesServidor';

async function marcar(db, fonteId, campos) {
  await db.from('fontes_dados').update({ auto_em: new Date().toISOString(), ...campos }).eq('id', fonteId);
}

export async function rodarFonteAutomatica(db, fonte) {
  const leitura = await montarLeitura(db, fonte);
  if (leitura.erro) {
    await marcar(db, fonte.id, { auto_status: 'erro', auto_msg: leitura.erro });
    return { fonte: fonte.nome, status: 'erro', msg: leitura.erro };
  }
  const mesAtual = hojeSP().slice(0, 7);
  const m = leitura.meses.find((x) => x.mes === mesAtual);
  if (!m) {
    await marcar(db, fonte.id, { auto_status: 'ok', auto_msg: 'A planilha ainda não tem vendas do mês atual.', auto_pendentes: [] });
    return { fonte: fonte.nome, status: 'sem_mes' };
  }
  if (!m.periodo) {
    const msg = 'O mês atual não está cadastrado em Períodos e fechamentos: cadastre para a atualização automática gravar.';
    await marcar(db, fonte.id, { auto_status: 'erro', auto_msg: msg });
    return { fonte: fonte.nome, status: 'erro', msg };
  }
  if (m.periodo.fechado) {
    await marcar(db, fonte.id, { auto_status: 'ok', auto_msg: 'O mês atual está fechado: nada foi gravado.', auto_pendentes: [] });
    return { fonte: fonte.nome, status: 'fechado' };
  }
  if (!leitura.contagem?.contadas) {
    const msg = 'A planilha veio sem nenhuma venda contada. Nada foi gravado, para não apagar os números do mês.';
    await marcar(db, fonte.id, { auto_status: 'erro', auto_msg: msg });
    return { fonte: fonte.nome, status: 'erro', msg };
  }

  const destinos = Object.entries(leitura.destinos);
  const escopo = [];
  destinos.forEach(([, d]) => { if (d.produto) { if (d.produto.qtd) escopo.push({ produto_id: d.produto.id, medida: 'qtd' }); if (d.produto.brl) escopo.push({ produto_id: d.produto.id, medida: 'brl' }); } });
  if (!escopo.length) {
    const msg = 'A fonte não está ligada a nenhum produto do sistema.';
    await marcar(db, fonte.id, { auto_status: 'erro', auto_msg: msg });
    return { fonte: fonte.nome, status: 'erro', msg };
  }

  const nomeColab = new Map(leitura.colaboradores.map((c) => [c.id, c.nome]));
  const valores = [], pendentes = [], vendasParceiros = [];
  for (const p of leitura.pessoas) {
    const doMes = p.meses[mesAtual];
    if (!doMes) continue;
    const qtdMes = Object.values(doMes).reduce((s, d) => s + (d.qtd || 0), 0);
    destinos.forEach(([k, d]) => { if (d.produto && doMes[k]?.qtd > 0) vendasParceiros.push({ nome: p.nome, mes: mesAtual, produto: d.produto.nome, qtd: doMes[k].qtd, valor: doMes[k].valor }); });
    if (p.situacao === 'ignorado') continue;
    let alvo = null;
    if (p.situacao === 'encontrado' && p.sugerido) alvo = { tipo: 'colab', id: p.sugerido };
    else if (p.situacao === 'equipe' && p.grupoDireto) alvo = { tipo: 'grupo', id: p.grupoDireto };
    if (!alvo) {
      pendentes.push({ nome: p.nome, situacao: p.situacao, sugerido: p.sugerido ? nomeColab.get(p.sugerido) || null : null, equipe: p.equipe || null, qtd: qtdMes });
      continue;
    }
    destinos.forEach(([k, d]) => {
      if (!d.produto || !doMes[k]) return;
      if (d.produto.qtd) valores.push({ periodo_id: m.periodo.id, alvo, produto_id: d.produto.id, medida: 'qtd', valor: doMes[k].qtd });
      if (d.produto.brl) valores.push({ periodo_id: m.periodo.id, alvo, produto_id: d.produto.id, medida: 'brl', valor: doMes[k].valor });
    });
  }

  // só grava se algo mudou desde a última rodada
  const assinatura = createHash('sha1').update(JSON.stringify({
    v: valores.map((v) => [v.alvo.tipo, v.alvo.id, v.produto_id, v.medida, Math.round(v.valor * 100)]).sort(),
    c: leitura.contagem.contadas, cnpj: leitura.contagem.cnpj, mes: mesAtual,
  })).digest('hex');
  const resumoPend = pendentes.length ? `${pendentes.length} ${pendentes.length === 1 ? 'nome aguardando' : 'nomes aguardando'} vínculo (as vendas deles ainda não entraram).` : '';
  if (assinatura === fonte.auto_hash) {
    await marcar(db, fonte.id, { auto_status: pendentes.length ? 'pendente' : 'ok', auto_msg: `Sem mudanças na planilha. ${resumoPend}`.trim(), auto_pendentes: pendentes });
    return { fonte: fonte.nome, status: 'sem_mudanca', pendentes: pendentes.length };
  }

  const r = await gravarLeitura(db, {
    fonte_id: fonte.id, url: fonte.url, periodos: [m.periodo.id], valores, escopo, apelidos: [], novos: [], equipes: [],
    gruposDiretos: leitura.gruposDiretos, vendasParceiros,
    resumo: { lidoEm: leitura.lidoEm, contadas: leitura.contagem.contadas, pendentes: pendentes.length },
  }, { automatica: true });
  if (r.erro) {
    await marcar(db, fonte.id, { auto_status: 'erro', auto_msg: r.erro });
    return { fonte: fonte.nome, status: 'erro', msg: r.erro };
  }
  await marcar(db, fonte.id, { auto_status: pendentes.length ? 'pendente' : 'ok', auto_msg: `${r.ok} ${resumoPend}`.trim(), auto_pendentes: pendentes, auto_hash: assinatura });

  // as gravações automáticas antigas não guardam o "antes/depois" para sempre (economiza espaço)
  const limite = new Date(Date.now() - 3 * 86400000).toISOString();
  await db.from('sincronizacoes').update({ antes: [], depois: [] })
    .eq('fonte_id', fonte.id).lt('executado_em', limite).is('desfeita_em', null).eq('resumo->>automatica', 'true');
  return { fonte: fonte.nome, status: 'gravado', pendentes: pendentes.length };
}
