'use server';
import { revalidatePath } from 'next/cache';
import { sessao, podeEditar } from '@/lib/auth';
import { normalizar } from '@/lib/nomes';

// Chave dos valores: "produto_id|medida" (medida = qtd ou brl). Sem medida = qtd.
function separar(item) {
  const [pid, medida = 'qtd'] = String(item).split('|');
  return [pid, medida === 'brl' ? 'brl' : 'qtd'];
}

async function gravar(db, tabela, campo, periodo_id, modo, mapa) {
  // mapa: "id|produto|medida" -> valor
  if (!mapa.size) return null;
  if (modo === 'somar') {
    const ids = [...new Set([...mapa.keys()].map((k) => k.split('|')[0]))];
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await db.from(tabela).select(`${campo}, produto_id, valor, medida`)
        .eq('periodo_id', periodo_id).in(campo, ids.slice(i, i + 200));
      if (error) return error.message;
      (data || []).forEach((r) => {
        const k = `${r[campo]}|${r.produto_id}|${r.medida || 'qtd'}`;
        if (mapa.has(k)) mapa.set(k, mapa.get(k) + Number(r.valor));
      });
    }
  }
  const registros = [...mapa.entries()].map(([k, valor]) => {
    const [id, produto_id, medida] = k.split('|');
    return { periodo_id, [campo]: id, produto_id, medida, valor: Math.round(valor * 100) / 100 };
  });
  for (let i = 0; i < registros.length; i += 500) {
    const { error } = await db.from(tabela).upsert(registros.slice(i, i + 500));
    if (error) return error.message;
  }
  return null;
}

// dados = {
//   modo: 'substituir' | 'somar',
//   novos: [{ chave, nome, grupo_id }],
//   lotes: [{ periodo_id, pessoas: [{ colaborador_id?, chave?, apelido?, valores: { "produto|medida": n } }],
//             grupos: [{ grupo_id, valores }] }]
// }
export async function importarLotes(dados) {
  const s = await sessao();
  if (!podeEditar(s.perfil)) return { erro: 'Seu usuário só tem permissão para visualizar.' };
  const db = s.supabase;
  const { modo, novos = [], lotes = [] } = dados || {};
  if (!lotes.length) return { erro: 'Nada para importar.' };
  if (lotes.some((l) => !l.periodo_id)) return { erro: 'Escolha o período.' };
  if (novos.some((n) => !n.grupo_id || !n.nome?.trim())) return { erro: 'Escolha a equipe de todos os colaboradores novos.' };

  const idDaChave = new Map();
  if (novos.length) {
    const registros = novos.map((n) => {
      const id = crypto.randomUUID();
      idDaChave.set(n.chave, id);
      return { id, nome: n.nome.trim(), grupo_id: n.grupo_id, peso: 1 };
    });
    const { error } = await db.from('colaboradores').insert(registros);
    if (error) return { erro: `Não foi possível cadastrar os colaboradores novos: ${error.message}` };
  }

  const apelidos = new Map();
  let total = 0, pessoasTotal = new Set();
  for (const lote of lotes) {
    const mapaP = new Map(), mapaG = new Map();
    for (const p of lote.pessoas || []) {
      const cid = p.colaborador_id || idDaChave.get(p.chave);
      if (!cid) continue;
      if (p.apelido) apelidos.set(normalizar(p.apelido), cid);
      for (const [item, v] of Object.entries(p.valores || {})) {
        if (v === null || v === undefined || !isFinite(v)) continue;
        const [pid, m] = separar(item);
        const k = `${cid}|${pid}|${m}`;
        mapaP.set(k, (mapaP.get(k) || 0) + Number(v));
        pessoasTotal.add(cid);
      }
    }
    for (const g of lote.grupos || []) {
      if (!g.grupo_id) continue;
      for (const [item, v] of Object.entries(g.valores || {})) {
        if (v === null || v === undefined || !isFinite(v)) continue;
        const [pid, m] = separar(item);
        const k = `${g.grupo_id}|${pid}|${m}`;
        mapaG.set(k, (mapaG.get(k) || 0) + Number(v));
      }
    }
    const e1 = await gravar(db, 'realizados', 'colaborador_id', lote.periodo_id, modo, mapaP);
    if (e1) return { erro: `Erro ao gravar os resultados: ${e1}` };
    const e2 = await gravar(db, 'realizados_grupo', 'grupo_id', lote.periodo_id, modo, mapaG);
    if (e2) return { erro: `Erro ao gravar os resultados das equipes: ${e2}` };
    total += mapaP.size + mapaG.size;
  }
  if (!total) return { erro: 'Nenhum valor numérico encontrado.' };

  if (apelidos.size) {
    await db.from('colaborador_apelidos').upsert([...apelidos.entries()].map(([apelido, colaborador_id]) => ({ apelido, colaborador_id })));
  }
  revalidatePath('/', 'layout');
  return {
    ok: `${total} resultados importados (${pessoasTotal.size} colaboradores${lotes.length > 1 ? `, ${lotes.length} meses` : ''}${novos.length ? `, ${novos.length} cadastrados agora` : ''}).`,
  };
}

// Importação simples (uma planilha, um mês)
export async function importarRealizados(dados) {
  const { periodo_id, modo, novos, linhas = [] } = dados || {};
  if (!periodo_id) return { erro: 'Escolha o período.' };
  if (!linhas.length) return { erro: 'Nenhum colaborador marcado para importar.' };
  return importarLotes({ modo, novos, lotes: [{ periodo_id, pessoas: linhas, grupos: [] }] });
}
