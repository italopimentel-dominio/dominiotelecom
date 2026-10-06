// Leitura de planilhas de pedidos (fonte de dados) e regras de contagem.
import { normalizar } from './nomes';
import { numero } from './formato';

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
      classe: 'GRUPO CLASSE', status: 'GRUPO STATUS', mes: 'MÊS/ANO CONCLUSÃO',
    },
    obrigatorias: ['consultor', 'classe', 'status', 'mes', 'linhas'],
    // destino -> rótulo do produto (o sistema sugere o produto pelo nome)
    destinos: { alta: 'Alta Móvel', reno: 'Reno Móvel', aparelhos: 'Aparelhos' },
    regras: [
      { destino: 'alta', classes: ['ALTA', 'MIGRACAO PRE/POS'], qtd: 'linhas', valor: 'valorLinha' },
      { destino: 'reno', prefixos: ['RENOVACAO'], qtd: 'linhas', valor: 'valorLinha' },
      { destino: 'aparelhos', classes: null, qtd: 'aparelhos', valor: 'valorAparelho' },
    ],
    ignorarClasses: ['NAO CONTABILIZA'],
    statusConta: 'EXECUTADO',
    regrasTexto: 'Só GRUPO STATUS = EXECUTADO, no mês de MÊS/ANO CONCLUSÃO. Alta = ALTA ou MIGRAÇÃO PRÉ/PÓS; Renovação = qualquer classe que comece com RENOVAÇÃO (quantidade em QUANTIDADE LINHAS, receita em VALOR TERMO SMP); Aparelhos = QTD APARELHOS e VALOR APARELHO. "NÃO CONTABILIZA" nunca conta.',
  },
  pedidos_fibra: {
    nome: 'Pedidos fibra (Alta e Renovação)',
    nomePadrao: 'Planilha gerencial fibra',
    colunas: {
      consultor: 'CONSULTOR', neo: 'NEO', qtd: 'Quant.', valor: 'VALOR TOTAL', tipo: 'TIPO PRODUTO',
      equipe: 'EQUIPE CANAL DIRETO', classe: 'GRUPO CLASSE', status: 'GRUPO STATUS', mes: 'MÊS CONCLUSÃO',
    },
    obrigatorias: ['consultor', 'qtd', 'tipo', 'classe', 'status', 'mes'],
    destinos: { alta: 'Alta Fibra', reno: 'Reno Fibra' },
    tiposConta: ['BANDA LARGA', 'TV', 'VOZ'],
    regras: [
      { destino: 'alta', classes: ['ALTA'], prefixos: ['MIGRACAO'], qtd: 'qtd', valor: 'valor' },
      { destino: 'reno', prefixos: ['RENOVACAO'], qtd: 'qtd', valor: 'valor' },
    ],
    ignorarClasses: ['NAO CONTABILIZA'],
    statusConta: 'EXECUTADO',
    regrasTexto: 'Só GRUPO STATUS = EXECUTADO e TIPO PRODUTO = BANDA LARGA, TV ou VOZ, no mês de MÊS CONCLUSÃO. Alta = ALTA ou qualquer MIGRAÇÃO; Renovação = qualquer classe que comece com RENOVAÇÃO (RENOVAÇÃO PADRÃO, RENOVAÇÃO UP...). Quantidade em Quant., receita em VALOR TOTAL. "NÃO CONTABILIZA" nunca conta.',
  },
  pedidos_vada: {
    nome: 'Pedidos VADA (Alta VADA)',
    nomePadrao: 'Planilha gerencial VADA',
    colunas: {
      consultor: 'CONSULTOR', qtd: 'QTD', valor: 'VALOR TOTAL', equipe: 'EQUIPE CANAL INTERNO',
      classe: 'CLASSE', status: 'STATUS 1', mes: 'MÊS/ANO F1',
    },
    obrigatorias: ['consultor', 'qtd', 'classe', 'status', 'mes'],
    destinos: { alta: 'Alta VADA' },
    regras: [
      { destino: 'alta', classes: null, qtd: 'qtd', valor: 'valor' },
    ],
    ignorarClasses: ['NAO CONTABILIZA'],
    statusConta: 'APROVADO - ENVIADO P/ INSTALAÇÃO',
    regrasTexto: 'Só STATUS 1 = APROVADO - ENVIADO P/ INSTALAÇÃO, no mês de MÊS/ANO F1. Quantidade em QTD, receita em VALOR TOTAL. Conta qualquer CLASSE, menos "NÃO CONTABILIZA".',
  },
};

const regraPega = (r, classe) => {
  if (!r.classes && !r.prefixos) return true;
  if (r.classes && r.classes.map(chave).includes(classe)) return true;
  return !!r.prefixos && r.prefixos.some((p) => classe.startsWith(chave(p)));
};

// linhas: array de arrays (1ª linha = cabeçalho). Devolve os totais por mês, pessoa e destino + pendências.
export function lerPedidos(linhas, modelo = MODELOS.pedidos_movel) {
  const cab = (linhas[0] || []).map((c) => chave(txt(c)));
  const idx = {};
  const faltando = [];
  Object.entries(modelo.colunas).forEach(([k, nome]) => {
    const i = cab.indexOf(chave(nome));
    if (i < 0) faltando.push(nome); else idx[k] = i;
  });
  const obrig = modelo.obrigatorias || ['consultor', 'classe', 'status', 'mes'];
  if (obrig.some((k) => idx[k] === undefined)) return { erro: `Colunas não encontradas na planilha: ${faltando.join(', ')}` };

  const pessoas = new Map(); // nome -> { nome, equipe, meses: { "2026-10": { alta: {qtd, valor}, ... } } }
  const pendencias = { semValor: [], semMes: [], mesInvalido: [] };
  const contagem = { total: 0, contadas: 0, naoExecutadas: 0, naoContabiliza: 0, semClasse: 0, tipoFora: 0, classes: {} };
  const tipos = modelo.tiposConta ? new Set(modelo.tiposConta.map(chave)) : null;
  const val = (l, k) => (idx[k] === undefined ? null : numero(l[idx[k]]));
  const ignorar = new Set(modelo.ignorarClasses.map(chave));

  for (const l of linhas.slice(1)) {
    const nome = txt(l[idx.consultor]);
    if (!nome) continue;
    contagem.total++;
    if (chave(txt(l[idx.status])) !== chave(modelo.statusConta)) { contagem.naoExecutadas++; continue; }
    if (tipos && !tipos.has(chave(txt(l[idx.tipo])))) { contagem.tipoFora++; continue; }
    const classe = chave(txt(l[idx.classe]));
    if (ignorar.has(classe)) { contagem.naoContabiliza++; continue; }
    // resumo das classes encontradas e para onde cada uma foi (para conferir na prévia)
    const rotClasse = txt(l[idx.classe]).toUpperCase() || '(sem classe)';
    const destinosClasse = modelo.regras.filter((r) => regraPega(r, classe)).map((r) => r.destino);
    const rc = (contagem.classes[rotClasse] = contagem.classes[rotClasse] || { linhas: 0, destinos: destinosClasse });
    rc.linhas++;
    const textoMes = txt(l[idx.mes]);
    const mes = mesDoTexto(textoMes);
    const ref = { consultor: nome, neo: idx.neo !== undefined ? txt(l[idx.neo]) : '', classe: txt(l[idx.classe]) };
    if (!textoMes) { pendencias.semMes.push(ref); continue; }
    if (!mes) { pendencias.mesInvalido.push({ ...ref, mes: textoMes }); continue; }

    let usou = false;
    for (const r of modelo.regras) {
      if (!regraPega(r, classe)) continue;
      const q = val(l, r.qtd) || 0;
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
    }
    if (usou) contagem.contadas++; else contagem.semClasse++;
  }
  const meses = [...new Set([...pessoas.values()].flatMap((p) => Object.keys(p.meses)))].sort();
  return { pessoas: [...pessoas.values()], meses, pendencias, contagem, faltando };
}
