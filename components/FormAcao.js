'use client';
import { useActionState } from 'react';

// Formulário que chama uma server action e mostra o retorno (erro ou sucesso) logo abaixo.
export default function FormAcao({ acao, children, className = '', confirmar }) {
  const [estado, formAction, pendente] = useActionState(acao, null);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => { if (confirmar && !window.confirm(confirmar)) e.preventDefault(); }}
    >
      <fieldset disabled={pendente} className="fs">{children}</fieldset>
      {estado?.erro && <p className="msg msg-erro" role="alert">{estado.erro}</p>}
      {typeof estado?.ok === 'string' && <p className="msg msg-ok">{estado.ok}</p>}
    </form>
  );
}
