export const STATUS_PARCEIRO = {
  prospeccao: 'Prospecção',
  onboarding: 'Em onboarding',
  ativo: 'Ativo',
  inativo: 'Inativo',
};
export const TIPOS_TREINAMENTO = {
  onboarding: 'Onboarding',
  telecom: 'Telecom',
  servicos: 'Serviços',
};
export const STATUS_TREINAMENTO = {
  agendado: 'Agendado',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
};

export const VALIDACAO = {
  pendente: { texto: 'Aguardando validação', classe: 'tag-atencao' },
  aprovado: { texto: 'Validado', classe: 'tag-ok' },
  reprovado: { texto: 'Reprovado', classe: 'tag-risco' },
};

export const soDigitos = (s) => String(s ?? '').replace(/\D/g, '');

export function cnpjValido(c) {
  const d = soDigitos(c);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (base) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.split('').reduce((s, n, i) => s + Number(n) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(d.slice(0, 12));
  const d2 = calc(d.slice(0, 12) + d1);
  return d.endsWith(`${d1}${d2}`);
}

export function fmtCnpj(c) {
  const d = soDigitos(c);
  if (d.length !== 14) return c || '';
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

// Situação de um tipo de treinamento para o parceiro:
// realizado > agendado (data futura) > atrasado (agendado com data já passada) > pendente
export function situacaoTreinamento(lista, tipo, hoje) {
  const doTipo = lista.filter((t) => t.tipo === tipo);
  const realizados = doTipo.filter((t) => t.status === 'realizado').sort((a, b) => b.data.localeCompare(a.data));
  if (realizados.length) return { estado: 'realizado', data: realizados[0].data };
  const agendados = doTipo.filter((t) => t.status === 'agendado').sort((a, b) => a.data.localeCompare(b.data));
  const proximo = agendados.find((t) => t.data >= hoje);
  if (proximo) return { estado: 'agendado', data: proximo.data };
  if (agendados.length) return { estado: 'atrasado', data: agendados[agendados.length - 1].data };
  return { estado: 'pendente', data: null };
}

export const ROTULO_SITUACAO = {
  realizado: { texto: 'Realizado', classe: 'tag-ok' },
  agendado: { texto: 'Agendado', classe: 'tag-acento' },
  atrasado: { texto: 'Sem registro', classe: 'tag-atencao' },
  pendente: { texto: 'Pendente', classe: 'tag-risco' },
};
