'use server';
import { revalidatePath } from 'next/cache';
import { sessao, podeEditar } from '@/lib/auth';

const SEM_PERMISSAO = { erro: 'Seu usuário só tem permissão para visualizar.' };
const erroTabela = (m) => (/preinput_/.test(m) ? 'Rode o arquivo 043_pre_input.sql no Supabase.' : m);
const dataOk = (d) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(String(d));

async function editor() {
  const s = await sessao();
  return s?.perfil && podeEditar(s.perfil) ? s : null;
}

// Movimentações ("Movimentado para …"): soma ao que já existe; a mesma linha subida de novo não duplica.
export async function importarMovimentosPreInput(linhas) {
  const s = await editor();
  if (!s) return SEM_PERMISSAO;
  if (!Array.isArray(linhas) || linhas.length > 3000) return { erro: 'Envie no máximo 3.000 linhas por vez.' };
  const regs = [...new Map(linhas
    .filter((l) => l?.neo && dataOk(l.data_hora) && String(l.fila || '').trim())
    .map((l) => { const r = { neo: String(l.neo).trim(), data_hora: l.data_hora, fila: String(l.fila).trim(), usuario: l.usuario ? String(l.usuario).trim() : null }; return [`${r.neo}|${r.data_hora}|${r.fila}`, r]; })).values()];
  if (!regs.length) return { gravados: 0 };
  const { error } = await s.supabase.from('preinput_movimentos').upsert(regs, { onConflict: 'neo,data_hora,fila', ignoreDuplicates: true });
  if (error) return { erro: erroTabela(error.message) };
  return { gravados: regs.length };
}

// Produtos dos pedidos: para cada NEO do arquivo, troca os produtos pelos do arquivo (o arquivo mais novo vale).
export async function importarItensPreInput(linhas) {
  const s = await editor();
  if (!s) return SEM_PERMISSAO;
  if (!Array.isArray(linhas) || linhas.length > 3000) return { erro: 'Envie no máximo 3.000 linhas por vez.' };
  const regs = [...new Map(linhas
    .filter((l) => l?.neo && String(l.grupo || '').trim())
    .map((l) => { const r = { neo: String(l.neo).trim(), item: String(l.item ?? '').trim(), grupo: String(l.grupo).trim(), produto: String(l.produto ?? '').trim(), qtd: Number(l.qtd) || 1 }; return [`${r.neo}|${r.item}|${r.grupo}|${r.produto}`, r]; })).values()];
  if (!regs.length) return { gravados: 0 };
  const neos = [...new Set(regs.map((r) => r.neo))];
  const db = s.supabase;
  for (let i = 0; i < neos.length; i += 300) {
    const { error } = await db.from('preinput_itens').delete().in('neo', neos.slice(i, i + 300));
    if (error) return { erro: erroTabela(error.message) };
  }
  for (let i = 0; i < regs.length; i += 1000) {
    const { error } = await db.from('preinput_itens').insert(regs.slice(i, i + 1000));
    if (error) return { erro: erroTabela(error.message) };
  }
  return { gravados: regs.length, pedidos: neos.length };
}

export async function concluirImportacaoPreInput() {
  revalidatePath('/pre-input');
  return { ok: true };
}

// Parâmetros: expediente, SLA padrão, SLA por grupo de produto e filas (entrada/destino e grupo)
export async function salvarParametrosPreInput({ config, sla = [], filas = [] }) {
  const s = await editor();
  if (!s) return SEM_PERMISSAO;
  const hora = (h) => /^\d{2}:\d{2}$/.test(String(h || '').slice(0, 5));
  if (!hora(config?.inicio) || !hora(config?.fim) || String(config.inicio) >= String(config.fim)) return { erro: 'Confira o horário do expediente.' };
  if (!(Number(config?.sla_padrao) > 0)) return { erro: 'O SLA padrão precisa ser maior que zero.' };
  const slaOk = sla.filter((x) => String(x.grupo || '').trim()).map((x) => ({ grupo: String(x.grupo).trim(), horas: Number(x.horas) }));
  if (slaOk.some((x) => !(x.horas > 0))) return { erro: 'Todo SLA precisa ser maior que zero.' };
  const filasOk = filas.filter((x) => String(x.fila || '').trim()).map((x) => ({ fila: String(x.fila).trim(), tipo: x.tipo === 'entrada' ? 'entrada' : 'destino', grupo: String(x.grupo || '').trim() || null }));
  const db = s.supabase;
  const r1 = await db.from('preinput_config').upsert({ id: 1, inicio: String(config.inicio).slice(0, 5), fim: String(config.fim).slice(0, 5), sla_padrao: Number(config.sla_padrao) });
  if (r1.error) return { erro: erroTabela(r1.error.message) };
  // substitui as listas inteiras pelo que está na tela
  const [antSla, antFilas] = await Promise.all([db.from('preinput_sla').select('grupo'), db.from('preinput_filas').select('fila')]);
  const tirarSla = (antSla.data || []).map((x) => x.grupo).filter((g) => !slaOk.some((y) => y.grupo === g));
  const tirarFilas = (antFilas.data || []).map((x) => x.fila).filter((f) => !filasOk.some((y) => y.fila === f));
  if (tirarSla.length) await db.from('preinput_sla').delete().in('grupo', tirarSla);
  if (tirarFilas.length) await db.from('preinput_filas').delete().in('fila', tirarFilas);
  if (slaOk.length) { const { error } = await db.from('preinput_sla').upsert(slaOk); if (error) return { erro: error.message }; }
  if (filasOk.length) { const { error } = await db.from('preinput_filas').upsert(filasOk); if (error) return { erro: error.message }; }
  revalidatePath('/pre-input');
  return { ok: 'Parâmetros salvos. Os números já foram recalculados.' };
}
