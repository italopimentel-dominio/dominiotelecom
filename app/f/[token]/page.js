import { criarClienteAdmin } from '@/lib/supabase/admin';
import { TIPOS_TREINAMENTO } from '@/lib/indireto';
import FormularioPublico from '@/components/FormularioPublico';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Duomni | Confirmação de treinamento', robots: { index: false } };

function Cartao({ children }) {
  return (
    <main className="tela-login">
      <div className="cartao-login cartao-form">
        <img className="logo-login" src="/logo-duomni.png" alt="Duomni" />
        {children}
      </div>
    </main>
  );
}

export default async function FormularioParceiro({ params }) {
  const { token } = await params;
  const db = criarClienteAdmin();
  const { data: link } = await db.from('form_links').select('id, tipo, parceiro_id, respondido_em, expira_em').eq('token', String(token)).maybeSingle();
  if (!link) return <Cartao><h1>Link inválido</h1><p className="dica">Confira o link ou peça um novo para quem te atendeu.</p></Cartao>;
  if (link.respondido_em) return <Cartao><h1>Formulário respondido ✓</h1><p className="dica">Recebemos suas respostas. Obrigado!</p></Cartao>;
  if (new Date(link.expira_em) < new Date()) return <Cartao><h1>Link expirado</h1><p className="dica">Peça um novo link para quem te atendeu.</p></Cartao>;

  const [{ data: parceiro }, { data: perguntas }] = await Promise.all([
    db.from('parceiros').select('nome_fantasia').eq('id', link.parceiro_id).maybeSingle(),
    db.from('form_perguntas').select('id, texto, tipo_resposta, opcoes, obrigatoria').eq('tipo', link.tipo).eq('ativa', true).order('ordem').order('criado_em'),
  ]);
  return (
    <Cartao>
      <h1>Confirmação de treinamento</h1>
      <p className="dica" style={{ marginTop: 6 }}>
        {TIPOS_TREINAMENTO[link.tipo]} · {parceiro?.nome_fantasia}
      </p>
      <FormularioPublico token={String(token)} perguntas={perguntas || []} />
    </Cartao>
  );
}
