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

export function cpfValido(c) {
  const d = soDigitos(c);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const dv = (base, peso) => {
    const soma = base.split('').reduce((s, n, i) => s + Number(n) * (peso - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(d.slice(0, 9), 10);
  const d2 = dv(d.slice(0, 9) + d1, 11);
  return d.endsWith(`${d1}${d2}`);
}

export function fmtCpf(c) {
  const d = soDigitos(c);
  if (d.length !== 11) return c || '';
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// Documento do parceiro (CNPJ ou CPF), já formatado
export const documentoDe = (p) => (p.cnpj ? fmtCnpj(p.cnpj) : p.cpf ? fmtCpf(p.cpf) : '');

// Procura CPF/CNPJ válido e e-mail entre as respostas de um formulário
export function extrairIdentificacao(respostas) {
  let documento = null, email = null, nome = null;
  for (const [pergunta, valor] of Object.entries(respostas || {})) {
    const v = String(valor ?? '');
    const d = soDigitos(v);
    if (!documento && ((d.length === 14 && cnpjValido(d)) || (d.length === 11 && cpfValido(d)))) documento = d;
    const m = v.match(/[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+/);
    if (!email && m) email = m[0].toLowerCase();
    const p = pergunta.toLowerCase();
    if (!nome && /nome|raz[aã]o|parceiro|loja|empresa/.test(p) && !/e-?mail/.test(p) && v.trim() && d.length < 8) nome = v.trim();
  }
  return { documento, email, nome };
}

export const CAMPOS_HISTORICO = {
  nome_fantasia: 'Nome fantasia', razao_social: 'Razão social', cnpj: 'CNPJ', cpf: 'CPF', codigo: 'Código/PDV',
  status: 'Status', cidade: 'Cidade', uf: 'UF', endereco: 'Endereço', contato_nome: 'Contato',
  contato_telefone: 'Telefone', contato_email: 'E-mail', ponto_focal_id: 'Ponto focal', data_inicio: 'Início da parceria',
  data_ativacao: 'Data de ativação', observacoes: 'Observações', validacao: 'Validação',
  validacao_motivo: 'Motivo da validação', form_respondido_em: 'Formulário respondido em',
};
