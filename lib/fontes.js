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

// "outubro_2026" -> "2026-10"
export function mesDoTexto(s) {
  const m = normalizar(txt(s)).match(/([a-z]+)[\s_/-]*(\d{4})/);
  if (!m) return null;
  const i = MESES.indexOf(m[1]);
  return i >= 0 ? `${m[2]}-${String(i + 1).padStart(2, '0')}` : null;
}

// Modelos de leitura. Cada um diz quais colunas usa e o que conta em cada produto.
export const MODELOS = {
  pedidos_movel: {
    nome: 'Pedidos móvel (Alta, Renovação e Aparelhos)',
    colunas: {
      consultor: 'CONSULTOR', neo: 'NEO', equipe: 'EQUIPE CANAL DIRETO',
      linhas: 'QUANTIDADE LINHAS', valorLinha: 'VALOR TERMO SMP', aparelhos: 'QTD APARELHOS', valorAparelho: 'VALOR APARELHO',
      classe: 'GRUPO CLASSE', status: 'GRUPO STATUS', mes: 'MÊS/ANO CONCLUSÃO',
    },
    // destino -> rótulo do produto (o sistema sugere o produto pelo nome)
    destinos: { alta: 'Alta Móvel', reno: 'Reno Móvel', aparelhos: 'Aparelhos' },
    regras: [
      { destino: 'alta', classes: ['ALTA', 'MIGRACAO PRE/POS'], qtd: 'linhas', valor: 'valorLinha' },
      { destino: 'reno', classes: ['RENOVACAO', 'RENOVACAO POSITIVA'], qtd: 'linhas', valor: 'valorLinha' },
      { destino: 'aparelhos', classes: null, qtd: 'aparelhos', valor: 'valorAparelho' },
    ],
    ignorarClasses: ['NAO CONTABILIZA'],
    statusConta: 'EXECUTADO',
  },
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
  const obrig = ['consultor', 'classe', 'status', 'mes', 'linhas'];
  if (obrig.some((k) => idx[k] === undefined)) return { erro: `Colunas não encontradas na planilha: ${faltando.join(', ')}` };

  const pessoas = new Map(); // nome -> { nome, equipe, meses: { "2026-10": { alta: {qtd, valor}, ... } } }
  const pendencias = { semValor: [], semMes: [], mesInvalido: [] };
  const contagem = { total: 0, contadas: 0, naoExecutadas: 0, naoContabiliza: 0, semClasse: 0 };
  const val = (l, k) => (idx[k] === undefined ? null : numero(l[idx[k]]));
  const ignorar = new Set(modelo.ignorarClasses.map(chave));

  for (const l of linhas.slice(1)) {
    const nome = txt(l[idx.consultor]);
    if (!nome) continue;
    contagem.total++;
    if (chave(txt(l[idx.status])) !== chave(modelo.statusConta)) { contagem.naoExecutadas++; continue; }
    const classe = chave(txt(l[idx.classe]));
    if (ignorar.has(classe)) { contagem.naoContabiliza++; continue; }
    const textoMes = txt(l[idx.mes]);
    const mes = mesDoTexto(textoMes);
    const ref = { consultor: nome, neo: idx.neo !== undefined ? txt(l[idx.neo]) : '', classe: txt(l[idx.classe]) };
    if (!textoMes) { pendencias.semMes.push(ref); continue; }
    if (!mes) { pendencias.mesInvalido.push({ ...ref, mes: textoMes }); continue; }

    let usou = false;
    for (const r of modelo.regras) {
      if (r.classes && !r.classes.map(chave).includes(classe)) continue;
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
