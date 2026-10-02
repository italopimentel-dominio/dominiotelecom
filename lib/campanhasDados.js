import { nomeCurto, capitalizar } from './nomes';
import { calcularCampanha } from './campanhas';

export async function carregarCampanha(supabase, id) {
  const [{ data: campanha }, { data: itens }, { data: parts }, { data: colabs }, { data: grupos }] = await Promise.all([
    supabase.from('campanhas').select('*').eq('id', id).maybeSingle(),
    supabase.from('campanha_itens').select('*').eq('campanha_id', id).order('ordem').order('nome'),
    supabase.from('campanha_participantes').select('*').eq('campanha_id', id),
    supabase.from('colaboradores').select('id, nome, grupo_id, ativo'),
    supabase.from('grupos').select('id, nome, parent_id, ativo'),
  ]);
  if (!campanha) return null;
  const ids = (parts || []).map((p) => p.id);
  const { data: resultados } = ids.length
    ? await supabase.from('campanha_resultados').select('*').in('participante_id', ids)
    : { data: [] };
  const colab = new Map((colabs || []).map((c) => [c.id, c]));
  const grupo = new Map((grupos || []).map((g) => [g.id, g]));
  const participantes = (parts || []).map((p) => {
    if (p.colaborador_id) {
      const c = colab.get(p.colaborador_id);
      return { ...p, nome: c ? nomeCurto(c.nome) : '—', nomeCompleto: c ? capitalizar(c.nome) : '—', equipe: c ? capitalizar(grupo.get(c.grupo_id)?.nome || '') : '' };
    }
    const g = grupo.get(p.grupo_id);
    return { ...p, nome: g ? capitalizar(g.nome) : '—', nomeCompleto: g ? g.nome : '—', equipe: g?.parent_id ? capitalizar(grupo.get(g.parent_id)?.nome || '') : '' };
  });
  const calc = calcularCampanha(campanha, itens || [], participantes, resultados || []);
  return { campanha, itens: itens || [], participantes, resultados: resultados || [], calc, colabs: colabs || [], grupos: grupos || [] };
}
