// Tempo falado: lê os relatórios do LeadsBuilder, do 3C e das folhas de ponto e consolida por pessoa.
import { normalizar } from './nomes';

export const seg = (t) => {
  const p = String(t ?? '').trim().split(':').map((x) => Number(x) || 0);
  if (p.length < 2) return 0;
  while (p.length < 3) p.unshift(0);
  return p[0] * 3600 + p[1] * 60 + p[2];
};
export const hms = (s) => {
  const v = Math.round(Number(s) || 0);
  return `${Math.floor(v / 3600)}:${String(Math.floor((v % 3600) / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
};
const limpo = (s) => String(s ?? '').replace(/^\s+|\s+$/g, '');
const chave = (s) => normalizar(s).replace(/[0-9]/g, ' ').replace(/\s+/g, ' ').trim();

// CSV com ";" (aspas opcionais)
export function lerCsv(texto) {
  const linhas = [];
  let linha = [], campo = '', aspas = false;
  const t = texto.replace(/^\ufeff/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') aspas = false; else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ';') { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      linha.push(campo); campo = '';
      if (linha.some((x) => x !== '')) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((x) => x !== '')) linhas.push(linha);
  return linhas;
}

// Descobre o tipo do arquivo pelo cabeçalho
export function tipoDoArquivo(linhas) {
  for (const l of linhas.slice(0, 15)) {
    const cab = l.map((c) => chave(c));
    if (cab.includes('operador') && cab.includes('falando')) return 'leadsbuilder';
    if (cab.includes('agent name') && cab.includes('speaking')) return '3c';
    if (cab.includes('funcionario') && cab.some((c) => c.startsWith('registro de ponto'))) return 'ponto';
  }
  return null;
}

// LeadsBuilder: "Nome (login)", Falando e TMA da própria plataforma
export function lerLeadsBuilder(linhas) {
  const cab = linhas[0].map((c) => chave(c));
  const iOp = cab.indexOf('operador'), iFal = cab.indexOf('falando'), iTma = cab.indexOf('tma');
  return linhas.slice(1).map((l) => {
    const bruto = limpo(l[iOp]);
    if (!bruto) return null; // linha de total
    const login = (bruto.match(/\(([^)]+)\)/) || [])[1] || null;
    const nome = bruto.replace(/\s*\(.*$/, '').replace(/\s*-\s*\d+$/, '').trim();
    return { nome, login, falando: seg(l[iFal]), tma: seg(l[iTma]) };
  }).filter((x) => x && x.falando > 0);
}

// 3C: Falando = speaking + MTPA (manual_acw) + manual; TMA = Falando ÷ calls
export function ler3C(linhas) {
  const cab = linhas[0].map((c) => limpo(c).toLowerCase());
  const i = (k) => cab.indexOf(k);
  return linhas.slice(1).map((l) => {
    const nome = limpo(l[i('agent_name')]).replace(/\((Operador|Vendedor)\)/gi, '').replace(/\bConsultor\b/gi, '').trim();
    const speaking = seg(l[i('speaking')]), mtpa = seg(l[i('manual_acw')]), manual = seg(l[i('manual')]);
    return { nome, speaking, mtpa, manual, falando: speaking + mtpa + manual, calls: Number(l[i('calls')]) || 0 };
  }).filter((x) => x.nome && x.falando > 0);
}

// Folha de ponto (relatório de presentes): conta os dias "Presente" por funcionário
export function lerPonto(linhas, empresa) {
  const dias = new Map();
  let iSt = -1, iData = -1, iNome = -1;
  for (const l of linhas) {
    const c = l.map((x) => limpo(x));
    if (iNome < 0) {
      const k = c.map(chave);
      if (k.includes('funcionario')) { iSt = k.indexOf('status'); iData = k.indexOf('data'); iNome = k.indexOf('funcionario'); }
      continue;
    }
    if (!/^presente/i.test(c[iSt] || '') || !/^\d{2}\/\d{2}\/\d{4}/.test(c[iData] || '')) continue;
    const nome = c[iNome];
    if (!nome) continue;
    const d = dias.get(nome) || { nome, empresa, datas: new Set() };
    d.datas.add(c[iData]);
    dias.set(nome, d);
  }
  return [...dias.values()].map((d) => ({ nome: d.nome, empresa: d.empresa, dias: d.datas.size }));
}

// ---------- casamento de nomes ----------
const tokOk = (a, b) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));
const contem = (curto, longo) => curto.every((a) => longo.some((b) => tokOk(a, b)));

// candidatos: [{ chave, ref }]. Devolve a ref do único candidato que bate, ou null.
export function casarNome(nome, candidatos) {
  const k = chave(nome);
  if (!k) return null;
  const exato = candidatos.filter((c) => c.chave === k);
  if (exato.length) return exato[0].ref;
  // o ponto corta o nome em 40 caracteres
  const pre = candidatos.filter((c) => c.chave.length >= 25 && (k.startsWith(c.chave) || c.chave.startsWith(k)));
  if (pre.length === 1) return pre[0].ref;
  const t = k.split(' ');
  for (const mesmoPrimeiro of [true, false]) {
    const cand = candidatos.filter((c) => {
      const ct = c.chave.split(' ');
      return (!mesmoPrimeiro || tokOk(ct[0], t[0])) && contem(t, ct);
    });
    const unicos = [...new Set(cand.map((c) => c.ref))];
    if (unicos.length === 1) return unicos[0];
  }
  return null;
}

// Consolida. colaboradores: [{ id, nome }]; apelidos: Map(apelidoNormalizado -> colaborador_id); vinculos: Map(chave -> colaborador_id) escolhidos agora
export function consolidar({ lb = [], c3 = [], ponto = [], colaboradores = [], apelidos = new Map(), vinculos = new Map() }) {
  const candColab = colaboradores.map((c) => ({ chave: chave(c.nome), ref: c.id }));
  const nomeColab = new Map(colaboradores.map((c) => [c.id, c.nome]));
  const acharColab = (nome) => {
    const k = chave(nome);
    return vinculos.get(k) || apelidos.get(normalizar(nome)) || apelidos.get(k) || casarNome(nome, candColab);
  };
  const pessoas = new Map(); // id do colaborador ou "nome:<chave>"
  const pessoa = (nome) => {
    const id = acharColab(nome);
    const k = id || `nome:${chave(nome)}`;
    if (!pessoas.has(k)) pessoas.set(k, { chave: k, colaborador_id: id || null, nome: id ? nomeColab.get(id) : nome.toUpperCase(), nomesOrigem: new Set(), lb: 0, lbTma: 0, lbLig: 0, c3: 0, speaking: 0, mtpa: 0, manual: 0, c3Lig: 0, dias: 0, empresa: null });
    const p = pessoas.get(k);
    p.nomesOrigem.add(nome);
    return p;
  };
  lb.forEach((r) => { const p = pessoa(r.nome); p.lb += r.falando; p.lbTma = r.tma; p.lbLig += r.tma ? r.falando / r.tma : 0; if (r.login) p.login = r.login; });
  c3.forEach((r) => { const p = pessoa(r.nome); p.c3 += r.falando; p.speaking += r.speaking; p.mtpa += r.mtpa; p.manual += r.manual; p.c3Lig += r.calls; });

  // dias: liga cada nome do ponto a uma pessoa dos discadores (pelo colaborador ou pelo nome)
  const candPessoas = [];
  pessoas.forEach((p) => {
    candPessoas.push({ chave: chave(p.nome), ref: p.chave });
    p.nomesOrigem.forEach((n) => candPessoas.push({ chave: chave(n), ref: p.chave }));
  });
  const semDiscador = [];
  ponto.forEach((r) => {
    const id = acharColab(r.nome);
    const alvo = (id && pessoas.has(id) && id) || casarNome(r.nome, candPessoas);
    if (alvo && pessoas.has(alvo)) { const p = pessoas.get(alvo); p.dias += r.dias; p.empresa = r.empresa; } else semDiscador.push(r);
  });

  const linhas = [...pessoas.values()].map((p) => {
    const falando = p.lb + p.c3;
    const lig = p.lbLig + p.c3Lig;
    // só LeadsBuilder: TMA da própria plataforma; com 3C: ponderado pelas ligações
    const tma = p.c3 === 0 ? p.lbTma : lig ? falando / lig : 0;
    const alertas = [];
    if (!p.colaborador_id) alertas.push('nome não vinculado a um colaborador');
    if (!p.dias) alertas.push('sem dias no ponto');
    if (p.manual > p.speaking * 3 && p.manual > 3600) alertas.push('3C: manual muito maior que speaking');
    return { ...p, nomesOrigem: [...p.nomesOrigem], falando, ligacoes: Math.round(lig), tma: Math.round(tma), media: p.dias ? Math.round(falando / p.dias) : 0, alertas };
  }).sort((a, b) => b.falando - a.falando);
  return { linhas, naoVinculados: linhas.filter((l) => !l.colaborador_id), semDiscador };
}
