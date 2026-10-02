'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sessao, podeEditarIndireto, podeValidarIndireto, ehAdmin } from '@/lib/auth';
import { soDigitos, cnpjValido, cpfValido, STATUS_PARCEIRO, TIPOS_TREINAMENTO, STATUS_TREINAMENTO } from '@/lib/indireto';
import { hojeSP } from '@/lib/datas';

const SEM_PERMISSAO = { erro: 'Seu usuário não tem permissão para editar o Controle Indireto.' };
const txt = (fd, k) => String(fd.get(k) ?? '').trim();
const ou = (v) => (v === '' ? null : v);

async function editor() {
  const s = await sessao();
  return podeEditarIndireto(s.perfil) ? s : null;
}

export async function salvarParceiro(_prev, fd) {
  const s = await editor();
  if (!s) return SEM_PERMISSAO;
  const id = txt(fd, 'id');
  const doc = soDigitos(txt(fd, 'documento'));
  const dados = {
    nome_fantasia: txt(fd, 'nome_fantasia'),
    razao_social: ou(txt(fd, 'razao_social')),
    cnpj: doc.length === 14 ? doc : null,
    cpf: doc.length === 11 ? doc : null,
    codigo: ou(txt(fd, 'codigo')),
    status: txt(fd, 'status') || 'onboarding',
    cidade: ou(txt(fd, 'cidade')),
    uf: ou(txt(fd, 'uf').toUpperCase().slice(0, 2)),
    endereco: ou(txt(fd, 'endereco')),
    contato_nome: ou(txt(fd, 'contato_nome')),
    contato_telefone: ou(txt(fd, 'contato_telefone')),
    contato_email: ou(txt(fd, 'contato_email').toLowerCase()),
    ponto_focal_id: ou(txt(fd, 'ponto_focal_id')),
    data_inicio: ou(txt(fd, 'data_inicio')),
    data_ativacao: ou(txt(fd, 'data_ativacao')),
    observacoes: ou(txt(fd, 'observacoes')),
  };
  if (!dados.nome_fantasia) return { erro: 'Informe o nome do parceiro.' };
  if (doc && doc.length !== 11 && doc.length !== 14) return { erro: 'Documento deve ser CPF (11 números) ou CNPJ (14 números).' };
  if (doc.length === 14 && !cnpjValido(doc)) return { erro: 'CNPJ inválido. Confira os números.' };
  if (doc.length === 11 && !cpfValido(doc)) return { erro: 'CPF inválido. Confira os números.' };
  if (dados.status === 'ativo' && !dados.data_ativacao) dados.data_ativacao = hojeSP();
  if (!STATUS_PARCEIRO[dados.status]) return { erro: 'Status inválido.' };
  if (dados.contato_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.contato_email)) return { erro: 'E-mail do contato inválido.' };

  const db = s.supabase;
  if (id) {
    const { data: antes } = await db.from('parceiros').select('validacao').eq('id', id).maybeSingle();
    const { error } = await db.from('parceiros').update(dados).eq('id', id);
    if (error) return { erro: /parceiros_(cnpj|cpf)_unico/.test(error.message) ? 'Já existe um parceiro com esse CPF/CNPJ.' : error.message };
    revalidatePath('/indireto', 'layout');
    if (antes && antes.validacao !== 'pendente' && !podeValidarIndireto(s.perfil)) {
      return { ok: 'Dados salvos. O cadastro voltou para validação do gerente.' };
    }
    return { ok: 'Dados salvos.' };
  }
  const { data, error } = await db.from('parceiros').insert(dados).select('id').single();
  if (error) return { erro: /parceiros_(cnpj|cpf)_unico/.test(error.message) ? 'Já existe um parceiro com esse CPF/CNPJ.' : error.message };
  revalidatePath('/indireto', 'layout');
  redirect(`/indireto/${data.id}`);
}

export async function excluirParceiro(_prev, fd) {
  const s = await sessao();
  if (!ehAdmin(s.perfil)) return { erro: 'Só administradores podem excluir parceiros.' };
  const { error } = await s.supabase.from('parceiros').delete().eq('id', txt(fd, 'id'));
  if (error) return { erro: error.message };
  revalidatePath('/indireto', 'layout');
  redirect('/indireto');
}

export async function criarTreinamento(_prev, fd) {
  const s = await editor();
  if (!s) return SEM_PERMISSAO;
  const dados = {
    parceiro_id: txt(fd, 'parceiro_id'),
    tipo: txt(fd, 'tipo'),
    data: txt(fd, 'data'),
    status: txt(fd, 'status') || 'agendado',
    instrutor: ou(txt(fd, 'instrutor')),
    observacao: ou(txt(fd, 'observacao')),
  };
  if (!TIPOS_TREINAMENTO[dados.tipo]) return { erro: 'Escolha o tipo de treinamento.' };
  if (!dados.data) return { erro: 'Informe a data.' };
  if (!STATUS_TREINAMENTO[dados.status]) return { erro: 'Status inválido.' };
  const { error } = await s.supabase.from('parceiro_treinamentos').insert(dados);
  if (error) return { erro: error.message };
  revalidatePath('/indireto', 'layout');
  return { ok: `Treinamento de ${TIPOS_TREINAMENTO[dados.tipo]} registrado.` };
}

export async function atualizarTreinamento(_prev, fd) {
  const s = await editor();
  if (!s) return SEM_PERMISSAO;
  const status = txt(fd, 'status');
  const data = txt(fd, 'data');
  if (!STATUS_TREINAMENTO[status] || !data) return { erro: 'Confira a data e o status.' };
  const { error } = await s.supabase.from('parceiro_treinamentos').update({ status, data }).eq('id', txt(fd, 'id'));
  if (error) return { erro: error.message };
  revalidatePath('/indireto', 'layout');
  return { ok: 'Salvo.' };
}

export async function excluirTreinamento(_prev, fd) {
  const s = await editor();
  if (!s) return SEM_PERMISSAO;
  const { error } = await s.supabase.from('parceiro_treinamentos').delete().eq('id', txt(fd, 'id'));
  if (error) return { erro: error.message };
  revalidatePath('/indireto', 'layout');
  return { ok: true };
}

export async function criarApontamento(_prev, fd) {
  const s = await editor();
  if (!s) return SEM_PERMISSAO;
  const texto = txt(fd, 'texto');
  if (!texto) return { erro: 'Escreva o apontamento.' };
  const { error } = await s.supabase.from('parceiro_apontamentos').insert({ parceiro_id: txt(fd, 'parceiro_id'), texto });
  if (error) return { erro: error.message };
  revalidatePath('/indireto', 'layout');
  return { ok: 'Apontamento registrado.' };
}

export async function excluirApontamento(_prev, fd) {
  const s = await editor();
  if (!s) return SEM_PERMISSAO;
  const { error, count } = await s.supabase.from('parceiro_apontamentos').delete({ count: 'exact' }).eq('id', txt(fd, 'id'));
  if (error) return { erro: error.message };
  if (!count) return { erro: 'Só quem escreveu (ou um administrador) pode apagar.' };
  revalidatePath('/indireto', 'layout');
  return { ok: true };
}

export async function validarParceiro(_prev, fd) {
  const s = await sessao();
  if (!podeValidarIndireto(s.perfil)) return { erro: 'Somente o gerente pode validar parceiros.' };
  const id = txt(fd, 'id');
  const decisao = txt(fd, 'decisao');
  const motivo = txt(fd, 'motivo');
  if (!['aprovado', 'reprovado', 'pendente'].includes(decisao)) return { erro: 'Escolha aprovar, reprovar ou desvalidar.' };
  if (decisao === 'reprovado' && !motivo) return { erro: 'Escreva o motivo da reprovação para o ponto focal corrigir.' };
  const { error } = await s.supabase.from('parceiros')
    .update({ validacao: decisao, validacao_motivo: motivo || null })
    .eq('id', id);
  if (error) return { erro: error.message };
  // registra no histórico de apontamentos
  await s.supabase.from('parceiro_apontamentos').insert({
    parceiro_id: id,
    texto: decisao === 'aprovado' ? `Cadastro validado.${motivo ? ` ${motivo}` : ''}`
      : decisao === 'pendente' ? `Validação desfeita, cadastro voltou para pendente.${motivo ? ` ${motivo}` : ''}`
      : `Cadastro reprovado: ${motivo}`,
  });
  revalidatePath('/indireto', 'layout');
  return { ok: decisao === 'aprovado' ? 'Cadastro validado.' : decisao === 'pendente' ? 'Validação desfeita.' : 'Cadastro reprovado. O ponto focal verá o motivo.' };
}

export async function vincularResposta(_prev, fd) {
  const s = await editor();
  if (!s) return SEM_PERMISSAO;
  const id = txt(fd, 'id');
  const parceiro_id = txt(fd, 'parceiro_id');
  if (!parceiro_id) return { erro: 'Escolha o parceiro.' };
  const { error } = await s.supabase.from('parceiro_respostas_form').update({ parceiro_id, ignorada: false }).eq('id', id);
  if (error) return { erro: error.message };
  const { error: e2 } = await s.supabase.rpc('aplicar_resposta_form', { p_resposta: id });
  if (e2) return { erro: e2.message };
  revalidatePath('/indireto', 'layout');
  return { ok: 'Resposta vinculada. Parceiro validado automaticamente.' };
}

export async function ignorarResposta(_prev, fd) {
  const s = await editor();
  if (!s) return SEM_PERMISSAO;
  const { error } = await s.supabase.from('parceiro_respostas_form').update({ ignorada: true }).eq('id', txt(fd, 'id'));
  if (error) return { erro: error.message };
  revalidatePath('/indireto', 'layout');
  return { ok: true };
}
