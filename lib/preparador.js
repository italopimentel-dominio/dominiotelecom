// Regras do Preparador de material (base de clientes): campos conhecidos, formatação e filtros.
import { normalizar } from './nomes';

export const chaveCol = (s) => normalizar(String(s ?? '')).replace(/\s+/g, ' ');
export const vazio = (v) => v === null || v === undefined || String(v).trim() === '';
export function num(v) {
  if (typeof v === 'number') return v;
  if (vazio(v)) return null;
  let s = String(v).trim().replace(/[R$\s]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return isFinite(n) ? n : null;
}

// Filtros prontos para as colunas que a equipe usa
export const CAMPOS_FILTRO = [
  { col: 'SITUACAO_RECEITA', rotulo: 'Situação na Receita', tipo: 'lista', padrao: (vals) => vals.filter((v) => /ATIVA/i.test(v)) },
  { col: 'TP_PRODUTO', rotulo: 'Produtos com a Vivo', tipo: 'lista' },
  { col: 'M MÓVEL', rotulo: 'Meses de contrato móvel', tipo: 'numero' },
  { col: 'M FIXA', rotulo: 'Meses de contrato fixa', tipo: 'numero' },
  { col: 'APTO A RENOVAÇÃO MÓVEL', rotulo: 'Apto a renovação móvel', tipo: 'presenca', sim: 'Apto', nao: 'Não apto' },
  { col: 'PEDIDO EM ANDAMENTO', rotulo: 'Pedido em andamento (móvel)', tipo: 'presenca', sim: 'Tem pedido', nao: 'Sem pedido' },
  { col: 'PEDIDO EM ANDAMENTO FIXA', rotulo: 'Pedido em andamento (fixa)', tipo: 'presenca', sim: 'Tem pedido', nao: 'Sem pedido' },
  { col: 'QT_MOVEL_TERM', rotulo: 'Linhas móveis', tipo: 'numero' },
  { col: 'CONSULTOR VENDA', rotulo: 'Consultor da última venda', tipo: 'lista' },
  { col: 'Porte Empresa', rotulo: 'Porte da empresa', tipo: 'lista' },
  { col: 'QT_BASICA_BL', rotulo: 'Produtos fibra (banda larga)', tipo: 'numero' },
  { col: 'VELOCIDADE FIXA', rotulo: 'Velocidade da fibra', tipo: 'lista' },
  { col: 'VL_CAR_MOVEL', rotulo: 'Débito na móvel', tipo: 'debito' },
  { col: 'VL_CAR_FIXA', rotulo: 'Débito na fixa', tipo: 'debito' },
  { col: 'BL_B2C', rotulo: 'Fibra na pessoa física (B2C)', tipo: 'lista' },
  { col: 'DS_DISPONIBILIDADE', rotulo: 'Disponibilidade de fibra no endereço', tipo: 'lista' },
  { col: 'VVN', rotulo: 'Possibilidade de VVN', tipo: 'presenca', sim: 'Pode VVN', nao: 'Não' },
  { col: 'APARELHOS', rotulo: 'Crédito de aparelho', tipo: 'presenca', sim: 'Tem crédito', nao: 'Sem crédito' },
];

// Colunas de identificação que saem no material
export const SAIDA_PADRAO = [
  'NR_CNPJ', 'NM_CLIENTE', 'Capital Social da Empresa', 'Faturamento', 'Funcionários', 'NM_CONTATO_SFA', '__ENDERECO',
  'EMAIL_CONTATO_PRINCIPAL_SFA', 'CELULAR_CONTATO_PRINCIPAL_SFA', 'TLFN_1', 'TLFN_2', 'TLFN_3', 'TLFN_4', 'TLFN_5',
  'TEL_COMERCIAL_SIEBEL', 'TEL_CELULAR_SIEBEL', 'TEL_RESIDENCIAL_SIEBEL',
];
export const COLS_TELEFONE = ['CELULAR_CONTATO_PRINCIPAL_SFA', 'TLFN_1', 'TLFN_2', 'TLFN_3', 'TLFN_4', 'TLFN_5', 'TEL_COMERCIAL_SIEBEL', 'TEL_CELULAR_SIEBEL', 'TEL_RESIDENCIAL_SIEBEL'];
export const ROTULOS = {
  NR_CNPJ: 'CNPJ', NM_CLIENTE: 'Cliente', 'Capital Social da Empresa': 'Capital social', NM_CONTATO_SFA: 'Contato', __ENDERECO: 'Endereço',
  EMAIL_CONTATO_PRINCIPAL_SFA: 'E-mail', CELULAR_CONTATO_PRINCIPAL_SFA: 'Celular do contato', __TELEFONES: 'Telefones',
  TEL_COMERCIAL_SIEBEL: 'Tel. comercial Siebel', TEL_CELULAR_SIEBEL: 'Celular Siebel', TEL_RESIDENCIAL_SIEBEL: 'Tel. residencial Siebel',
};

export function fmtTelefone(v) {
  if (vazio(v)) return '';
  let d = String(typeof v === 'number' ? Math.round(v) : v).replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

export function fmtDocumento(v, tipo) {
  if (vazio(v)) return '';
  let d = String(typeof v === 'number' ? Math.round(v) : v).replace(/\D/g, '');
  if (/cpf/i.test(tipo || '') || d.length === 11) {
    d = d.padStart(11, '0');
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  d = d.padStart(14, '0');
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

// Decide o tipo de filtro de uma coluna qualquer olhando os valores
export function tipoAutomatico(valores) {
  const cheios = valores.filter((v) => !vazio(v));
  if (!cheios.length) return 'presenca';
  const numeros = cheios.filter((v) => num(v) !== null).length;
  if (numeros / cheios.length > 0.9) return 'numero';
  const distintos = new Set(cheios.map((v) => String(v).trim())).size;
  return distintos <= 80 ? 'lista' : 'texto';
}

export function passaFiltro(v, f) {
  const nada = vazio(v);
  switch (f.tipo) {
    case 'lista':
      return !f.valores?.length || f.valores.includes(nada ? '(vazio)' : String(v).trim());
    case 'numero': {
      if (!f.modo || f.modo === 'qualquer') return true;
      if (f.modo === 'vazio') return nada;
      if (f.modo === 'preenchido') return !nada;
      const n = num(v);
      if (n === null) return false;
      if (f.min !== '' && f.min !== undefined && n < Number(String(f.min).replace(',', '.'))) return false;
      if (f.max !== '' && f.max !== undefined && n > Number(String(f.max).replace(',', '.'))) return false;
      return true;
    }
    case 'presenca':
      return !f.modo || f.modo === 'qualquer' ? true : f.modo === 'sim' ? !nada : nada;
    case 'debito': {
      const n = num(v) || 0;
      return !f.modo || f.modo === 'qualquer' ? true : f.modo === 'com' ? n > 0 : n <= 0;
    }
    case 'texto':
      return !f.texto ? true : normalizar(String(v ?? '')).includes(normalizar(f.texto));
    default:
      return true;
  }
}

export function filtroAtivo(f) {
  if (!f) return false;
  if (f.tipo === 'lista') return !!f.valores?.length;
  if (f.tipo === 'texto') return !!f.texto;
  return !!f.modo && f.modo !== 'qualquer';
}
