// Painel – Projeção: conta a partir dos pedidos do mês por situação.
//   a (aprovação)      = executado ÷ (executado + pendente/cancelado)   — só quem já teve desfecho
//   r (ritmo)          = pedidos ÷ dias úteis que já passaram
//   novos              = r × dias úteis que faltam (com hoje)
//   projeção           = executado + a × (tramitando + novos)
//   precisa por dia    = ((meta − executado) ÷ a − tramitando) ÷ dias que faltam   (pedidos por dia, mantendo a aprovação)
export function projetar({ exec = 0, tram = 0, canc = 0 }, { decorridos = 0, restantes = 0 }, meta = null, aprov3 = null) {
  const pedidos = exec + tram + canc;
  const resolvidos = exec + canc;
  const aprov = resolvidos > 0 ? exec / resolvidos : null;
  const ritmo = decorridos > 0 ? pedidos / decorridos : null;
  const novos = ritmo != null ? ritmo * restantes : 0;
  const conta = (a) => (a == null ? null : exec + a * (tram + novos));
  const projecao = conta(aprov);
  const projecao3 = conta(aprov3);
  let precisa = null;
  if (meta > 0 && aprov > 0 && restantes > 0) precisa = Math.max(((meta - exec) / aprov - tram) / restantes, 0);
  const pctMeta = meta > 0 && projecao != null ? projecao / meta : null;
  const status = pctMeta == null ? 'sem-meta' : pctMeta >= 1 ? 'em-dia' : pctMeta >= 0.9 ? 'atencao' : 'risco';
  return { exec, tram, canc, pedidos, resolvidos, aprov, aprov3, ritmo, novos, projecao, projecao3, precisa, pctMeta, status, meta, restantes, decorridos };
}
