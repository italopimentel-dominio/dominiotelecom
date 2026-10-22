// Painel – Projeção
//   executado  = o mesmo realizado do Painel – Executado (mês de conclusão)
//   em aberto  = tramitando da safra do mês + backlog (tramitando de safras anteriores)
//   aprovação  = executados ÷ (executados + pendentes/cancelados) da safra do mês (só quem já teve desfecho)
//   ritmo      = pedidos que entraram no mês ÷ dias úteis que já passaram
//   projeção   = executado + aprovação × (em aberto + ritmo × dias úteis que faltam)
//   precisa/dia = ((meta − executado) ÷ aprovação − em aberto) ÷ dias que faltam
// Sem nenhum pedido resolvido na safra do mês, usa a aprovação dos últimos 3 meses.
export function projetar({ executado = 0, tramMes = 0, backlog = 0, safra = {}, safras3 = {} }, { decorridos = 0, restantes = 0, encerrado = false }, meta = null) {
  const s = { exec: 0, tram: 0, canc: 0, ...safra };
  const s3 = { exec: 0, canc: 0, ...safras3 };
  const aberto = encerrado ? 0 : tramMes + backlog;
  const aprovMes = s.exec + s.canc > 0 ? s.exec / (s.exec + s.canc) : null;
  const aprov3 = s3.exec + s3.canc > 0 ? s3.exec / (s3.exec + s3.canc) : null;
  const aprov = aprovMes ?? aprov3;
  const entradas = s.exec + s.tram + s.canc;
  const ritmo = decorridos > 0 ? entradas / decorridos : null;
  const novos = !encerrado && ritmo != null ? ritmo * restantes : 0;
  const conta = (a) => (encerrado ? executado : a == null ? null : executado + a * (aberto + novos));
  const projecao = conta(aprov);
  const projecao3 = aprovMes != null ? conta(aprov3) : null;
  let precisa = null;
  if (!encerrado && meta > 0 && aprov > 0 && restantes > 0) precisa = Math.max(((meta - executado) / aprov - aberto) / restantes, 0);
  const pctMeta = meta > 0 && projecao != null ? projecao / meta : null;
  const status = pctMeta == null ? 'sem-meta' : pctMeta >= 1 ? 'em-dia' : pctMeta >= 0.9 ? 'atencao' : 'risco';
  return { executado, tramMes: encerrado ? 0 : tramMes, backlog: encerrado ? 0 : backlog, aberto, safra: s, entradas, aprov, aprovMes, aprov3,
    usouTres: aprovMes == null && aprov3 != null, ritmo, novos, projecao, projecao3, precisa, pctMeta, status, meta, restantes, decorridos, encerrado };
}
