'use server';
import { revalidatePath } from 'next/cache';
import { sessao, ehAdmin } from '@/lib/auth';
import { buscarTodas } from '@/lib/buscarTodas';

const STATUS = ['P', 'F', 'A'];
const dataOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d));
const erroTabela = (m) => (/assiduidade|grupos_lancaveis/.test(m) ? 'Rode o arquivo 032_assiduidade.sql no Supabase.' : /row-level security/.test(m) ? 'Você só pode lançar a assiduidade das suas equipes.' : m);

// Equipes que o usuário pode lançar (null = todas, para administrador)
async function equipesPermitidas(s) {
  if (ehAdmin(s.perfil)) return null;
  const { data, error } = await s.supabase.rpc('grupos_lancaveis');
  if (error) return new Set();
  return new Set((data || []).map((x) => (typeof x === 'string' ? x : x.grupos_lancaveis)));
}

// Uma célula: status P/F/A, ou vazio para apagar
export async function marcarAssiduidade(colaboradorId, data, status, grupoId) {
  const s = await sessao();
  if (!s?.perfil?.ativo) return { erro: 'Faça login de novo.' };
  if (!dataOk(data)) return { erro: 'Data inválida.' };
  const db = s.supabase;
  if (!status) {
    const { error } = await db.from('assiduidade').delete().eq('colaborador_id', colaboradorId).eq('data', data);
    return error ? { erro: erroTabela(error.message) } : { ok: true };
  }
  if (!STATUS.includes(status)) return { erro: 'Status inválido.' };
  const { error } = await db.from('assiduidade').upsert({
    colaborador_id: colaboradorId, data, status, grupo_id: grupoId, origem: 'manual',
    atualizado_por: s.user.id, atualizado_em: new Date().toISOString(),
  });
  return error ? { erro: erroTabela(error.message) } : { ok: true };
}

// Vários de uma vez (botão "todos presentes", ponto, planilha).
// registros: [{ colaborador_id, data, status, grupo_id }]; soVazios = não sobrescreve o que já foi marcado
// soSobreAutomaticos = não mexe no que foi marcado à mão ou pela planilha; atualiza o que veio do próprio ponto
export async function lancarAssiduidadeEmLote(registros, { origem = 'manual', soVazios = false, soSobreAutomaticos = false } = {}) {
  const s = await sessao();
  if (!s?.perfil?.ativo) return { erro: 'Faça login de novo.' };
  if (!Array.isArray(registros) || registros.length > 5000) return { erro: 'Envie no máximo 5.000 marcações por vez.' };
  const db = s.supabase;
  const permitidas = await equipesPermitidas(s);
  let regs = registros.filter((r) => r.colaborador_id && dataOk(r.data) && STATUS.includes(r.status));
  const semPermissao = permitidas ? regs.filter((r) => !permitidas.has(r.grupo_id)).length : 0;
  if (permitidas) regs = regs.filter((r) => permitidas.has(r.grupo_id));
  if ((soVazios || soSobreAutomaticos) && regs.length) {
    const datas = regs.map((r) => r.data).sort();
    // todas as marcações existentes (passa do limite de 1.000 linhas; senão marcação manual podia ser sobrescrita)
    const ids = [...new Set(regs.map((r) => r.colaborador_id))];
    const existentes = [];
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await buscarTodas(() => db.from('assiduidade').select('colaborador_id, data, origem')
        .in('colaborador_id', ids.slice(i, i + 200)).gte('data', datas[0]).lte('data', datas.at(-1))
        .order('colaborador_id').order('data'));
      if (error) return { erro: erroTabela(error.message) };
      existentes.push(...data);
    }
    // soberanas: marcação manual (e a planilha antiga). Com soSobreAutomaticos, o que veio do ponto pode ser atualizado.
    const ja = new Set((existentes || []).filter((e) => soVazios || e.origem !== 'ponto').map((e) => `${e.colaborador_id}|${e.data}`));
    regs = regs.filter((r) => !ja.has(`${r.colaborador_id}|${r.data}`));
  }
  const agora = new Date().toISOString();
  const linhas = [...new Map(regs.map((r) => [`${r.colaborador_id}|${r.data}`, {
    colaborador_id: r.colaborador_id, data: r.data, status: r.status, grupo_id: r.grupo_id || null,
    origem, atualizado_por: s.user.id, atualizado_em: agora,
  }])).values()];
  for (let i = 0; i < linhas.length; i += 1000) {
    const { error } = await db.from('assiduidade').upsert(linhas.slice(i, i + 1000));
    if (error) return { erro: erroTabela(error.message) };
  }
  revalidatePath('/assiduidade');
  return { ok: true, gravados: linhas.length, semPermissao };
}
