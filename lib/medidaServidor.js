import { cookies } from 'next/headers';

// Medida escolhida na tela (Quantidade ou Receita). Fica salva no navegador.
export async function lerMedida(sp) {
  if (sp?.m === 'brl' || sp?.m === 'qtd') return sp.m;
  const c = await cookies();
  return c.get('medida')?.value === 'brl' ? 'brl' : 'qtd';
}
