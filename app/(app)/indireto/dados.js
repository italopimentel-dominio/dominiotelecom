// Pessoas que podem ser ponto focal: quem edita o Controle Indireto ou é administrador.
export async function listarFocais(supabase) {
  const { data } = await supabase.from('profiles').select('id, nome, usuario, papel, perm_indireto, ativo').eq('ativo', true).order('nome');
  return (data || []).filter((p) => p.papel === 'admin' || p.perm_indireto === 'editar' || p.perm_indireto === 'validar');
}

export async function nomesDosPerfis(supabase) {
  const { data } = await supabase.from('profiles').select('id, nome, usuario');
  return new Map((data || []).map((p) => [p.id, p.nome || p.usuario]));
}

// Lista de status dos parceiros (editável pelo gerente), na ordem definida
export async function listarStatus(supabase) {
  const { data } = await supabase.from('parceiro_status').select('*').order('ordem').order('nome');
  return data || [];
}
