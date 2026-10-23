import Link from 'next/link';
import { exigirSessao, podeEditar } from '@/lib/auth';
import { hojeSP } from '@/lib/datas';
import { fmtData, fmtPct, fmtValor } from '@/lib/formato';
import { TEMAS, situacaoCampanha, ganhadoresDe } from '@/lib/campanhas';
import { textoRegra, regraValida } from '@/lib/campanhaRegras';
import { carregarCampanha } from '@/lib/campanhasDados';
import FormCampanha from '@/components/FormCampanha';
import { criarCampanha } from '@/app/actions/campanhas';

const MEDALHA = ['🥇', '🥈', '🥉'];
const tagDe = (sit) => (sit.fechada ? 'tag' : sit.estado === 'andamento' ? 'tag tag-ok' : sit.estado === 'futura' ? 'tag tag-acento' : 'tag');

function Abas({ aba }) {
  return (
    <div className="alternar-visao" style={{ marginBottom: 16, display: 'inline-flex' }}>
      <Link href="/campanhas" className={aba === 'campanhas' ? 'ativo' : ''}>🏁 Campanhas</Link>
      <Link href="/campanhas?aba=ganhadores" className={aba === 'ganhadores' ? 'ativo' : ''}>🏆 Ganhadores</Link>
    </div>
  );
}

function Ganhador({ p, pos }) {
  return (
    <div className="bloco" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px' }}>
      <div style={{ fontSize: pos < 3 ? 28 : 16, minWidth: 34, textAlign: 'center', fontWeight: 700 }}>{MEDALHA[pos] || `${pos + 1}º`}</div>
      {p.foto
        ? <img src={p.foto} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
        : <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--acento-suave, #ece6fd)', fontWeight: 700 }}>{(p.nome || '?').slice(0, 1)}</div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>{p.nomeCompleto}</strong>
        {p.equipe && <span className="nome-sub">{p.equipe}</span>}
        <p className="dica" style={{ margin: '2px 0 0' }}>
          {p.porItem.map((x) => `${x.item.nome}: ${fmtValor(x.realizado, x.item.unidade)} de ${fmtValor(x.item.alvo, x.item.unidade)}`).join(' · ')}
        </p>
      </div>
    </div>
  );
}

function Ganhadores({ campanhas, selecionada, hoje }) {
  if (!campanhas.length) return <div className="vazio"><h2>Nenhuma campanha ainda</h2><p>Quando houver campanhas, os ganhadores aparecem aqui.</p></div>;
  const sel = campanhas.find((x) => x.campanha.id === selecionada) || campanhas[0];
  const { campanha: c, calc, itens, fontes } = sel;
  const sit = situacaoCampanha(c, hoje);
  const { ganhadores, maisPerto } = ganhadoresDe(c, calc);
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <nav style={{ flex: '1 1 240px', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {campanhas.map(({ campanha: x, calc: cx }) => {
          const s = situacaoCampanha(x, hoje);
          const n = ganhadoresDe(x, cx).ganhadores.length;
          const ativa = x.id === c.id;
          return (
            <Link key={x.id} href={`/campanhas?aba=ganhadores&c=${x.id}`} className="bloco"
              style={{ padding: '10px 12px', textDecoration: 'none', color: 'inherit', borderColor: ativa ? 'var(--acento, #6b40e7)' : undefined, boxShadow: ativa ? '0 0 0 1px var(--acento, #6b40e7)' : undefined }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <strong>{TEMAS[x.tema]?.emoji} {x.nome}</strong>
                <span className={tagDe(s)}>{s.texto}</span>
              </div>
              <p className="dica" style={{ margin: '4px 0 0' }}>
                {fmtData(x.data_inicio, true)} a {fmtData(x.data_fim, true)} · {n ? `${n} ganhador${n > 1 ? 'es' : ''}` : 'sem ganhadores'}{s.fechada ? '' : ' (parcial)'}
              </p>
            </Link>
          );
        })}
      </nav>

      <section style={{ flex: '3 1 420px', minWidth: 0 }}>
        <div className="bloco">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <span className={tagDe(sit)}>{sit.texto}</span>
              <h2 style={{ margin: '6px 0 2px' }}>{TEMAS[c.tema]?.emoji} {c.nome}</h2>
              <p className="dica" style={{ margin: 0 }}>{fmtData(c.data_inicio, true)} a {fmtData(c.data_fim, true)} · {c.participacao === 'equipe' ? 'por equipe' : 'individual'} · {c.modo === 'coletiva' ? 'meta coletiva' : 'cada participante precisa atingir'}</p>
              {c.premio && <p style={{ margin: '8px 0 0' }}>🎁 <strong>Prêmio:</strong> {c.premio}</p>}
            </div>
            <Link href={`/campanhas/${c.id}`} className="btn btn-sec btn-peq">Abrir campanha</Link>
          </div>
          {!sit.fechada && (
            <p className="dica" style={{ margin: '10px 0 0' }}>⏳ A campanha ainda não foi fechada: a lista abaixo é parcial e pode mudar. Feche a campanha na página dela para congelar o resultado.</p>
          )}
        </div>

        <div className="bloco" style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Regras</h3>
          {c.regras && <p style={{ whiteSpace: 'pre-wrap', marginTop: 0 }}>{c.regras}</p>}
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {itens.map((it) => (
              <li key={it.id} style={{ marginBottom: 4 }}>
                <strong>{it.nome}</strong>: alvo {fmtValor(it.alvo, it.unidade)}{c.modo === 'coletiva' ? ' (soma da equipe)' : ' por participante'}
                <span className="dica"> · {regraValida(it.regra) ? textoRegra(it.regra, fontes) : 'resultado lançado à mão.'}</span>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ marginTop: 16 }}>
          <h3>{ganhadores.length ? `🏆 Ganhadores (${ganhadores.length})` : '🏆 Ganhadores'}</h3>
          {ganhadores.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ganhadores.map((p, i) => <Ganhador key={p.id} p={p} pos={i} />)}
            </div>
          ) : (
            <>
              <p className="dica">{c.modo === 'coletiva' ? 'A equipe ainda não bateu todos os alvos.' : 'Ninguém atingiu o alvo de todos os itens.'}{maisPerto.length ? ' Quem chegou mais perto:' : ''}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {maisPerto.map((p, i) => <Ganhador key={p.id} p={p} pos={i} />)}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default async function Campanhas({ searchParams }) {
  const sp = (await searchParams) || {};
  const aba = sp.aba === 'ganhadores' ? 'ganhadores' : 'campanhas';
  const { supabase, perfil } = await exigirSessao();
  const editar = podeEditar(perfil);
  const hoje = hojeSP();
  const { data: lista = [] } = await supabase.from('campanhas').select('id').order('data_fim', { ascending: false });
  const campanhas = (await Promise.all((lista || []).map((c) => carregarCampanha(supabase, c.id)))).filter(Boolean);
  const ordem = { andamento: 0, futura: 1, encerrada: 2 };
  campanhas.sort((a, b) => ordem[situacaoCampanha(a.campanha, hoje).estado] - ordem[situacaoCampanha(b.campanha, hoje).estado]);

  return (
    <>
      <div className="topo">
        <div>
          <h1>Campanhas</h1>
          <p className="sub">Desafios comerciais com regras próprias, resultados lançados à mão ou calculados pelas planilhas e um visual para animar a equipe.</p>
        </div>
      </div>
      <Abas aba={aba} />

      {aba === 'ganhadores' ? (
        // encerradas primeiro (fechadas antes), depois as em andamento; dentro de cada grupo, a que terminou por último
        <Ganhadores
          hoje={hoje}
          selecionada={sp.c}
          campanhas={[...campanhas].sort((a, b) => {
            const pa = a.campanha.fechada_em ? 0 : situacaoCampanha(a.campanha, hoje).estado === 'encerrada' ? 1 : 2;
            const pb = b.campanha.fechada_em ? 0 : situacaoCampanha(b.campanha, hoje).estado === 'encerrada' ? 1 : 2;
            return pa - pb || b.campanha.data_fim.localeCompare(a.campanha.data_fim);
          })}
        />
      ) : (
        <>
          {editar && (
            <details className="bloco" open={!campanhas.length} style={{ marginBottom: 18 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>+ Nova campanha</summary>
              <div style={{ marginTop: 14 }}>
                <p className="dica" style={{ marginTop: 0 }}>Depois de criar, na página da campanha você inclui os participantes e pode deixar cada item ⚡ automático (regra sobre as planilhas, pela data de entrada).</p>
                <FormCampanha acao={criarCampanha} comItens botao="Criar campanha" c={{ data_inicio: hoje }} />
              </div>
            </details>
          )}

          {!campanhas.length ? (
            <div className="vazio"><h2>Nenhuma campanha ainda</h2><p>{editar ? 'Crie a primeira campanha acima.' : 'Quando houver campanhas, elas aparecem aqui.'}</p></div>
          ) : (
            <div className="cp-cards">
              {campanhas.map(({ campanha: c, calc, participantes }) => {
                const sit = situacaoCampanha(c, hoje);
                const lider = calc.ranking[0];
                return (
                  <Link key={c.id} href={`/campanhas/${c.id}`} className={`cp-card cp-card-${sit.estado}`}>
                    <div className="cp-card-emoji">{TEMAS[c.tema]?.emoji}</div>
                    <div className="cp-card-corpo">
                      <span className={tagDe(sit)}>{sit.texto}</span>
                      <h3>{c.nome}</h3>
                      <p className="dica">{fmtData(c.data_inicio, true)} a {fmtData(c.data_fim, true)}, {participantes.length} {c.participacao === 'equipe' ? 'equipes' : 'participantes'}</p>
                      <div className="cp-barra" style={{ marginTop: 10 }}><span style={{ width: `${Math.min(calc.geral, 1) * 100}%` }} /></div>
                      <p className="dica" style={{ marginTop: 6 }}>{fmtPct(calc.geral)} do total{lider && lider.progresso > 0 ? `, liderança: ${lider.nome}` : ''}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
