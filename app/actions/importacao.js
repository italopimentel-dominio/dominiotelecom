'use server';
import { revalidatePath } from 'next/cache';
import { sessao, podeEditar } from '@/lib/auth';
import { normalizar } from '@/lib/nomes';

// Recebe o resultado já conferido na tela de importação e grava tudo.
// dados = {
//   periodo_id, modo: 'substituir' | 'somar',
//   novos: [{ chave, nome, grupo_id }],
//   linhas: [{ colaborador_id?, chave?, apelido?, valores: { [produto_id]: numero } }]
// }
export async function importarRealizados(dados) {
  const s = await sessao();
  if (!podeEditar(s.perfil)) return { erro: 'Seu usuário só tem permissão para visualizar.' };
  const db = s.supabase;
  const { periodo_id, modo, novos = [], linhas = [] } = dados || {};
  if (!periodo_id) return { erro: 'Escolha o período.' };
  if (!linhas.length) return { erro: 'Nenhum colaborador marcado para importar.' };
  if (novos.some((n) => !n.grupo_id || !n.nome?.trim())) return { erro: 'Escolha a equipe de todos os colaboradores novos.' };

  // 1) cadastra os novos
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

  // 2) junta os valores por colaborador e produto
  const valores = new Map();
  const apelidos = new Map();
  for (const l of linhas) {
    const cid = l.colaborador_id || idDaChave.get(l.chave);
    if (!cid) continue;
    if (l.apelido) apelidos.set(normalizar(l.apelido), cid);
    for (const [item, v] of Object.entries(l.valores || {})) {
      if (v === null || v === undefined || !isFinite(v)) continue;
      const [pid, medida = 'qtd'] = item.split('|');
      const k = `${cid}|${pid}|${medida === 'brl' ? 'brl' : 'qtd'}`;
      valores.set(k, (valores.get(k) || 0) + Number(v));
    }
  }
  if (!valores.size) return { erro: 'Nenhum valor numérico encontrado nas colunas escolhidas.' };

  // 3) no modo "somar", soma ao que já estava lançado
  if (modo === 'somar') {
    const ids = [...new Set([...valores.keys()].map((k) => k.split('|')[0]))];
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await db.from('realizados').select('colaborador_id, produto_id, valor, medida')
        .eq('periodo_id', periodo_id).in('colaborador_id', ids.slice(i, i + 200));
      if (error) return { erro: error.message };
      (data || []).forEach((r) => {
        const k = `${r.colaborador_id}|${r.produto_id}|${r.medida || 'qtd'}`;
        if (valores.has(k)) valores.set(k, valores.get(k) + Number(r.valor));
      });
    }
  }

  // 4) grava
  const registros = [...valores.entries()].map(([k, valor]) => {
    const [colaborador_id, produto_id, medida] = k.split('|');
    return { periodo_id, colaborador_id, produto_id, medida, valor: Math.round(valor * 100) / 100 };
  });
  for (let i = 0; i < registros.length; i += 500) {
    const { error } = await db.from('realizados').upsert(registros.slice(i, i + 500));
    if (error) return { erro: `Erro ao gravar os resultados: ${error.message}` };
  }

  // 5) lembra os nomes diferentes do cadastro para a próxima importação
  if (apelidos.size) {
    await db.from('colaborador_apelidos').upsert(
      [...apelidos.entries()].map(([apelido, colaborador_id]) => ({ apelido, colaborador_id }))
    );
  }

  revalidatePath('/', 'layout');
  const qtdColabs = new Set(registros.map((r) => r.colaborador_id)).size;
  return {
    ok: `${registros.length} resultados importados para ${qtdColabs} colaboradores${novos.length ? `, ${novos.length} cadastrados agora` : ''}.`,
  };
}
