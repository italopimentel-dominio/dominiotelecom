import { somarDias } from './datas';

// Status dos parceiros: a lista vem do banco (tabela parceiro_status, editável pelo gerente)
export const CORES_STATUS = {
  neutro: { texto: 'Cinza', classe: '' },
  ok: { texto: 'Verde', classe: 'tag-ok' },
  acento: { texto: 'Roxo', classe: 'tag-acento' },
  atencao: { texto: 'Laranja', classe: 'tag-atencao' },
  risco: { texto: 'Vermelho', classe: 'tag-risco' },
};
export const classeStatus = (st) => CORES_STATUS[st?.cor]?.classe ?? '';

// Ativação boa = o parceiro vendeu até 30 dias depois da data de ativação.
// As planilhas de vendas trazem só o mês da venda, então vale a venda até o mês em que o prazo termina.
export function situacaoAtivacao(p, hoje) {
  if (!p.data_ativacao) return null;
  const prazo = somarDias(p.data_ativacao, 30);
  if (p.venda_mes) return { estado: p.venda_mes <= prazo.slice(0, 7) ? 'boa' : 'fora', prazo };
  return { estado: hoje <= prazo ? 'prazo' : 'sem', prazo };
}
export const ROTULO_ATIVACAO = {
  boa: { texto: 'Ativação boa', classe: 'tag-ok' },
  prazo: { texto: 'No prazo', classe: 'tag-acento' },
  fora: { texto: 'Vendeu fora do prazo', classe: 'tag-atencao' },
  sem: { texto: 'Sem venda em 30 dias', classe: 'tag-risco' },
};

// Data de ativação travada para o ponto focal (o banco também garante)
export function ativacaoTravada(p, hoje) {
  if (!p?.id) return false;
  if (p.ativacao_travada_em) return true;
  return !!p.data_ativacao && somarDias(p.data_ativacao, 30) < hoje;
}
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
  venda_mes: 'Venda vinculada (mês)', venda_produto: 'Venda vinculada (produto)', venda_qtd: 'Venda vinculada (quantidade)', venda_valor: 'Venda vinculada (R$)',
};

// Regra da validação automática (igual à do banco): treinamento realizado com o formulário
// do mesmo tipo respondido + venda vinculada. Devolve o que falta (vazio = valida sozinho).
export function faltasValidacao(p, treinosDoParceiro, tiposComFormulario) {
  const faltas = [];
  const realizados = [...new Set(treinosDoParceiro.filter((t) => t.status === 'realizado').map((t) => t.tipo))];
  if (!realizados.length) faltas.push('treinamento realizado');
  realizados.filter((t) => !tiposComFormulario.has(t)).forEach((t) => faltas.push(`formulário de ${TIPOS_TREINAMENTO[t].toLowerCase()}`));
  if (!p.venda_mes) faltas.push('venda');
  return faltas;
}
