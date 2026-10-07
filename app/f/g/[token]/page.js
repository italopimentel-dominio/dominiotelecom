import { criarClienteAdmin } from '@/lib/supabase/admin';
import { TIPOS_TREINAMENTO } from '@/lib/indireto';
import FormularioPublico from '@/components/FormularioPublico';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Duomni | Confirmação de treinamento', robots: { index: false } };

// Link geral do formulário: um link para todos, identificado pelo CPF/CNPJ
export default async function FormularioGeral({ params }) {
  const { token } = await params;
  const db = criarClienteAdmin();
  const { data: link } = await db.from('form_links_gerais').select('tipo').eq('token', String(token)).maybeSingle();
  const perguntas = link
    ? (await db.from('form_perguntas').select('id, texto, tipo_resposta, opcoes, obrigatoria').eq('tipo', link.tipo).eq('ativa', true).order('ordem').order('criado_em')).data
    : [];
  return (
    <main className="tela-login">
      <div className="cartao-login cartao-form">
        <img className="logo-login" src="/logo-duomni.png" alt="Duomni" />
        {!link ? (
          <><h1>Link inválido</h1><p className="dica">Este link não vale mais. Peça o link atualizado para quem te atendeu.</p></>
        ) : (
          <>
            <h1>Confirmação de treinamento</h1>
            <p className="dica" style={{ marginTop: 6 }}>{TIPOS_TREINAMENTO[link.tipo]}</p>
            <FormularioPublico token={String(token)} perguntas={perguntas || []} geral />
          </>
        )}
      </div>
    </main>
  );
}
