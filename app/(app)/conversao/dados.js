import { normalizar } from '@/lib/nomes';
import { somarDias } from '@/lib/datas';

// Junta materiais, vendas creditadas (função material_vendas), equipes, produtos e quem vendeu.
export async function carregarConversao(supabase, hoje, materialId = null) {
  let qm = supabase.from('materiais_resumo').select('*').order('enviado_em', { ascending: false });
  if (materialId) qm = qm.eq('id', materialId);
  const [mat, vend, { data: grupos }, { data: produtos }, { data: colabs }, { data: apelidos }, aeq] = await Promise.all([
    qm,
    supabase.rpc('material_vendas', { p_material: materialId }),
    supabase.from('grupos').select('id, nome, parent_id, ativo'),
    supabase.from('produtos').select('id, nome'),
    supabase.from('colaboradores').select('id, nome, grupo_id'),
    supabase.from('colaborador_apelidos').select('apelido, colaborador_id'),
    supabase.from('apelidos_equipe').select('apelido, grupo_id'),
  ]);
  if (mat.error) return { erro: 'Rode os arquivos 022 e 023 (materiais) no Supabase.' };
  if (vend.error) return { erro: 'Rode o arquivo 024_conversao_materiais.sql no Supabase.' };

  // equipes: caminho completo e "está dentro de"
  const porId = new Map((grupos || []).map((g) => [g.id, g]));
  const caminho = (id) => { const l = []; let g = porId.get(id); while (g) { l.unshift(g.nome); g = porId.get(g.parent_id); } return l.join(' / '); };
  const dentroDe = (id, pai) => { let g = porId.get(id); while (g) { if (g.id === pai) return true; g = porId.get(g.parent_id); } return false; };

  // quem vendeu -> equipe (pelo nome, apelido do colaborador ou nome ligado direto a uma equipe)
  const colabPorNome = new Map((colabs || []).map((c) => [normalizar(c.nome), c]));
  const colabPorId = new Map((colabs || []).map((c) => [c.id, c]));
  (apelidos || []).forEach((a) => { if (colabPorId.has(a.colaborador_id) && !colabPorNome.has(a.apelido)) colabPorNome.set(a.apelido, colabPorId.get(a.colaborador_id)); });
  const equipeDireta = new Map(((aeq && !aeq.error && aeq.data) || []).map((a) => [a.apelido, a.grupo_id]));
  const equipeDe = (nome) => { const k = normalizar(nome); return colabPorNome.get(k)?.grupo_id || equipeDireta.get(k) || null; };

  const nomeProduto = new Map((produtos || []).map((p) => [p.id, p.nome]));
  const vendasPor = new Map();
  (vend.data || []).forEach((v) => {
    const eq = equipeDe(v.consultor);
    const lista = vendasPor.get(v.material_id) || [];
    lista.push({ ...v, qtd: Number(v.qtd) || 0, valor: Number(v.valor) || 0, produto: nomeProduto.get(v.produto_id) || v.destino, equipeVendedor: eq, nomeEquipeVendedor: eq ? caminho(eq) : null });
    vendasPor.set(v.material_id, lista);
  });

  const materiais = (mat.data || []).map((m) => {
    const vendas = (vendasPor.get(m.id) || []).map((v) => ({ ...v, propria: !!v.equipeVendedor && !!m.grupo_id && dentroDe(v.equipeVendedor, m.grupo_id) }));
    const convertidos = new Set(vendas.map((v) => v.cnpj)).size;
    const leads = Number(m.leads) || 0;
    const prazo = somarDias(m.enviado_em, 30);
    const esperada = m.conversao_esperada == null ? null : Number(m.conversao_esperada);
    return {
      ...m, leads, vendas, convertidos,
      convertidosPropria: new Set(vendas.filter((v) => v.propria).map((v) => v.cnpj)).size,
      qtd: vendas.reduce((s, v) => s + v.qtd, 0),
      valor: vendas.reduce((s, v) => s + v.valor, 0),
      pct: leads ? (convertidos / leads) * 100 : null,
      esperada,
      esperadosLeads: esperada == null ? null : (leads * esperada) / 100,
      prazo, andamento: hoje <= prazo,
      nomeEquipe: m.grupo_id ? caminho(m.grupo_id) : '—',
      foco: m.produtos_foco?.length ? m.produtos_foco.map((id) => nomeProduto.get(id) || '?').join(', ') : 'Geral',
    };
  });
  return { materiais };
}

// Soma de vários materiais (por equipe ou total). % esperado = ponderado pelos leads dos materiais que têm expectativa.
export function somar(lista) {
  const leads = lista.reduce((s, m) => s + m.leads, 0);
  const convertidos = lista.reduce((s, m) => s + m.convertidos, 0);
  const comMeta = lista.filter((m) => m.esperada != null);
  const leadsMeta = comMeta.reduce((s, m) => s + m.leads, 0);
  return {
    materiais: lista.length, leads, convertidos,
    convertidosPropria: lista.reduce((s, m) => s + m.convertidosPropria, 0),
    qtd: lista.reduce((s, m) => s + m.qtd, 0),
    valor: lista.reduce((s, m) => s + m.valor, 0),
    pct: leads ? (convertidos / leads) * 100 : null,
    esperada: leadsMeta ? comMeta.reduce((s, m) => s + m.esperadosLeads, 0) / leadsMeta * 100 : null,
    andamento: lista.some((m) => m.andamento),
  };
}

export const fmtN = (n) => Number(n || 0).toLocaleString('pt-BR');
export const fmtPct = (n) => (n == null ? '—' : `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`);
export const fmtBRL = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export const fmtDoc = (d) => (d?.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : (d || '').replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4'));
