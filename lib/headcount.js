// Fotografia de headcount de um mês a partir das datas de admissão e desligamento.
// Sem data de admissão = considerado na casa desde antes do mês.
export function calcularHeadcount(colaboradores, inicio, fim) {
  const valido = (c) => c.ativo || c.data_desligamento; // inativado sem data (forma antiga) fica de fora
  const lista = colaboradores.filter(valido);
  const noInicio = lista.filter((c) => (!c.data_admissao || c.data_admissao < inicio) && (!c.data_desligamento || c.data_desligamento >= inicio));
  const admissoes = lista.filter((c) => c.data_admissao && c.data_admissao >= inicio && c.data_admissao <= fim);
  const desligamentos = lista.filter((c) => c.data_desligamento && c.data_desligamento >= inicio && c.data_desligamento <= fim);
  const final = noInicio.length + admissoes.length - desligamentos.length;
  return {
    inicio: noInicio.length,
    admissoes,
    desligamentos,
    final,
    pctPerdidos: noInicio.length ? desligamentos.length / noInicio.length : 0,
    variacao: noInicio.length ? (final - noInicio.length) / noInicio.length : 0,
  };
}
