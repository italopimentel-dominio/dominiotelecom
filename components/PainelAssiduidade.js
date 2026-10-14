'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { marcarAssiduidade, lancarAssiduidadeEmLote } from '@/app/actions/assiduidade';
import { PROXIMO, STATUS, contar, ativoNoDia, META_ASSIDUIDADE } from '@/lib/assiduidade';

const pctTxt = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const baixo = (v) => v != null && v < META_ASSIDUIDADE;
const rotDia = (iso) => `${iso.slice(8)}/${iso.slice(5, 7)}`;
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const semana = (iso) => SEMANA[new Date(`${iso}T12:00:00Z`).getUTCDay()];

// Chamada do dia + mapa do mês da equipe, com o mesmo estado (o que muda num aparece no outro)
export default function PainelAssiduidade({ grupoId, nomeEquipe, dias, hoje, colaboradores, registros, podeEditar }) {
  const router = useRouter();
  const [mapa, setMapa] = useState(registros);
  const [msg, setMsg] = useState('');
  const atualizar = useRef(null);
  useEffect(() => () => clearTimeout(atualizar.current), []);
  const depois = () => { clearTimeout(atualizar.current); atualizar.current = setTimeout(() => router.refresh(), 1200); };

  const st = (id, d) => mapa[id]?.[d] || '';
  const pode = (c, d) => podeEditar && ativoNoDia(c, d) && d <= hoje;
  const set = (id, d, v) => setMapa((m) => ({ ...m, [id]: { ...(m[id] || {}), [d]: v } }));

  async function definir(c, d, novo) {
    if (!pode(c, d)) return;
    const antes = st(c.id, d);
    set(c.id, d, novo);
    const r = await marcarAssiduidade(c.id, d, novo, grupoId);
    if (r.erro) { set(c.id, d, antes); setMsg(r.erro); } else depois();
  }

  const diaHoje = dias.includes(hoje) ? hoje : null;
  const daChamada = diaHoje ? colaboradores.filter((c) => ativoNoDia(c, diaHoje)) : [];
  const pendentes = daChamada.filter((c) => !st(c.id, diaHoje));

  async function pendentesPresentes() {
    if (!pendentes.length) return;
    pendentes.forEach((c) => set(c.id, diaHoje, 'P'));
    const r = await lancarAssiduidadeEmLote(pendentes.map((c) => ({ colaborador_id: c.id, data: diaHoje, status: 'P', grupo_id: grupoId })), { soVazios: true });
    if (r.erro) { setMsg(r.erro); pendentes.forEach((c) => set(c.id, diaHoje, '')); } else { setMsg(`${pendentes.length} marcados como presentes.`); depois(); }
  }

  const porColab = useMemo(() => Object.fromEntries(colaboradores.map((c) => [c.id, contar(dias.map((d) => st(c.id, d)))])), [mapa, dias, colaboradores]);
  const equipe = contar(colaboradores.flatMap((c) => dias.map((d) => st(c.id, d))));

  return (
    <div className={diaHoje ? 'assid-colunas' : ''}>
      {diaHoje && (
        <section className="assid-cartao" aria-labelledby="chamada">
          <div className="assid-cab">
            <div>
              <h2 id="chamada">Chamada de hoje · {nomeEquipe}</h2>
              <p className="dica">{semana(diaHoje)}, {rotDia(diaHoje)} · {daChamada.length - pendentes.length} de {daChamada.length} marcados{pendentes.length ? ` · ${pendentes.length} pendentes` : ''}</p>
            </div>
            {podeEditar && pendentes.length > 0 && (
              <button type="button" className="btn" onClick={pendentesPresentes}>Marcar pendentes como presentes</button>
            )}
          </div>
          <ul className="chamada">
            {daChamada.map((c) => {
              const atual = st(c.id, diaHoje);
              const pc = porColab[c.id].pct;
              return (
                <li key={c.id}>
                  <span className="chamada-nome">
                    <b>{c.nome}</b>
                    <span className={baixo(pc) ? 'assid-baixo' : 'dica'}>{pc == null ? 'sem marcações no mês' : `mês: ${pctTxt(pc)}`}</span>
                  </span>
                  <span className="chamada-botoes" role="group" aria-label={`Presença de ${c.nome} hoje`}>
                    {['P', 'F', 'A'].map((s) => (
                      <button key={s} type="button" disabled={!podeEditar} aria-pressed={atual === s} title={STATUS[s]}
                        className={`chamada-btn ${atual === s ? `ativo-${s}` : ''}`}
                        onClick={() => definir(c, diaHoje, atual === s ? '' : s)}>{s}</button>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="assid-cartao" aria-labelledby="mapa">
        <div className="assid-cab">
          <div>
            <h2 id="mapa">Mês da equipe · <span className={baixo(equipe.pct) ? 'assid-baixo' : 'assid-ok'}>{pctTxt(equipe.pct)}</span></h2>
            <p className="dica">Cada quadradinho é um dia útil.{podeEditar ? ' Clique para corrigir: vazio → P → F → A.' : ''}</p>
          </div>
          <span className="legenda-assid">
            <span><i className="q s-P" /> Presente</span><span><i className="q s-F" /> Falta</span><span><i className="q s-A" /> Atestado</span>
          </span>
        </div>
        <div className="mapa-rolagem">
          <div className="mapa-assid" style={{ '--dias': dias.length }}>
            <div className="mapa-linha mapa-topo" aria-hidden="true">
              <span />
              <span className="mapa-dias">{dias.map((d) => <span key={d} className={d === hoje ? 'hoje' : ''}>{d.slice(8)}</span>)}</span>
              <span />
            </div>
            {colaboradores.map((c) => (
              <div key={c.id} className="mapa-linha">
                <span className="mapa-nome" title={c.nome}>{c.nome}</span>
                <span className="mapa-dias">
                  {dias.map((d) => {
                    const s = st(c.id, d);
                    const fora = !ativoNoDia(c, d);
                    return (
                      <button key={d} type="button" disabled={!pode(c, d)}
                        className={`q ${fora ? 'fora' : s ? `s-${s}` : d === hoje ? 'pend-hoje' : d < hoje ? 'vazio' : 'futuro'}`}
                        title={`${c.nome} · ${semana(d)} ${rotDia(d)}: ${fora ? 'fora do período na equipe' : s ? STATUS[s] : 'sem marcação'}`}
                        aria-label={`${rotDia(d)}: ${fora ? 'fora do período' : s ? STATUS[s] : 'sem marcação'}`}
                        onClick={() => definir(c, d, PROXIMO[s])} />
                    );
                  })}
                </span>
                <b className={baixo(porColab[c.id].pct) ? 'assid-baixo' : porColab[c.id].pct == null ? 'dica' : 'assid-ok'}>{pctTxt(porColab[c.id].pct)}</b>
              </div>
            ))}
          </div>
        </div>
        {msg && <p className="dica" style={{ marginTop: 8, fontWeight: 600 }}>{msg}</p>}
      </section>
    </div>
  );
}
