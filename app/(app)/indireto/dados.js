// Pessoas que podem ser ponto focal: quem edita o Controle Indireto ou é administrador.
export async function listarFocais(supabase) {
  const { data } = await supabase.from('profiles').select('id, nome, usuario, papel, perm_indireto, ativo').eq('ativo', true).order('nome');
  return (data || []).filter((p) => p.papel === 'admin' || p.perm_indireto === 'editar');
}

export async function nomesDosPerfis(supabase) {
  const { data } = await supabase.from('profiles').select('id, nome, usuario');
  return new Map((data || []).map((p) => [p.id, p.nome || p.usuario]));
}
