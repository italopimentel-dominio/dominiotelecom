// Campanhas automáticas – parte do servidor: chamada a cada leitura de fonte (botões e rodada automática).
// 1) guarda as linhas da planilha (todas as colunas) em pedidos_linhas, substituindo a foto anterior da fonte;
// 2) guarda os cabeçalhos e valores encontrados em fontes_campos (listas da tela de regras das campanhas).
import { lerLinhasBrutas } from '@/lib/fontes';

const MESES_GUARDADOS = 4; // mês atual + 3 anteriores (ou desde o início da campanha em andamento mais antiga)

export function inicioJanela(hoje = new Date()) {
  return new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - (MESES_GUARDADOS - 1), 1)).toISOString().slice(0, 10);
}

// alvoDe(nome, equipe) -> ['c', colaborador_id] | ['g', grupo_id] | 'ignorado' | null (sem vínculo)
export async function gravarLinhasCampanhas(db, { fonte_id, modelo, linhas, alvoDe }) {
  let desde = inicioJanela();
  // campanhas que ainda não terminaram: guarda desde o início da mais antiga (erro aqui não impede a gravação)
  const hoje = new Date().toISOString().slice(0, 10);
  const { data: abertas } = await db.from('campanhas').select('data_inicio').gte('data_fim', hoje);
  (abertas || []).forEach((c) => { if (c.data_inicio && c.data_inicio < desde) desde = c.data_inicio; });

  const lido = lerLinhasBrutas(linhas, modelo, { desde });
  if (lido.erro) return ` (campanhas: ${lido.erro})`;

  const cache = new Map();
  const regs = [];
  let semVinculo = 0;
  for (const r of lido.linhas) {
    if (!cache.has(r.consultor)) cache.set(r.consultor, alvoDe(r.consultor, r.equipe));
    const alvo = cache.get(r.consultor);
    if (alvo === 'ignorado') continue;
    if (!alvo) semVinculo++;
    regs.push({
      fonte_id, linha: r.linha, neo: r.neo || null, consultor: r.consultor,
      colaborador_id: alvo?.[0] === 'c' ? alvo[1] : null, grupo_id: alvo?.[0] === 'g' ? alvo[1] : null,
      data_entrada: r.data, destinos: r.destinos, dados: r.dados,
    });
  }

  // foto nova da fonte
  const { error: ed } = await db.from('pedidos_linhas').delete().eq('fonte_id', fonte_id);
  if (ed) return /pedidos_linhas/.test(ed.message) ? ' (campanhas: rode o 045_campanhas.sql)' : ` (campanhas: ${ed.message})`;
  for (let i = 0; i < regs.length; i += 500) {
    const { error } = await db.from('pedidos_linhas').insert(regs.slice(i, i + 500));
    if (error) return ` (campanhas: ${error.message})`;
  }

  // cabeçalhos e valores
  await db.from('fontes_campos').delete().eq('fonte_id', fonte_id);
  const campos = lido.campos.map((c) => ({ fonte_id, coluna: c.coluna, ordem: c.ordem, distintos: c.distintos, muitos: c.muitos, valores: c.valores }));
  if (campos.length) {
    const { error } = await db.from('fontes_campos').insert(campos);
    if (error) return ` (campanhas: ${error.message})`;
  }

  return ` (campanhas: ${regs.length} pedidos guardados desde ${desde.split('-').reverse().join('/')}${semVinculo ? `, ${semVinculo} de nomes sem vínculo` : ''}${lido.semData ? `, ${lido.semData} sem data de entrada` : ''})`;
}
