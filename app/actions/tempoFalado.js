'use server';
import { revalidatePath } from 'next/cache';
import { sessao, podeEditar } from '@/lib/auth';
import { normalizar } from '@/lib/nomes';

// Grava o mês (substitui o que havia) e guarda os vínculos de nome escolhidos agora como apelidos.
export async function salvarTempoFalado(mes, linhas, apelidos = []) {
  const s = await sessao();
  if (!podeEditar(s.perfil)) return { erro: 'Seu usuário só tem permissão para visualizar.' };
  if (!/^\d{4}-\d{2}$/.test(String(mes))) return { erro: 'Mês inválido.' };
  if (!Array.isArray(linhas) || !linhas.length) return { erro: 'Nada para gravar.' };
  const db = s.supabase;
  if (apelidos.length) {
    const regs = [...new Map(apelidos.filter((a) => a.colaborador_id && a.apelido).map((a) => [normalizar(a.apelido), { apelido: normalizar(a.apelido), colaborador_id: a.colaborador_id }])).values()];
    if (regs.length) await db.from('colaborador_apelidos').upsert(regs);
  }
  const { error: ed } = await db.from('tempo_falado').delete().eq('mes', mes);
  if (ed) return { erro: ed.message.includes('tempo_falado') ? 'Rode o arquivo 028_tempo_falado.sql no Supabase.' : ed.message };
  const int = (v) => Math.round(Number(v) || 0);
  const regs = linhas.map((l) => ({
    mes, chave: String(l.chave), colaborador_id: l.colaborador_id || null, nome: String(l.nome || ''), empresa: l.empresa || null,
    lb_seg: int(l.lb), lb_tma: int(l.lbTma), c3_seg: int(l.c3), c3_speaking: int(l.speaking), c3_mtpa: int(l.mtpa), c3_manual: int(l.manual),
    ligacoes: int(l.ligacoes), falando: int(l.falando), tma: int(l.tma), dias: int(l.dias), media: int(l.media),
    alertas: l.alertas || [], nomes_origem: l.nomesOrigem || [],
  }));
  for (let i = 0; i < regs.length; i += 500) {
    const { error } = await db.from('tempo_falado').insert(regs.slice(i, i + 500));
    if (error) return { erro: error.message };
  }
  revalidatePath('/tempo-falado');
  return { ok: `Gravado: ${regs.length} pessoas em ${mes.slice(5)}/${mes.slice(0, 4)}.` };
}
