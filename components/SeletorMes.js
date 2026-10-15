'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const nomeMes = (m) => `${MESES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;

// Mesmo seletor das telas de Metas, para telas que usam o mês no formato "2026-10" (?mes=).
// meses: lista de 'AAAA-MM' (qualquer ordem). limpar: parâmetros que voltam ao padrão ao trocar de mês.
export default function SeletorMes({ mes, meses, param = 'mes', limpar = [] }) {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  const lista = [...new Set([...meses, mes])].sort().reverse(); // mais novo primeiro
  const ir = (m) => {
    if (!m) return;
    const p = new URLSearchParams(params.toString());
    p.set(param, m);
    limpar.forEach((k) => p.delete(k));
    router.push(`${caminho}?${p.toString()}`);
  };
  const i = lista.indexOf(mes);
  const anterior = lista[i + 1];
  const proximo = i > 0 ? lista[i - 1] : null;
  return (
    <div className="assid-mes seletor-mes">
      <button type="button" className="seta" onClick={() => ir(anterior)} disabled={!anterior} aria-label={anterior ? `Mês anterior: ${nomeMes(anterior)}` : 'Sem mês anterior'} title={anterior ? nomeMes(anterior) : undefined}>‹</button>
      <label className="mes-atual">
        <span className="sr-only">Mês</span>
        <select value={mes} onChange={(e) => ir(e.target.value)}>
          {lista.map((m) => <option key={m} value={m}>{nomeMes(m)}</option>)}
        </select>
      </label>
      <button type="button" className="seta" onClick={() => ir(proximo)} disabled={!proximo} aria-label={proximo ? `Próximo mês: ${nomeMes(proximo)}` : 'Sem próximo mês'} title={proximo ? nomeMes(proximo) : undefined}>›</button>
    </div>
  );
}

// Meses de "atras" meses antes até "frente" meses depois de 'AAAA-MM'
export function mesesAoRedor(ref, atras = 18, frente = 1) {
  const [a, m] = ref.split('-').map(Number);
  const out = [];
  for (let k = -atras; k <= frente; k++) out.push(new Date(Date.UTC(a, m - 1 + k, 1)).toISOString().slice(0, 7));
  return out;
}
