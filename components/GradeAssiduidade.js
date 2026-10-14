'use client';
import { useMemo, useState } from 'react';
import { marcarAssiduidade, lancarAssiduidadeEmLote } from '@/app/actions/assiduidade';
import { PROXIMO, STATUS, contar, ativoNoDia, META_ASSIDUIDADE } from '@/lib/assiduidade';

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const classePct = (v) => (v == null ? '' : v >= META_ASSIDUIDADE ? 'assid-ok' : 'assid-baixo');
const rotDia = (iso) => `${iso.slice(8)}/${iso.slice(5, 7)}`;
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

// Grade da equipe: clique na célula alterna vazio → P → F → A → vazio. Grava na hora.
export default function GradeAssiduidade({ grupoId, dias, hoje, colaboradores, registros, podeEditar }) {
  const [mapa, setMapa] = useState(registros);
  const [msg, setMsg] = useState('');
  const st = (c, d) => mapa[c]?.[d] || '';
  const pode = (c, d) => podeEditar && ativoNoDia(c, d);

  async function clicar(c, d) {
    if (!pode(c, d)) return;
    const antes = st(c.id, d);
    const novo = PROXIMO[antes];
    setMapa((m) => ({ ...m, [c.id]: { ...(m[c.id] || {}), [d]: novo } }));
    const r = await marcarAssiduidade(c.id, d, novo, grupoId);
    if (r.erro) { setMapa((m) => ({ ...m, [c.id]: { ...(m[c.id] || {}), [d]: antes } })); setMsg(r.erro); }
  }

  async function todosPresentes(d) {
    const alvo = colaboradores.filter((c) => pode(c, d) && !st(c.id, d));
    if (!alvo.length) return setMsg(`Todos já estão marcados em ${rotDia(d)}.`);
    setMapa((m) => { const n = { ...m }; alvo.forEach((c) => { n[c.id] = { ...(n[c.id] || {}), [d]: 'P' }; }); return n; });
    const r = await lancarAssiduidadeEmLote(alvo.map((c) => ({ colaborador_id: c.id, data: d, status: 'P', grupo_id: grupoId })), { soVazios: true });
    if (r.erro) { setMsg(r.erro); setMapa(registros); } else setMsg(`${alvo.length} marcados como presentes em ${rotDia(d)}. Troque só quem faltou.`);
  }

  const porDia = useMemo(() => Object.fromEntries(dias.map((d) => [d, contar(colaboradores.map((c) => st(c.id, d)))])), [mapa, dias, colaboradores]);
  const porColab = useMemo(() => Object.fromEntries(colaboradores.map((c) => [c.id, contar(dias.map((d) => st(c.id, d)))])), [mapa, dias, colaboradores]);
  const equipe = contar(colaboradores.flatMap((c) => dias.map((d) => st(c.id, d))));

  return (
    <div>
      <div className="tabela-wrap tabela-fixa">
        <table className="grade-assid">
          <thead>
            <tr>
              <th className="esq">Colaborador</th>
              {dias.map((d) => (
                <th key={d} className={d === hoje ? 'hoje' : ''}>
                  <span className="dica">{SEMANA[new Date(`${d}T12:00:00Z`).getUTCDay()]}</span><br />{rotDia(d)}
                  {podeEditar && d <= hoje && <button type="button" className="link-acao" title="Marcar como presente todos que estão em branco neste dia" onClick={() => todosPresentes(d)}>✓ todos</button>}
                </th>
              ))}
              <th>Assiduidade</th>
            </tr>
          </thead>
          <tbody>
            {colaboradores.map((c) => (
              <tr key={c.id}>
                <td className="esq">{c.nome}{c.data_admissao && c.data_admissao >= dias[0] && <span className="nome-sub">admitido em {rotDia(c.data_admissao)}</span>}</td>
                {dias.map((d) => {
                  const s = st(c.id, d);
                  const fora = !ativoNoDia(c, d);
                  return (
                    <td key={d} className={`celula-assid ${fora ? 'fora' : ''} ${s ? `s-${s}` : ''} ${pode(c, d) ? 'clicavel' : ''}`}
                      onClick={() => clicar(c, d)} title={fora ? 'Fora do período na equipe' : s ? STATUS[s] : 'Sem marcação'}>
                      {fora ? '' : s}
                    </td>
                  );
                })}
                <td className={classePct(porColab[c.id].pct)}><b>{pct(porColab[c.id].pct)}</b></td>
              </tr>
            ))}
            <tr className="linha-total">
              <td className="esq"><b>% do dia</b></td>
              {dias.map((d) => <td key={d} className={classePct(porDia[d].pct)}>{pct(porDia[d].pct)}</td>)}
              <td className={classePct(equipe.pct)}><b>{pct(equipe.pct)}</b></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="dica" style={{ marginTop: 6 }}>
        Clique na célula: vazio → <b>P</b> presente → <b>F</b> falta → <b>A</b> atestado → vazio. Grava na hora.
        % = presenças ÷ dias marcados (dia em branco não conta). Meta: {Math.round(META_ASSIDUIDADE * 100)}%.
      </p>
      {msg && <p className="dica" style={{ fontWeight: 600 }}>{msg}</p>}
    </div>
  );
}
