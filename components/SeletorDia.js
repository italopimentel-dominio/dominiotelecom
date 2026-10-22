'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const rot = (iso) => `${SEMANA[new Date(`${iso}T12:00:00Z`).getUTCDay()]}, ${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

// Seletor de dia no padrão do seletor de mês: ‹ seg, 21/10/2026 › com lista dos dias que têm pedidos.
// dias: [{ dia: 'AAAA-MM-DD', n }] (qualquer ordem)
export default function SeletorDia({ dia, dias = [], param = 'dia' }) {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  const lista = [...new Map([...dias, { dia, n: null }].map((d) => [d.dia, d])).values()].sort((a, b) => b.dia.localeCompare(a.dia));
  const ir = (d) => {
    if (!d) return;
    const p = new URLSearchParams(params.toString());
    p.set(param, d);
    router.push(`${caminho}?${p.toString()}`);
  };
  const i = lista.findIndex((d) => d.dia === dia);
  const anterior = lista[i + 1]?.dia;
  const proximo = i > 0 ? lista[i - 1].dia : null;
  return (
    <div className="assid-mes seletor-mes">
      <button type="button" className="seta" onClick={() => ir(anterior)} disabled={!anterior} aria-label={anterior ? `Dia anterior: ${rot(anterior)}` : 'Sem dia anterior'} title={anterior ? rot(anterior) : undefined}>‹</button>
      <label className="mes-atual">
        <span className="sr-only">Dia</span>
        <select value={dia} onChange={(e) => ir(e.target.value)}>
          {lista.map((d) => <option key={d.dia} value={d.dia}>{rot(d.dia)}{d.n ? ` · ${d.n} pedidos` : ''}</option>)}
        </select>
      </label>
      <button type="button" className="seta" onClick={() => ir(proximo)} disabled={!proximo} aria-label={proximo ? `Próximo dia: ${rot(proximo)}` : 'Sem próximo dia'} title={proximo ? rot(proximo) : undefined}>›</button>
    </div>
  );
}
