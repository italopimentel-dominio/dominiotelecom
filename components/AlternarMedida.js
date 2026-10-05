'use client';
import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

// Botão Quantidade | Receita: troca a visão de todas as telas de metas
export default function AlternarMedida({ atual }) {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  const [pendente, iniciar] = useTransition();
  function ir(m) {
    if (m === atual) return;
    document.cookie = `medida=${m}; path=/; max-age=31536000; samesite=lax`;
    const p = new URLSearchParams(params.toString());
    p.delete('m');
    iniciar(() => {
      router.replace(p.toString() ? `${caminho}?${p}` : caminho);
      router.refresh();
    });
  }
  return (
    <div className={`alternar-visao alternar-medida${pendente ? ' carregando' : ''}`} role="group" aria-label="Ver em quantidade ou receita">
      <button type="button" className={atual === 'qtd' ? 'ativo' : ''} onClick={() => ir('qtd')} aria-pressed={atual === 'qtd'}># Quantidade</button>
      <button type="button" className={atual === 'brl' ? 'ativo' : ''} onClick={() => ir('brl')} aria-pressed={atual === 'brl'}>R$ Receita</button>
    </div>
  );
}
