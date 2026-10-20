'use server';
import { revalidatePath } from 'next/cache';
import { sessao, podeValidarIndireto } from '@/lib/auth';
import { normalizar } from '@/lib/nomes';
import { TIPOS_TREINAMENTO } from '@/lib/indireto';
import { buscarTodas } from '@/lib/buscarTodas';

const dataOk = (d) => d == null || /^\d{4}-\d{2}-\d{2}$/.test(String(d));
const chave = (s) => normalizar(String(s ?? '')).replace(/\s+/g, ' ').trim();
const vazio = (v) => v === null || v === undefined || String(v).trim() === '';
const CAMPOS = ['nome_fantasia', 'cpf', 'cnpj', 'contato_email', 'contato_telefone', 'observacoes', 'status', 'ponto_focal_id', 'data_ativacao'];

// Grava a importação da planilha de acompanhamento (só gerente ou administrador).
// dados: { focais: [{ apelido, profile_id, profile_id_2 }], novos, atualizar: [{ id, campos }],
//          treinos: [{ parceiro_id | chave, tipo, data, feito_por, feito_por_2 }], colaboradores: [{ chave, nome, data_admissao }], grupoId }
// Nunca sobrescreve: confere de novo no banco e só preenche o que está vazio.
export async function gravarImportacaoIndireto(dados) {
  const s = await sessao();
  if (!podeValidarIndireto(s.perfil)) return { erro: 'Só o gerente ou um administrador importa a planilha de acompanhamento.' };
  const { focais = [], novos = [], atualizar = [], treinos = [], colaboradores = [], grupoId = null } = dados || {};
  if (novos.length + atualizar.length + treinos.length > 6000) return { erro: 'Planilha grande demais para uma importação só.' };
  if (colaboradores.length && !grupoId) return { erro: 'Escolha a equipe Indireto para cadastrar os colaboradores.' };
  if (treinos.some((t) => !TIPOS_TREINAMENTO[t.tipo] || !dataOk(t.data) || !t.data)) return { erro: 'Há treinamento com tipo ou data inválida.' };
  if (novos.some((n) => !dataOk(n.data_ativacao)) || atualizar.some((a) => !dataOk(a.campos?.data_ativacao))) return { erro: 'Há data de ativação inválida.' };
  const db = s.supabase;

  // 1) apelidos dos pontos focais (para lembrar na próxima importação)
  if (focais.length) {
    const { error } = await db.from('indireto_focal_apelidos').upsert(focais.map((f) => ({
      apelido: chave(f.apelido), profile_id: f.profile_id || null, profile_id_2: f.profile_id_2 || null, atualizado_em: new Date().toISOString(),
    })));
    if (error) return { erro: /indireto_focal_apelidos/.test(error.message) ? 'Rode o arquivo 039_importar_acompanhamento.sql no Supabase.' : error.message };
  }

  // 2) o que existe agora (pode ter mudado desde a prévia)
  const atual = await buscarTodas(() => db.from('parceiros')
    .select('id, nome_fantasia, razao_social, cpf, cnpj, status, ponto_focal_id, data_ativacao, contato_email, contato_telefone, observacoes').order('id'));
  if (atual.error) return { erro: atual.error.message };
  const porId = new Map(atual.data.map((p) => [p.id, p]));
  const porNome = new Map(), docs = new Set();
  atual.data.forEach((p) => {
    [p.nome_fantasia, p.razao_social].filter(Boolean).forEach((n) => { if (!porNome.has(chave(n))) porNome.set(chave(n), p.id); });
    [p.cpf, p.cnpj].filter(Boolean).forEach((d) => docs.add(d));
  });

  // 3) parceiros novos (quem apareceu no banco enquanto isso vira atualização)
  const idDaChave = new Map();
  const inserir = [];
  const extras = [];
  for (const n of novos) {
    const k = chave(n.chave || n.nome_fantasia);
    if (!k || !String(n.nome_fantasia || '').trim()) continue;
    if (porNome.has(k)) { idDaChave.set(k, porNome.get(k)); extras.push({ id: porNome.get(k), campos: n }); continue; }
    const reg = Object.fromEntries(CAMPOS.map((c) => [c, vazio(n[c]) ? null : n[c]]));
    reg.nome_fantasia = String(n.nome_fantasia).trim();
    reg.status = reg.status || 'aguardando_interacao';
    if ((reg.cpf && docs.has(reg.cpf)) || (reg.cnpj && docs.has(reg.cnpj))) { reg.cpf = null; reg.cnpj = null; }
    [reg.cpf, reg.cnpj].filter(Boolean).forEach((d) => docs.add(d));
    porNome.set(k, null);
    inserir.push({ k, reg });
  }
  for (let i = 0; i < inserir.length; i += 500) {
    const parte = inserir.slice(i, i + 500);
    const { data, error } = await db.from('parceiros').insert(parte.map((x) => x.reg)).select('id, nome_fantasia');
    if (error) return { erro: /parceiros_status_fkey/.test(error.message) ? 'Um dos status não existe mais. Atualize a página e ligue de novo.' : `Erro ao cadastrar parceiros: ${error.message}` };
    (data || []).forEach((p) => idDaChave.set(chave(p.nome_fantasia), p.id));
  }

  // 4) parceiros que já existiam: só preenche campo vazio
  let atualizados = 0;
  const pendentes = [...atualizar, ...extras];
  for (let i = 0; i < pendentes.length; i += 20) {
    const res = await Promise.all(pendentes.slice(i, i + 20).map(async ({ id, campos }) => {
      const p = porId.get(id);
      if (!p) return null;
      const mud = {};
      ['contato_email', 'contato_telefone', 'observacoes', 'ponto_focal_id', 'data_ativacao'].forEach((c) => { if (!vazio(campos?.[c]) && vazio(p[c])) mud[c] = campos[c]; });
      if (vazio(p.cpf) && vazio(p.cnpj) && (campos?.cpf || campos?.cnpj) && !docs.has(campos.cpf || campos.cnpj)) { mud.cpf = campos.cpf || null; mud.cnpj = campos.cnpj || null; }
      if (!vazio(campos?.status) && p.status === 'aguardando_interacao' && campos.status !== p.status) mud.status = campos.status;
      if (!Object.keys(mud).length) return null;
      const { error } = await db.from('parceiros').update(mud).eq('id', id);
      return error ? `${p.nome_fantasia}: ${error.message}` : 'ok';
    }));
    const erro = res.find((r) => r && r !== 'ok');
    if (erro) return { erro: `Erro ao completar parceiros (${erro}). O que veio antes já foi gravado.` };
    atualizados += res.filter((r) => r === 'ok').length;
  }

  // 5) treinamentos realizados (não repete tipo que o parceiro já tem)
  const ids = [...new Set(treinos.map((t) => t.parceiro_id || idDaChave.get(chave(t.chave))).filter(Boolean))];
  const ja = new Set();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from('parceiro_treinamentos').select('parceiro_id, tipo').in('parceiro_id', ids.slice(i, i + 200)).eq('status', 'realizado');
    if (error) return { erro: error.message };
    (data || []).forEach((t) => ja.add(`${t.parceiro_id}|${t.tipo}`));
  }
  const regsT = [];
  for (const t of treinos) {
    const pid = t.parceiro_id || idDaChave.get(chave(t.chave));
    if (!pid || ja.has(`${pid}|${t.tipo}`)) continue;
    ja.add(`${pid}|${t.tipo}`);
    regsT.push({ parceiro_id: pid, tipo: t.tipo, data: t.data, status: 'realizado', feito_por: t.feito_por || null, feito_por_2: t.feito_por_2 || null, observacao: 'Importado da planilha de acompanhamento.' });
  }
  for (let i = 0; i < regsT.length; i += 500) {
    const { error } = await db.from('parceiro_treinamentos').insert(regsT.slice(i, i + 500));
    if (error) return { erro: /feito_por_2/.test(error.message) ? 'Rode o arquivo 039_importar_acompanhamento.sql no Supabase.' : `Erro ao gravar treinamentos: ${error.message}` };
  }

  // 6) colaboradores na equipe Indireto (quem ainda não está cadastrado com esse nome)
  let colabs = 0;
  if (colaboradores.length) {
    const [c, a] = await Promise.all([
      buscarTodas(() => db.from('colaboradores').select('id, nome').order('id')),
      buscarTodas(() => db.from('colaborador_apelidos').select('apelido').order('apelido')),
    ]);
    if (c.error) return { erro: c.error.message };
    const existem = new Set([...(c.data || []).map((x) => chave(x.nome)), ...((a.data || []).map((x) => chave(x.apelido)))]);
    const regs = [];
    colaboradores.forEach((x) => {
      const k = chave(x.nome);
      if (!k || existem.has(k)) return;
      existem.add(k);
      regs.push({ nome: String(x.nome).trim(), grupo_id: grupoId, peso: 1, data_admissao: dataOk(x.data_admissao) ? x.data_admissao : null });
    });
    for (let i = 0; i < regs.length; i += 500) {
      const { error } = await db.from('colaboradores').insert(regs.slice(i, i + 500));
      if (error) return { erro: `Erro ao cadastrar colaboradores: ${error.message}. Parceiros e treinamentos já foram gravados.` };
    }
    colabs = regs.length;
  }

  revalidatePath('/', 'layout');
  return { ok: true, novos: inserir.length, atualizados, treinos: regsT.length, colaboradores: colabs };
}
