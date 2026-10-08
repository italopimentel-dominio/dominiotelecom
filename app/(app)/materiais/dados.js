// Equipes ativas com o caminho completo (ex.: "Comercial / Televendas"), para escolher no material
export async function listarEquipes(supabase) {
  const { data } = await supabase.from('grupos').select('id, nome, parent_id, ativo').order('ordem').order('nome');
  const porId = new Map((data || []).map((g) => [g.id, g]));
  const caminho = (id) => { const l = []; let g = porId.get(id); while (g) { l.unshift(g.nome); g = porId.get(g.parent_id); } return l.join(' / '); };
  return (data || []).filter((g) => g.ativo).map((g) => ({ id: g.id, nome: caminho(g.id) })).sort((a, b) => a.nome.localeCompare(b.nome));
}
export const ORIGEM = { preparador: 'Preparador', planilha: 'Planilha', manual: 'Manual' };

// Produtos ativos, para escolher o foco do material
export async function listarProdutos(supabase) {
  const { data } = await supabase.from('produtos').select('id, nome, ativo, ordem').eq('ativo', true).order('ordem').order('nome');
  return (data || []).map((p) => ({ id: p.id, nome: p.nome }));
}
