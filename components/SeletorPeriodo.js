'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function SeletorPeriodo({ periodos, atual }) {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  return (
    <label className="seletor">
      <span className="sr-only">Período</span>
      <select
        value={atual || ''}
        onChange={(e) => {
          const p = new URLSearchParams(params.toString());
          p.set('p', e.target.value);
          router.push(`${caminho}?${p.toString()}`);
        }}
      >
        {periodos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>
    </label>
  );
}
