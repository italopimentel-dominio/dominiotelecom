// Importação da planilha "Indireto - Acompanhamento Diário Parceiros" (aba Indireto).
// Funções puras: rodam no navegador (prévia) e não gravam nada.
import { normalizar } from './nomes';
import { soDigitos, cpfValido, cnpjValido } from './indireto';

// Colunas por posição (A = 0). Linha 1 = período, linha 2 = cabeçalho, dados a partir da linha 3.
const C = { focal: 6, nome: 7, doc: 8, email: 9, tel: 10, status: 11, dataStatus: 12, obs: 13 }; // G..N
const ONB = [
  { data: 14, focal: 15, rotulo: 'ONB (colunas O–P)' },   // O, P
  { data: 32, focal: 33, rotulo: 'ONB (colunas AG–AH)' }, // AG, AH
];
const TREINOS = [
  { data: 20, focal: 21, tema: 22, participantes: 23, padrao: 'servicos', rotulo: 'Treinamento (colunas U–X)' },  // U..X
  { data: 26, focal: 27, tema: 28, participantes: 29, padrao: 'telecom', rotulo: 'Treinamento (colunas AA–AD)' }, // AA..AD
];
export const PRIMEIRA_LINHA = 3;

// a planilha tem espaços invisíveis (​) em várias células
export const limpo = (v) => String(v ?? '').replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
export const chaveNome = (v) => normalizar(limpo(v)).replace(/\s+/g, ' ').trim();

function valida(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  return !isNaN(d) && d.toISOString().slice(0, 10) === iso && iso >= '2000-01-01' ? iso : null;
}
// 28/08/2026, 28/08/26, 2026-08-28 ou número de data do Excel -> '2026-08-28'
export function dataIso(v) {
  if (v instanceof Date && !isNaN(v)) return valida(v.toISOString().slice(0, 10));
  if (typeof v === 'number') return v > 30000 && v < 80000 ? valida(new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10)) : null;
  const s = limpo(v);
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m) return valida(`${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? valida(m[0]) : null;
}

// Tema do treinamento: TELECOM -> telecom; DUOMNI / Domínio / Serviços -> servicos; vazio -> o do bloco
function tipoDoTema(tema, padrao) {
  const t = chaveNome(tema);
  if (!t) return padrao;
  if (t.includes('telecom')) return 'telecom';
  if (/duomni|dominio|servic/.test(t)) return 'servicos';
  return padrao;
}

export function documento(v) {
  const d = soDigitos(limpo(v));
  if (!d) return {};
  if (d.length <= 11 && cpfValido(d.padStart(11, '0'))) return { cpf: d.padStart(11, '0') };
  if (cnpjValido(d.padStart(14, '0'))) return { cnpj: d.padStart(14, '0') };
  return { invalido: limpo(v) };
}

// Lê as linhas (array de arrays) e separa cadastro e eventos (ONB e treinamentos)
export function lerPlanilhaIndireto(linhas) {
  const cad = new Map(); // chave -> { nome, linhas: [...] }
  const eventos = [];    // { chave, nome, tipo, data, focal, origem, linha, participante }
  let semData = 0, comNome = 0;
  for (let i = PRIMEIRA_LINHA - 1; i < (linhas || []).length; i++) {
    const l = linhas[i] || [];
    const n = i + 1;
    const nome = limpo(l[C.nome]);
    const k = chaveNome(nome);
    if (k) {
      comNome++;
      const dataStatus = dataIso(l[C.dataStatus]);
      // sem data na coluna M: o cadastro da linha não sobe
      if (!dataStatus) semData++;
      else {
        if (!cad.has(k)) cad.set(k, { chave: k, nome, linhas: [] });
        cad.get(k).linhas.push({
          linha: n, focal: limpo(l[C.focal]), status: limpo(l[C.status]), dataStatus,
          doc: documento(l[C.doc]), email: limpo(l[C.email]).toLowerCase(), tel: limpo(l[C.tel]), obs: limpo(l[C.obs]),
        });
      }
      ONB.forEach((o) => {
        const d = dataIso(l[o.data]);
        if (d) eventos.push({ chave: k, nome, tipo: 'onboarding', data: d, focal: limpo(l[o.focal]), origem: o.rotulo, linha: n, participante: false });
      });
    }
    // treinamentos: com participante preenchido, o treinamento é do participante; vazio, é do parceiro da linha
    TREINOS.forEach((t) => {
      const d = dataIso(l[t.data]);
      if (!d) return;
      const tipo = tipoDoTema(l[t.tema], t.padrao);
      const parts = String(l[t.participantes] ?? '').split(/[;\n]+/).map(limpo).filter((x) => chaveNome(x));
      const alvos = parts.length ? parts : k ? [nome] : [];
      alvos.forEach((p) => eventos.push({ chave: chaveNome(p), nome: p, tipo, data: d, focal: limpo(l[t.focal]), origem: t.rotulo, linha: n, participante: parts.length > 0 }));
    });
  }
  return { cad, eventos, semData, comNome };
}

// Nomes de ponto focal e textos de status que aparecem na planilha (para ligar aos do sistema)
export function nomesParaLigar(lido) {
  const focais = new Map(), status = new Map();
  lido.cad.forEach((c) => c.linhas.forEach((l) => {
    if (l.focal) focais.set(chaveNome(l.focal), l.focal);
    if (l.status) status.set(chaveNome(l.status), l.status);
  }));
  lido.eventos.forEach((e) => { if (e.focal) focais.set(chaveNome(e.focal), e.focal); });
  return {
    focais: [...focais.entries()].map(([chave, nome]) => ({ chave, nome })).sort((a, b) => a.nome.localeCompare(b.nome)),
    status: [...status.entries()].map(([chave, nome]) => ({ chave, nome })).sort((a, b) => a.nome.localeCompare(b.nome)),
  };
}

// Sugestões automáticas: apelido salvo; senão, o único usuário cujo nome (ou primeiro nome) bate
export function sugerirFocal(chave, focaisSistema, apelidosSalvos) {
  const salvo = apelidosSalvos.find((a) => a.apelido === chave);
  if (salvo) return { p1: salvo.profile_id || '-', p2: salvo.profile_id_2 || '' };
  const cands = focaisSistema.filter((f) => {
    const n = chaveNome(f.nome || f.usuario);
    return n === chave || n.split(' ')[0] === chave || chaveNome(f.usuario) === chave;
  });
  return cands.length === 1 ? { p1: cands[0].id, p2: '' } : { p1: '', p2: '' };
}
export function sugerirStatus(chave, statusLista) {
  const s = statusLista.find((x) => chaveNome(x.nome) === chave || x.chave === chave.replace(/\s+/g, '_'));
  return s ? s.chave : '';
}

const vazio = (v) => v === null || v === undefined || String(v).trim() === '';

// Monta tudo o que será gravado, a partir do que foi lido + o que existe no sistema + as escolhas da tela.
// ctx: { parceiros, treinosExistentes: Set('pid|tipo'), nomesColaboradores: Set(chave) }
// ligar: { focal: { chave: { p1, p2 } }, status: { chave: statusChave }, statusParticipante, colabModo: 'todos'|'ativos'|'nenhum' }
// escolhas: { idDoConflito: índice }
export function montarPlano(lido, ctx, ligar, escolhas = {}) {
  const porNome = new Map(), porDoc = new Map();
  (ctx.parceiros || []).forEach((p) => {
    [p.nome_fantasia, p.razao_social].filter(Boolean).forEach((n) => { const k = chaveNome(n); if (!porNome.has(k)) porNome.set(k, p); });
    [p.cpf, p.cnpj].filter(Boolean).forEach((d) => porDoc.set(d, p));
  });
  const focal = (nome) => { if (!nome) return { p1: null, p2: null }; const f = ligar.focal[chaveNome(nome)] || {}; return { p1: f.p1 && f.p1 !== '-' ? f.p1 : null, p2: f.p2 || null }; };
  const conflitos = [];
  const escolher = (id, titulo, opcoes) => {
    const i = escolhas[id];
    conflitos.push({ id, titulo, opcoes: opcoes.map((o) => o.rotulo), escolhido: i ?? null });
    return i == null ? null : opcoes[i];
  };

  const novos = [], atualizar = [], ignorados = { semFocalEscolhido: 0 };
  const destino = new Map(); // chave -> { id } (existente) ou { chave } (novo)
  const novoPorChave = new Map();
  const docsUsados = new Set();

  lido.cad.forEach((c) => {
    // ponto focal: se a mesma pessoa aparece com pontos focais diferentes, o usuário escolhe
    const nomesFocais = [...new Map(c.linhas.filter((l) => l.focal).map((l) => [chaveNome(l.focal), l.focal])).values()];
    let focalNome = nomesFocais[0] || '';
    if (nomesFocais.length > 1) {
      const op = escolher(`focal|${c.chave}`, `Ponto focal de ${c.nome}`, nomesFocais.map((n) => ({ rotulo: n, nome: n })));
      focalNome = op ? op.nome : null;
    }
    const base = [...c.linhas].sort((a, b) => b.dataStatus.localeCompare(a.dataStatus))[0]; // linha mais recente
    const doc = c.linhas.map((l) => l.doc).find((d) => d.cpf || d.cnpj) || {};
    const primeiro = (k) => c.linhas.map((l) => l[k]).find((v) => !vazio(v)) || null;
    const status = base.status ? ligar.status[chaveNome(base.status)] || null : null;
    const f = focalNome === null ? { p1: null } : focal(focalNome);
    if (focalNome === null) ignorados.semFocalEscolhido++;
    const obsDoc = c.linhas.map((l) => l.doc.invalido).find(Boolean);
    const dados = {
      cpf: doc.cpf || null, cnpj: doc.cnpj || null,
      contato_email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primeiro('email') || '') ? primeiro('email') : null,
      contato_telefone: primeiro('tel'),
      observacoes: [primeiro('obs'), obsDoc ? `Documento na planilha: ${obsDoc} (inválido)` : null].filter(Boolean).join(' | ') || null,
      status,
      ponto_focal_id: f.p1,
      data_ativacao: status === 'ativo' ? base.dataStatus : null,
    };
    const existente = (dados.cpf && porDoc.get(dados.cpf)) || (dados.cnpj && porDoc.get(dados.cnpj)) || porNome.get(c.chave);
    if (existente) {
      // não sobrescreve: só preenche o que está vazio (status só sai de "Aguardando interação")
      const campos = {};
      if (vazio(existente.cpf) && vazio(existente.cnpj) && (dados.cpf || dados.cnpj) && !porDoc.has(dados.cpf || dados.cnpj)) { campos.cpf = dados.cpf; campos.cnpj = dados.cnpj; }
      ['contato_email', 'contato_telefone', 'observacoes', 'ponto_focal_id', 'data_ativacao'].forEach((k) => { if (dados[k] && vazio(existente[k])) campos[k] = dados[k]; });
      if (dados.status && existente.status === 'aguardando_interacao' && dados.status !== existente.status) campos.status = dados.status;
      if (campos.status === 'ativo' && !campos.data_ativacao && vazio(existente.data_ativacao)) campos.data_ativacao = base.dataStatus;
      if (Object.keys(campos).length) atualizar.push({ id: existente.id, nome: existente.nome_fantasia, campos });
      destino.set(c.chave, { id: existente.id, status: existente.status });
    } else {
      const d = dados.cpf || dados.cnpj;
      if (d && docsUsados.has(d)) { dados.cpf = null; dados.cnpj = null; }
      if (d) docsUsados.add(d);
      const novo = { chave: c.chave, nome_fantasia: c.nome, ...dados, status: dados.status || 'aguardando_interacao' };
      novos.push(novo);
      novoPorChave.set(c.chave, novo);
      destino.set(c.chave, { chave: c.chave, status: novo.status });
    }
  });

  // eventos: acha o parceiro (existente, novo da planilha ou participante novo)
  const grupos = new Map(); // chave|tipo -> eventos
  let semParceiro = 0;
  lido.eventos.forEach((e) => {
    let alvo = destino.get(e.chave);
    if (!alvo && porNome.has(e.chave)) { const p = porNome.get(e.chave); alvo = { id: p.id, status: p.status }; destino.set(e.chave, alvo); }
    if (!alvo && e.participante) {
      // participante que não está no controle: entra como parceiro novo
      const novo = { chave: e.chave, nome_fantasia: e.nome, cpf: null, cnpj: null, contato_email: null, contato_telefone: null,
        observacoes: 'Cadastrado pela importação (participante de treinamento).', status: ligar.statusParticipante || 'aguardando_interacao',
        ponto_focal_id: null, data_ativacao: null };
      novos.push(novo); novoPorChave.set(e.chave, novo);
      alvo = { chave: e.chave, status: novo.status };
      destino.set(e.chave, alvo);
    }
    if (!alvo) { semParceiro++; return; }
    const k = `${e.chave}|${e.tipo}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(e);
  });

  const treinos = [];
  let jaTinham = 0;
  const NOME_TIPO = { onboarding: 'ONB', telecom: 'treinamento Telecom', servicos: 'treinamento Serviços' };
  grupos.forEach((lista, k) => {
    const [chave, tipo] = k.split('|');
    const alvo = destino.get(chave);
    if (alvo.id && ctx.treinosExistentes.has(`${alvo.id}|${tipo}`)) { jaTinham++; return; }
    // mesmo dia e mesma pessoa contam uma vez; se sobrar mais de um, o usuário escolhe
    const unicos = [...new Map(lista.map((e) => [`${e.data}|${chaveNome(e.focal)}`, e])).values()].sort((a, b) => a.data.localeCompare(b.data));
    let e = unicos[0];
    if (unicos.length > 1) {
      e = escolher(`ev|${k}`, `${NOME_TIPO[tipo]} de ${lista[0].nome}`,
        unicos.map((x) => ({ ...x, rotulo: `${x.data.slice(8)}/${x.data.slice(5, 7)}/${x.data.slice(0, 4)} · ${x.focal || 'sem ponto focal'} (linha ${x.linha})` })));
      if (!e) return;
    }
    const f = focal(e.focal);
    treinos.push({ ...(alvo.id ? { parceiro_id: alvo.id } : { chave }), nome: lista[0].nome, tipo, data: e.data, feito_por: f.p1, feito_por_2: f.p2 && f.p2 !== f.p1 ? f.p2 : null });
  });

  // colaboradores na equipe Indireto (só parceiros novos no controle e que ainda não são colaboradores)
  const comTreino = new Set(treinos.map((t) => t.chave || ''));
  const colaboradores = ligar.colabModo === 'nenhum' ? [] : novos
    .filter((n) => ligar.colabModo === 'todos' || n.status === 'ativo' || comTreino.has(n.chave))
    .filter((n) => !ctx.nomesColaboradores.has(n.chave))
    .map((n) => ({ chave: n.chave, nome: n.nome_fantasia, data_admissao: n.data_ativacao || treinos.filter((t) => t.chave === n.chave).map((t) => t.data).sort()[0] || null }));

  return {
    novos, atualizar, treinos, colaboradores, conflitos,
    contagem: { semData: lido.semData, semParceiro, jaTinham, semFocalEscolhido: ignorados.semFocalEscolhido },
    abertos: conflitos.filter((c) => c.escolhido == null).length,
  };
}
