// Lê TODAS as linhas de uma consulta do Supabase.
// A API do Supabase devolve no máximo 1.000 linhas por consulta (mesmo com .limit maior) e não avisa que cortou.
// montar: função que devolve uma consulta NOVA a cada chamada, já com select, filtros e uma ordem estável
//   (ex.: pela chave primária), senão a paginação pode pular ou repetir linhas.
// Devolve { data, error }, como o próprio Supabase.
export async function buscarTodas(montar, tamanho = 1000) {
  const todas = [];
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await montar().range(de, de + tamanho - 1);
    if (error) return { data: null, error };
    todas.push(...(data || []));
    if (!data || data.length < tamanho) break;
  }
  return { data: todas, error: null };
}
