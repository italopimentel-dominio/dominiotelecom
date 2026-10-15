'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

// Mês com setas (‹ Outubro 2026 ›), no mesmo padrão de Assiduidade e Tempo falado.
// O nome do mês também abre a lista, para pular direto para outro mês.
export default function SeletorPeriodo({ periodos, atual }) {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  const ir = (id) => {
    if (!id) return;
    const p = new URLSearchParams(params.toString());
    p.set('p', id);
    router.push(`${caminho}?${p.toString()}`);
  };
  // períodos vêm do mais novo para o mais antigo
  const i = periodos.findIndex((p) => p.id === atual);
  const anterior = i >= 0 ? periodos[i + 1] : null;
  const proximo = i > 0 ? periodos[i - 1] : null;
  return (
    <div className="assid-mes seletor-mes">
      <button type="button" className="seta" onClick={() => ir(anterior?.id)} disabled={!anterior} aria-label={anterior ? `Mês anterior: ${anterior.nome}` : 'Sem mês anterior'} title={anterior?.nome}>‹</button>
      <label className="mes-atual">
        <span className="sr-only">Período</span>
        <select value={atual || ''} onChange={(e) => ir(e.target.value)}>
          {periodos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </label>
      <button type="button" className="seta" onClick={() => ir(proximo?.id)} disabled={!proximo} aria-label={proximo ? `Próximo mês: ${proximo.nome}` : 'Sem próximo mês'} title={proximo?.nome}>›</button>
    </div>
  );
}
