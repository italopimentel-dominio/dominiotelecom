// Leitura de planilhas de pedidos (fonte de dados) e regras de contagem.
import { normalizar } from './nomes';
import { numero } from './formato';
import { cnpjValido, cpfValido } from './indireto';

const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const txt = (v) => (v === null || v === undefined ? '' : String(v).trim());
const chave = (s) => normalizar(s).replace(/\s+/g, ' ');

// Link do Google -> endereço de exportação em CSV (a planilha precisa estar "qualquer pessoa com o link pode ver")
export function linkExportacao(url) {
  const id = String(url).match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1];
  if (!id) return null;
  const gid = String(url).match(/[#&?]gid=(\d+)/)?.[1];
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
}

// "outubro_2026", "out/2026", "10/2026", "01/10/2026" ou "2026-10" -> "2026-10"
export function mesDoTexto(s) {
  const bruto = txt(s);
  let m = normalizar(bruto).match(/([a-z]+)[\s_/-]*(\d{4})/);
  if (m) {
    const i = MESES.findIndex((x) => x === m[1] || (m[1].length >= 3 && x.startsWith(m[1])));
    if (i >= 0) return `${m[2]}-${String(i + 1).padStart(2, '0')}`;
  }
  m = bruto.match(/^(\d{4})[-/](\d{1,2})/); // 2026-10
  if (m && +m[2] >= 1 && +m[2] <= 12) return `${m[1]}-${m[2].padStart(2, '0')}`;
  m = bruto.match(/^(?:\d{1,2}\/)?(\d{1,2})\/(\d{4})/); // 01/10/2026 ou 10/2026
  if (m && +m[1] >= 1 && +m[1] <= 12) return `${m[2]}-${m[1].padStart(2, '0')}`;
  return null;
}

// Modelos de leitura. Cada um diz quais colunas usa e o que conta em cada produto.
// Uma regra conta a linha quando a classe está em "classes" ou começa com algum dos "prefixos"
// (ex.: prefixo RENOVAÇÃO pega RENOVAÇÃO PADRÃO, RENOVAÇÃO UP e qualquer outra renovação nova).
export const MODELOS = {
  pedidos_movel: {
    nome: 'Pedidos móvel (Alta, Renovação e Aparelhos)',
    nomePadrao: 'Planilha gerencial móvel',
    colunas: {
      consultor: 'CONSULTOR', neo: 'NEO', equipe: 'EQUIPE CANAL DIRETO',
      linhas: 'QUANTIDADE LINHAS', valorLinha: 'VALOR TERMO SMP', aparelhos: 'QTD APARELHOS', valorAparelho: 'VALOR APARELHO',
      classe: 'GRUPO CLASSE', status: 'GRUPO STATUS', mes: 'MÊS/ANO CONCLUSÃO', totalizado: 'TOTALIZADO', entrada: 'Data de entrada no Trello',
      cnpj: ['CNPJ', 'CPF/CNPJ', 'CNPJ/CPF', 'CPF CNPJ', 'CNPJ CLIENTE', 'DOCUMENTO'],
    },
    obrigatorias: ['consultor', 'classe', 'status', 'mes', 'linhas'],
    // destino -> rótulo do produto (o sistema sugere o produto pelo nome)
    destinos: { alta: 'Alta Móvel', reno: 'Reno Móvel', aparelhos: 'Aparelhos', tot: 'Totalização – móvel', totFora: 'Totalização – móvel (outras classes)' },
    // a mais: venda com TOTALIZADO = TOTALIZAÇÃO SIM também soma em Totalização (continua contando normalmente)
    // qtd 'pedido' = conta 1 por pedido (NEO), independente da quantidade de linhas
    // totFora: as mesmas totalizações, só as que NÃO entraram em alta (somam no realizado de Alta Móvel sem contar duas vezes)
    extras: [
      { destino: 'tot', coluna: 'totalizado', valor: 'TOTALIZACAO SIM', qtd: 'pedido' },
      { destino: 'totFora', coluna: 'totalizado', valor: 'TOTALIZACAO SIM', qtd: 'pedido', excetoSe: 'alta' },
    ],
    regras: [
      { destino: 'alta', classes: ['ALTA', 'MIGRACAO PRE/POS'], qtd: 'linhas', valor: 'valorLinha' },
      { destino: 'reno', prefixos: ['RENOVACAO'], qtd: 'linhas', valor: 'valorLinha' },
      { destino: 'aparelhos', classes: null, qtd: 'aparelhos', valor: 'valorAparelho' },
    ],
    ignorarClasses: ['NAO CONTABILIZA'],
    statusConta: 'EXECUTADO',
    statusTramitando: ['CREDITO', 'FRAUDE', 'LOGISTICA', 'BKO'], // Painel – Projeção; o resto (pendentes, reprovados, cancelado, vazio) = pendente/cancelado
    regrasTexto: 'Só GRUPO STATUS = EXECUTADO, no mês de MÊS/ANO CONCLUSÃO. Alta = ALTA ou MIGRAÇÃO PRÉ/PÓS; Renovação = qualquer classe que comece com RENOVAÇÃO (quantidade em QUANTIDADE LINHAS, receita em VALOR TERMO SMP); Aparelhos = QTD APARELHOS e VALOR APARELHO. "NÃO CONTABILIZA" nunca conta.',
  },
  pedidos_fibra: {
    nome: 'Pedidos fibra (Alta e Renovação)',
    nomePadrao: 'Planilha gerencial fibra',
    colunas: {
      consultor: 'CONSULTOR', neo: 'NEO', qtd: 'Quant.', valor: 'VALOR TOTAL', tipo: 'TIPO PRODUTO',
      equipe: 'EQUIPE CANAL DIRETO', classe: 'GRUPO CLASSE', status: 'GRUPO STATUS', mes: 'MÊS CONCLUSÃO', vivoTotal: 'VIVO TOTAL', entrada: 'DATA DE ENTRADA',
      cnpj: ['CNPJ', 'CPF/CNPJ', 'CNPJ/CPF', 'CPF CNPJ', 'CNPJ CLIENTE', 'DOCUMENTO'],
    },
    obrigatorias: ['consultor', 'qtd', 'tipo', 'classe', 'status', 'mes'],
    destinos: { alta: 'Alta Fibra', reno: 'Reno Fibra', tot: 'Totalização – Fibra' },
    // a mais: venda com VIVO TOTAL = TOTALIZAÇÃO SIM também soma em Totalização (continua sendo Alta Fibra)
    extras: [{ destino: 'tot', coluna: 'vivoTotal', valor: 'TOTALIZACAO SIM', qtd: 'pedido' }],
    tiposConta: ['BANDA LARGA', 'TV', 'VOZ'],
    regras: [
      { destino: 'alta', classes: ['ALTA'], prefixos: ['MIGRACAO'], qtd: 'qtd', valor: 'valor' },
      { destino: 'reno', prefixos: ['RENOVACAO'], qtd: 'qtd', valor: 'valor' },
    ],
    ignorarClasses: ['NAO CONTABILIZA'],
    statusConta: 'EXECUTADO',
    statusTramitando: ['TRAMITANDO'],
    regrasTexto: 'Só GRUPO STATUS = EXECUTADO e TIPO PRODUTO = BANDA LARGA, TV ou VOZ, no mês de MÊS CONCLUSÃO. Alta = ALTA ou qualquer MIGRAÇÃO; Renovação = qualquer classe que comece com RENOVAÇÃO (RENOVAÇÃO PADRÃO, RENOVAÇÃO UP...). Quantidade em Quant., receita em VALOR TOTAL. "NÃO CONTABILIZA" nunca conta.',
  },
  pedidos_vada: {
    nome: 'Pedidos VADA (Alta VADA)',
    nomePadrao: 'Planilha gerencial VADA',
    colunas: {
      consultor: 'CONSULTOR', qtd: 'QTD', valor: 'VALOR TOTAL', equipe: 'EQUIPE CANAL INTERNO',
      classe: 'CLASSE', status: 'STATUS 1', mes: 'MÊS/ANO F1', entrada: 'DATA',
      cnpj: ['CNPJ', 'CPF/CNPJ', 'CNPJ/CPF', 'CPF CNPJ', 'CNPJ CLIENTE', 'DOCUMENTO'],
    },
    obrigatorias: ['consultor', 'qtd', 'classe', 'status', 'mes'],
    destinos: { alta: 'Alta VADA' },
    regras: [
      { destino: 'alta', classes: null, qtd: 'qtd', valor: 'valor' },
    ],
    ignorarClasses: ['NAO CONTABILIZA'],
    statusConta: 'APROVADO - ENVIADO P/ INSTALAÇÃO',
    statusTramitando: ['TRAMITANDO'],
    regrasTexto: 'Só STATUS 1 = APROVADO - ENVIADO P/ INSTALAÇÃO, no mês de MÊS/ANO F1. Quantidade em QTD, receita em VALOR TOTAL. Conta qualquer CLASSE, menos "NÃO CONTABILIZA".',
  },
  pedidos_b2c: {
    nome: 'Pedidos B2C (Alta Móvel e Alta Fibra)',
    nomePadrao: 'Planilha gerencial B2C',
    // EQUIPE da planilha é ignorada: a equipe vem do cadastro. CPF é do cliente (vai para as vendas linha a linha).
    colunas: {
      consultor: 'CONSULTOR', neo: 'NEO', qtd: 'QUANTIDADE', valor: 'VALOR', tipo: 'TIPO VENDA',
      classe: 'GRUPO CLASSE', status: 'GRUPO STATUS', mes: 'MÊS REF', entrada: 'DATA VENDA',
      cnpj: ['CPF', 'CPF/CNPJ', 'CNPJ/CPF', 'CPF CNPJ', 'CNPJ', 'DOCUMENTO'],
    },
    obrigatorias: ['consultor', 'qtd', 'tipo', 'classe', 'status', 'mes'],
    destinos: { movel: 'Alta Móvel – B2C', fibra: 'Alta Fibra – B2C' },
    tiposConta: ['MOVEL', 'FIXA'],
    // vale o TIPO VENDA (mesmo quando o GRUPO PLANO está trocado); QUANTIDADE vazia conta 1
    regras: [
      { destino: 'movel', tipos: ['MOVEL'], classes: ['ALTA'], prefixos: ['MIGRACAO'], qtd: 'qtd', valor: 'valor', qtdVazia: 1 },
      { destino: 'fibra', tipos: ['FIXA'], classes: ['ALTA'], prefixos: ['MIGRACAO'], qtd: 'qtd', valor: 'valor', qtdVazia: 1 },
    ],
    ignorarClasses: ['NAO CONTABILIZA'],
    statusConta: 'EXECUTADO',
    statusTramitando: ['TRAMITANDO'],
    regrasTexto: 'Só GRUPO STATUS = EXECUTADO, no mês de MÊS REF. TIPO VENDA = MÓVEL vai para Alta Móvel – B2C e FIXA para Alta Fibra – B2C (vale o tipo, mesmo com o plano trocado). Conta ALTA ou qualquer MIGRAÇÃO. Quantidade em QUANTIDADE (vazia conta 1), receita em VALOR. CPF é do cliente; a coluna EQUIPE é ignorada.',
  },
};

const regraPega = (r, classe, tipo) => {
  if (r.tipos && !r.tipos.map(chave).includes(tipo)) return false;
  if (!r.classes && !r.prefixos) return true;
  if (r.classes && r.classes.map(chave).includes(classe)) return true;
  return !!r.prefixos && r.prefixos.some((p) => classe.startsWith(chave(p)));
};

// CNPJ/CPF da venda: só dígitos. Recupera zeros à esquerda que o Google Sheets às vezes come.
export function documentoDaVenda(v) {
  const d = String(v ?? '').replace(/\D/g, '');
  if (!d) return { cnpj: null, valido: false };
  if (d.length <= 14) {
    const c = d.padStart(14, '0');
    if (d.length > 11 && cnpjValido(c)) return { cnpj: c, valido: true };
    const p = d.padStart(11, '0');
    if (d.length <= 11 && cpfValido(p)) return { cnpj: p, valido: true };
    if (cnpjValido(c)) return { cnpj: c, valido: true };
  }
  return { cnpj: d, valido: false };
}

// linhas: array de arrays (1ª linha = cabeçalho). Devolve os totais por mês, pessoa e destino + pendências.
const COLUNAS_OPCIONAIS = ['cnpj', 'totalizado', 'vivoTotal', 'entrada'];
// destinos "a mais" (ex.: Totalização): não entram na venda vinculada dos parceiros nem nas vendas com CNPJ
export const destinosExtras = (modelo) => new Set((modelo?.extras || []).map((e) => e.destino));

export function lerPedidos(linhas, modelo = MODELOS.pedidos_movel, { comLinhas = false } = {}) {
  const cab = (linhas[0] || []).map((c) => chave(txt(c)));
  const idx = {};
  const faltando = [];
  Object.entries(modelo.colunas).forEach(([k, nome]) => {
    const nomes = Array.isArray(nome) ? nome : [nome];
    const i = nomes.map((n) => cab.indexOf(chave(n))).find((x) => x >= 0) ?? -1;
    if (i < 0) { if (!COLUNAS_OPCIONAIS.includes(k)) faltando.push(nomes[0]); } else idx[k] = i;
  });
  const obrig = modelo.obrigatorias || ['consultor', 'classe', 'status', 'mes'];
  if (obrig.some((k) => idx[k] === undefined)) return { erro: `Colunas não encontradas na planilha: ${faltando.join(', ')}` };

  const pessoas = new Map(); // nome -> { nome, equipe, meses: { "2026-10": { alta: {qtd, valor}, ... } } }
  const pendencias = { semValor: [], semMes: [], mesInvalido: [] };
  const contagem = { total: 0, contadas: 0, naoExecutadas: 0, naoContabiliza: 0, semClasse: 0, tipoFora: 0, classes: {},
    cnpj: { coluna: false, com: 0, invalido: 0, sem: 0 }, extras: {}, extrasDiag: {} };
  const vistosPedido = new Set(); // destino|pessoa|mês|pedido já contado
  const vendas = []; // linha a linha (só quando comLinhas), para gravar com CNPJ
  contagem.cnpj.coluna = idx.cnpj !== undefined;
  const tipos = modelo.tiposConta ? new Set(modelo.tiposConta.map(chave)) : null;
  const val = (l, k) => (idx[k] === undefined ? null : numero(l[idx[k]]));
  const ignorar = new Set(modelo.ignorarClasses.map(chave));

  for (const l of linhas.slice(1)) {
    const nome = txt(l[idx.consultor]);
    if (!nome) continue;
    contagem.total++;
    // pedidos marcados num "a mais" (ex.: TOTALIZAÇÃO SIM): conta o motivo quando ficam de fora
    const marcados = (modelo.extras || []).filter((e) => e.destino === 'tot' && idx[e.coluna] !== undefined && chave(txt(l[idx[e.coluna]])) === chave(e.valor));
    const fora = (motivo) => marcados.forEach((e) => {
      const dg = (contagem.extrasDiag[e.destino] ||= { marcados: 0, contados: 0, porMes: {}, fora: {} });
      dg.fora[motivo] = (dg.fora[motivo] || 0) + 1;
    });
    marcados.forEach((e) => { (contagem.extrasDiag[e.destino] ||= { marcados: 0, contados: 0, porMes: {}, fora: {} }).marcados++; });
    if (chave(txt(l[idx.status])) !== chave(modelo.statusConta)) { contagem.naoExecutadas++; fora('não executado'); continue; }
    if (tipos && !tipos.has(chave(txt(l[idx.tipo])))) { contagem.tipoFora++; fora('tipo de produto fora da regra'); continue; }
    const classe = chave(txt(l[idx.classe]));
    const tipo = idx.tipo !== undefined ? chave(txt(l[idx.tipo])) : '';
    if (ignorar.has(classe)) { contagem.naoContabiliza++; fora('não contabiliza'); continue; }
    // resumo das classes encontradas e para onde cada uma foi (para conferir na prévia)
    const rotClasse = txt(l[idx.classe]).toUpperCase() || '(sem classe)';
    const destinosClasse = modelo.regras.filter((r) => regraPega(r, classe, tipo)).map((r) => r.destino);
    const rc = (contagem.classes[rotClasse] = contagem.classes[rotClasse] || { linhas: 0, destinos: destinosClasse });
    rc.linhas++;
    const textoMes = txt(l[idx.mes]);
    const mes = mesDoTexto(textoMes);
    const ref = { consultor: nome, neo: idx.neo !== undefined ? txt(l[idx.neo]) : '', classe: txt(l[idx.classe]) };
    if (!textoMes) { pendencias.semMes.push(ref); fora('sem mês de conclusão'); continue; }
    // mês sem sentido (ex.: "dezembro_1899", data vazia do Sheets) fica de fora
    if (!mes || mes < '2000-01') { pendencias.mesInvalido.push({ ...ref, mes: textoMes }); fora('mês inválido'); continue; }

    let usou = false;
    const usados = new Set(); // destinos em que esta venda já entrou
    const doc = idx.cnpj !== undefined ? documentoDaVenda(l[idx.cnpj]) : { cnpj: null, valido: false };
    for (const r of modelo.regras) {
      if (!regraPega(r, classe, tipo)) continue;
      const q = (r.qtdVazia && idx[r.qtd] !== undefined && txt(l[idx[r.qtd]]) === '' ? r.qtdVazia : val(l, r.qtd)) || 0;
      if (!q) continue;
      const v = val(l, r.valor);
      if (v === null || v === 0) pendencias.semValor.push({ ...ref, mes, destino: r.destino, qtd: q });
      if (!pessoas.has(nome)) pessoas.set(nome, { nome, equipe: idx.equipe !== undefined ? txt(l[idx.equipe]) : '', meses: {} });
      const p = pessoas.get(nome);
      p.meses[mes] = p.meses[mes] || {};
      const d = (p.meses[mes][r.destino] = p.meses[mes][r.destino] || { qtd: 0, valor: 0 });
      d.qtd += q;
      d.valor += v || 0;
      usou = true;
      usados.add(r.destino);
      if (comLinhas) vendas.push({ consultor: nome, mes, destino: r.destino, qtd: q, valor: v || 0, cnpj: doc.cnpj, valido: doc.valido, pedido: ref.neo || null, classe: ref.classe || null });
    }
    // a mais (ex.: totalização): soma no destino extra, independente da classe
    for (const e of modelo.extras || []) {
      if (e.excetoSe && usados.has(e.excetoSe)) continue;
      if (idx[e.coluna] === undefined || chave(txt(l[idx[e.coluna]])) !== chave(e.valor)) continue;
      let q;
      if (e.qtd === 'pedido') {
        const ped = ref.neo ? `${e.destino}|${nome}|${mes}|${ref.neo}` : null;
        if (ped && vistosPedido.has(ped)) continue; // mesmo pedido em mais de uma linha: conta 1
        if (ped) vistosPedido.add(ped);
        q = 1;
      } else q = val(l, e.qtd) || 0;
      if (!q) continue;
      if (e.destino === 'tot') {
        const dg = (contagem.extrasDiag.tot ||= { marcados: 0, contados: 0, porMes: {}, fora: {} });
        dg.contados += q;
        dg.porMes[mes] = (dg.porMes[mes] || 0) + q;
      }
      if (!pessoas.has(nome)) pessoas.set(nome, { nome, equipe: idx.equipe !== undefined ? txt(l[idx.equipe]) : '', meses: {} });
      const p = pessoas.get(nome);
      p.meses[mes] = p.meses[mes] || {};
      const d = (p.meses[mes][e.destino] = p.meses[mes][e.destino] || { qtd: 0, valor: 0 });
      d.qtd += q;
      contagem.extras[e.destino] = (contagem.extras[e.destino] || 0) + q;
    }
    if (usou) {
      contagem.contadas++;
      if (!doc.cnpj) contagem.cnpj.sem++; else if (doc.valido) contagem.cnpj.com++; else contagem.cnpj.invalido++;
    } else contagem.semClasse++;
  }
  const meses = [...new Set([...pessoas.values()].flatMap((p) => Object.keys(p.meses)))].sort();
  return { pessoas: [...pessoas.values()], meses, pendencias, contagem, faltando, ...(comLinhas ? { vendas } : {}) };
}


// ---------- Painel – Projeção ----------
// Data de entrada do pedido ("28/08/2026", "2026-08-28" ou número de data) -> '2026-08'
// mesPrimeiro = a planilha está no formato americano (mês/dia/ano)
export function mesDaData(v, mesPrimeiro = false) {
  if (typeof v === 'number') return v > 30000 && v < 80000 ? new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 7) : null;
  const s = txt(v);
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?!\d)/);
  if (m) {
    const mesN = mesPrimeiro ? m[1] : m[2];
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    return +mesN >= 1 && +mesN <= 12 ? `${ano}-${mesN.padStart(2, '0')}` : null;
  }
  m = s.match(/^(\d{4})-(\d{2})-\d{2}/);
  return m ? `${m[1]}-${m[2]}` : null;
}

// Carteira de pedidos (Painel – Projeção): todos os pedidos da planilha, não só os executados.
// Cada linha vira um item com situação, safra (mês de ENTRADA do pedido) e, se executado, o mês de conclusão:
//   exec = executado (statusConta) · tram = tramitando (statusTramitando) · canc = pendente/cancelado (o resto, inclusive vazio)
// Tramitando sem data de entrada continua contando (backlog de safra desconhecida). As regras de classe, tipo e quantidade são as do executado.
// Devolve { pessoas: [{ nome, equipe, itens: [{ destino, situacao, safra, conclusao, qtd, valor }] }], semEntrada, contagem }
export function lerCarteira(linhas, modelo) {
  const cab = (linhas[0] || []).map((c) => chave(txt(c)));
  const idx = {};
  Object.entries(modelo.colunas).forEach(([k, nome]) => {
    const i = (Array.isArray(nome) ? nome : [nome]).map((n) => cab.indexOf(chave(n))).find((x) => x >= 0) ?? -1;
    if (i >= 0) idx[k] = i;
  });
  if (idx.entrada === undefined) return { erro: `coluna "${modelo.colunas.entrada || 'data de entrada'}" não encontrada`, pessoas: [] };
  if (['consultor', 'classe', 'status'].some((k) => idx[k] === undefined)) return { erro: 'colunas obrigatórias não encontradas', pessoas: [] };
  const tram = new Set((modelo.statusTramitando || []).map(chave));
  const exec = chave(modelo.statusConta);
  const tipos = modelo.tiposConta ? new Set(modelo.tiposConta.map(chave)) : null;
  const ignorar = new Set(modelo.ignorarClasses.map(chave));
  const val = (l, k) => (idx[k] === undefined ? null : numero(l[idx[k]]));
  // formato da data de entrada: se aparece "10/25/2026" (segundo número > 12), a planilha está em mês/dia/ano
  let diaPrimeiro = 0, mesPrimeiroN = 0;
  linhas.slice(1).forEach((l) => {
    const m = txt(l[idx.entrada]).match(/^(\d{1,2})\/(\d{1,2})\//);
    if (m) { if (+m[1] > 12) diaPrimeiro++; if (+m[2] > 12) mesPrimeiroN++; }
  });
  const mesPrimeiro = mesPrimeiroN > diaPrimeiro;
  const pessoas = new Map();
  const vistos = new Set();
  const contagem = { exec: 0, tram: 0, canc: 0, assumidas: 0 };
  let semEntrada = 0;
  const somar = (nome, equipe, item, q, v) => {
    if (!pessoas.has(nome)) pessoas.set(nome, { nome, equipe, mapa: new Map() });
    const k = `${item.destino}|${item.situacao}|${item.safra || ''}|${item.conclusao || ''}|${item.assumida ? 1 : 0}`;
    const m = pessoas.get(nome).mapa;
    const t = m.get(k) || { ...item, qtd: 0, valor: 0 };
    t.qtd += q; t.valor += v;
    m.set(k, t);
  };
  for (const l of linhas.slice(1)) {
    const nome = txt(l[idx.consultor]);
    if (!nome) continue;
    const st = chave(txt(l[idx.status]));
    const situacao = st === exec ? 'exec' : tram.has(st) ? 'tram' : 'canc';
    const tipo = idx.tipo !== undefined ? chave(txt(l[idx.tipo])) : '';
    if (tipos && !tipos.has(tipo)) continue;
    const classe = chave(txt(l[idx.classe]));
    if (ignorar.has(classe)) continue;
    const conclusao = situacao === 'exec' && idx.mes !== undefined ? mesDoTexto(l[idx.mes]) : null;
    let safra = mesDaData(l[idx.entrada], mesPrimeiro);
    if (safra && safra < '2000-01') safra = null;
    if (!safra && situacao === 'exec') safra = conclusao;
    if (!safra) { semEntrada++; if (situacao !== 'tram') continue; } // tramitando sem data: backlog
    if (situacao === 'exec' && !conclusao) continue;
    contagem[situacao]++;
    const equipe = idx.equipe !== undefined ? txt(l[idx.equipe]) : '';
    const neo = idx.neo !== undefined ? txt(l[idx.neo]) : '';
    const usados = new Set();
    for (const r of modelo.regras) {
      if (!regraPega(r, classe, tipo)) continue;
      const q = (r.qtdVazia && idx[r.qtd] !== undefined && txt(l[idx[r.qtd]]) === '' ? r.qtdVazia : val(l, r.qtd)) || 0;
      if (!q) continue;
      somar(nome, equipe, { destino: r.destino, situacao, safra, conclusao }, q, val(l, r.valor) || 0);
      usados.add(r.destino);
    }
    // classe vazia ou desconhecida: conta como Alta (do tipo da linha, no B2C) e fica marcada como "classe assumida"
    const conhecida = modelo.regras.some((r) => (r.classes || r.prefixos) && regraPega(r, classe, tipo));
    if (!conhecida) {
      const r = modelo.regras.find((x) => ['alta', 'movel', 'fibra'].includes(x.destino) && (!x.tipos || x.tipos.map(chave).includes(tipo)));
      if (r) {
        somar(nome, equipe, { destino: r.destino, situacao, safra, conclusao, assumida: true }, val(l, r.qtd) || 1, val(l, r.valor) || 0);
        usados.add(r.destino);
        contagem.assumidas++;
      }
    }
    for (const e of modelo.extras || []) {
      if (e.excetoSe && usados.has(e.excetoSe)) continue;
      if (idx[e.coluna] === undefined || chave(txt(l[idx[e.coluna]])) !== chave(e.valor)) continue;
      let q = 1;
      if (e.qtd === 'pedido') {
        const k = neo ? `${e.destino}|${nome}|${situacao}|${safra}|${neo}` : null;
        if (k && vistos.has(k)) continue;
        if (k) vistos.add(k);
      } else q = val(l, e.qtd) || 0;
      if (q) somar(nome, equipe, { destino: e.destino, situacao, safra, conclusao }, q, 0);
    }
  }
  return { pessoas: [...pessoas.values()].map((p) => ({ nome: p.nome, equipe: p.equipe, itens: [...p.mapa.values()] })), semEntrada, contagem, mesPrimeiro };
}
