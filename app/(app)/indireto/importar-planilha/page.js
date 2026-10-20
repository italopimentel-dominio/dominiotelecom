import Link from 'next/link';
import { redirect } from 'next/navigation';
import { exigirSessao, podeValidarIndireto } from '@/lib/auth';
import { buscarTodas } from '@/lib/buscarTodas';
import { normalizar } from '@/lib/nomes';
import ImportarPlanilhaIndireto from '@/components/ImportarPlanilhaIndireto';
import { listarFocais, listarStatus } from '../dados';

export const maxDuration = 60; // a gravação cadastra e completa centenas de parceiros

export default async function PaginaImportarPlanilha() {
  const { perfil, supabase } = await exigirSessao();
  if (!podeValidarIndireto(perfil)) redirect('/indireto');
  const [focais, statusLista, parceiros, treinos, colabs, apelidosColab, grupos, apelidosFocais] = await Promise.all([
    listarFocais(supabase),
    listarStatus(supabase),
    buscarTodas(() => supabase.from('parceiros').select('id, nome_fantasia, razao_social, cpf, cnpj, status, ponto_focal_id, data_ativacao, contato_email, contato_telefone, observacoes').order('id')),
    buscarTodas(() => supabase.from('parceiro_treinamentos').select('parceiro_id, tipo').eq('status', 'realizado').order('parceiro_id')),
    buscarTodas(() => supabase.from('colaboradores').select('nome').order('nome')),
    buscarTodas(() => supabase.from('colaborador_apelidos').select('apelido').order('apelido')),
    supabase.from('grupos').select('id, nome, ativo').order('nome'),
    supabase.from('indireto_focal_apelidos').select('apelido, profile_id, profile_id_2'),
  ]);
  const chave = (s) => normalizar(String(s ?? '')).replace(/\s+/g, ' ').trim();
  const listaGrupos = (grupos.data || []).filter((g) => g.ativo !== false);
  return (
    <>
      <div className="topo">
        <div>
          <p className="sub"><Link href="/indireto">← Controle Indireto</Link></p>
          <h1>Importar planilha de acompanhamento</h1>
          <p className="sub">
            Suba a planilha “Indireto - Acompanhamento Diário Parceiros” (Excel). O sistema lê o cadastro (colunas G a N), os onboardings (O–P e AG–AH)
            e os treinamentos (U–X e AA–AD), mostra uma prévia e só grava quando você confirmar. Nada que já está no sistema é sobrescrito.
          </p>
        </div>
      </div>
      {apelidosFocais.error && <p className="msg msg-erro">Rode o arquivo 039_importar_acompanhamento.sql no Supabase antes de importar.</p>}
      <section className="bloco secao">
        <ImportarPlanilhaIndireto
          focais={focais.map((f) => ({ id: f.id, nome: f.nome, usuario: f.usuario }))}
          statusLista={statusLista}
          parceiros={parceiros.data || []}
          treinosExistentes={(treinos.data || []).map((t) => `${t.parceiro_id}|${t.tipo}`)}
          nomesColaboradores={[...new Set([...(colabs.data || []).map((c) => chave(c.nome)), ...(apelidosColab.data || []).map((a) => chave(a.apelido))])]}
          grupos={listaGrupos.map((g) => ({ id: g.id, nome: g.nome }))}
          apelidosFocais={apelidosFocais.data || []}
        />
      </section>
    </>
  );
}
