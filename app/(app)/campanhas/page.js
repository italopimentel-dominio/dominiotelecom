import Link from 'next/link';
import { exigirSessao, podeEditar } from '@/lib/auth';
import { hojeSP } from '@/lib/datas';
import { fmtData, fmtPct } from '@/lib/formato';
import { TEMAS, situacaoCampanha } from '@/lib/campanhas';
import { carregarCampanha } from '@/lib/campanhasDados';
import FormCampanha from '@/components/FormCampanha';
import { criarCampanha } from '@/app/actions/campanhas';

export default async function Campanhas() {
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
          <p className="sub">Desafios comerciais com regras próprias, resultados lançados à mão e um visual para animar a equipe.</p>
        </div>
      </div>

      {editar && (
        <details className="bloco" open={!campanhas.length} style={{ marginBottom: 18 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>+ Nova campanha</summary>
          <div style={{ marginTop: 14 }}><FormCampanha acao={criarCampanha} comItens botao="Criar campanha" c={{ data_inicio: hoje }} /></div>
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
                  <span className={`tag ${sit.estado === 'andamento' ? 'tag-ok' : sit.estado === 'futura' ? 'tag-acento' : ''}`}>{sit.texto}</span>
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
  );
}
