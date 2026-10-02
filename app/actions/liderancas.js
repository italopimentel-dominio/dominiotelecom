'use server';
import { revalidatePath } from 'next/cache';
import { sessao, podeEditar } from '@/lib/auth';

const SEM_PERMISSAO = { erro: 'Seu usuário só tem permissão para visualizar.' };
const txt = (fd, k) => String(fd.get(k) ?? '').trim();
const ou = (v) => (v === '' ? null : v);

async function editor() {
  const s = await sessao();
  return podeEditar(s.perfil) ? s.supabase : null;
}

export async function salvarLideranca(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const id = txt(fd, 'id');
  const dados = {
    nome: txt(fd, 'nome'),
    cargo: txt(fd, 'cargo'),
    superior_id: ou(txt(fd, 'superior_id')),
    data_admissao: ou(txt(fd, 'data_admissao')),
    ordem: Number(txt(fd, 'ordem')) || 0,
  };
  if (!dados.nome) return { erro: 'Informe o nome.' };
  if (!dados.cargo) return { erro: 'Informe o cargo.' };
  const grupos = [...new Set(fd.getAll('grupos').map(String).filter(Boolean))];

  if (id && dados.superior_id) {
    // impede ciclo: ninguém pode reportar a si mesmo nem a alguém abaixo dele
    if (dados.superior_id === id) return { erro: 'A pessoa não pode ser superior dela mesma.' };
    const { data: todos } = await db.from('liderancas').select('id, superior_id');
    const abaixo = new Set([id]);
    let mudou = true;
    while (mudou) {
      mudou = false;
      (todos || []).forEach((l) => { if (l.superior_id && abaixo.has(l.superior_id) && !abaixo.has(l.id)) { abaixo.add(l.id); mudou = true; } });
    }
    if (abaixo.has(dados.superior_id)) return { erro: 'Esse superior está abaixo desta pessoa no organograma.' };
  }

  let lid = id;
  if (id) {
    const { error } = await db.from('liderancas').update(dados).eq('id', id);
    if (error) return { erro: error.message };
    await db.from('lideranca_grupos').delete().eq('lideranca_id', id);
  } else {
    const { data, error } = await db.from('liderancas').insert(dados).select('id').single();
    if (error) return { erro: error.message };
    lid = data.id;
  }
  if (grupos.length) {
    const { error } = await db.from('lideranca_grupos').insert(grupos.map((grupo_id) => ({ lideranca_id: lid, grupo_id })));
    if (error) return { erro: error.message };
  }
  revalidatePath('/organograma', 'layout');
  return { ok: id ? 'Salvo.' : `${dados.nome} incluído no organograma.` };
}

export async function alternarLideranca(_prev, fd) {
  const db = await editor();
  if (!db) return SEM_PERMISSAO;
  const { error } = await db.from('liderancas').update({ ativo: fd.get('ativar') === '1' }).eq('id', txt(fd, 'id'));
  if (error) return { erro: error.message };
  revalidatePath('/organograma', 'layout');
  return { ok: true };
}
