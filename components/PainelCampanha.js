import { fmtValor, fmtPct, fmtData } from '@/lib/formato';
import { VEICULOS, situacaoCampanha } from '@/lib/campanhas';
import { paraMs, hojeSP } from '@/lib/datas';

const CORES = ['#6b40e7', '#1b7446', '#e0457b', '#d97706', '#2563a8', '#8a3fb3', '#0f766e', '#c2410c'];
const corDe = (s) => CORES[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % CORES.length];
const veiculoDe = (s) => VEICULOS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % VEICULOS.length];
const detalhe = (p) => p.porItem.map((x) => `${x.item.nome}: ${fmtValor(x.realizado, x.item.unidade)} de ${fmtValor(x.item.alvo, x.item.unidade)}`).join(' | ');

function Confete() {
  const pecas = ['🎉', '✨', '🎊', '⭐', '🥳', '💜'];
  return (
    <div className="cp-confete" aria-hidden>
      {Array.from({ length: 22 }, (_, i) => (
        <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.6}s`, animationDuration: `${5 + (i % 5)}s` }}>{pecas[i % pecas.length]}</span>
      ))}
    </div>
  );
}

function Corrida({ ranking }) {
  return (
    <div className="cp-pista">
      {ranking.map((p) => {
        const pos = Math.min(p.progresso, 1);
        return (
          <div className={`cp-raia${p.posicao <= 3 ? ` cp-top${p.posicao}` : ''}`} key={p.id} title={detalhe(p)}>
            <div className="cp-raia-nome"><b>{p.posicao}º</b><span>{p.nome}</span></div>
            <div className="cp-trilho">
              <span className="cp-carro" style={{ left: `calc(${pos * 100}% - ${pos * 2.4}em)` }}><span>{veiculoDe(p.nome)}</span></span>
            </div>
            <div className="cp-raia-pct">{fmtPct(p.progresso)}{p.completo ? ' 🏆' : ''}</div>
          </div>
        );
      })}
    </div>
  );
}

function Foguete({ ranking }) {
  return (
    <div className="cp-ceu">
      <div className="cp-lua"><span>🌕</span> 100%</div>
      <div className="cp-foguetes">
        {ranking.map((p) => {
          const pos = Math.min(p.progresso, 1);
          return (
            <div className="cp-coluna" key={p.id} title={detalhe(p)}>
              <div className="cp-trilha-v">
                <div className="cp-rastro" style={{ height: `${pos * 100}%` }} />
                <span className="cp-foguete" style={{ bottom: `calc(${pos * 100}% - ${pos * 1.6}em)` }}>{p.completo ? '🌟' : '🚀'}</span>
              </div>
              <div className="cp-col-pct">{fmtPct(p.progresso)}</div>
              <div className="cp-col-nome">{p.nome}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Podio({ ranking }) {
  const [p1, p2, p3] = ranking;
  const Degrau = ({ p, lugar }) => p ? (
    <div className={`cp-degrau cp-lugar-${lugar}`} title={detalhe(p)}>
      <div className="cp-medalha">{['🥇', '🥈', '🥉'][lugar - 1]}</div>
      <div className="cp-avatar" style={{ background: corDe(p.nome) }}>{p.nome.charAt(0)}</div>
      <div className="cp-podio-nome">{p.nome}</div>
      <div className="cp-podio-pct">{fmtPct(p.progresso)}</div>
      <div className="cp-bloco">{lugar}</div>
    </div>
  ) : <div className={`cp-degrau cp-lugar-${lugar} cp-vazio`}><div className="cp-bloco">{lugar}</div></div>;
  return (
    <div>
      <div className="cp-podio"><Degrau p={p2} lugar={2} /><Degrau p={p1} lugar={1} /><Degrau p={p3} lugar={3} /></div>
      {ranking.length > 3 && (
        <ol className="cp-lista" start={4}>
          {ranking.slice(3).map((p) => (
            <li key={p.id} title={detalhe(p)}>
              <span className="cp-lista-pos">{p.posicao}º</span>
              <span className="cp-lista-nome">{p.nome}</span>
              <span className="cp-mini"><span style={{ width: `${Math.min(p.progresso, 1) * 100}%` }} /></span>
              <span className="cp-lista-pct">{fmtPct(p.progresso)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Termometro({ calc, campanha }) {
  const g = Math.min(calc.geral, 1);
  return (
    <div className="cp-termo-area">
      <div className="cp-termo">
        <div className="cp-termo-tubo">
          {[25, 50, 75, 100].map((m) => <span key={m} className="cp-termo-marca" style={{ bottom: `${m}%` }}>{m}%</span>)}
          <div className="cp-termo-fluido" style={{ height: `${g * 100}%` }} />
        </div>
        <div className="cp-termo-bulbo">{fmtPct(calc.geral)}</div>
      </div>
      <div className="cp-termo-lado">
        <h3>{campanha.modo === 'coletiva' ? 'Meta coletiva' : 'Soma de todos os participantes'}</h3>
        {calc.totais.map((t) => (
          <div key={t.item.id} className="cp-total-item">
            <div className="cp-total-cab"><b>{t.item.nome}</b><span>{fmtValor(t.realizado, t.item.unidade)} de {fmtValor(t.alvo, t.item.unidade)}</span></div>
            <div className="cp-barra"><span style={{ width: `${Math.min(t.pct, 1) * 100}%` }} /></div>
          </div>
        ))}
        <h3 style={{ marginTop: 18 }}>Quem mais contribuiu</h3>
        <ol className="cp-lista cp-lista-compacta">
          {calc.ranking.slice(0, 8).map((p) => (
            <li key={p.id} title={detalhe(p)}>
              <span className="cp-lista-pos">{p.posicao}º</span><span className="cp-lista-nome">{p.nome}</span><span className="cp-lista-pct">{fmtPct(p.progresso)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export default function PainelCampanha({ campanha, calc, tema, grande = false }) {
  const hoje = hojeSP();
  const sit = situacaoCampanha(campanha, hoje);
  const dias = Math.round((paraMs(campanha.data_fim) - paraMs(hoje)) / 86400000);
  const festa = calc.completos > 0 || calc.geral >= 1;
  const temaAtual = tema || campanha.tema;
  return (
    <div className={`cp cp-tema-${temaAtual}${grande ? ' cp-grande' : ''}`}>
      {festa && <Confete />}
      <div className="cp-cab">
        <div>
          <h2 className="cp-titulo">{campanha.nome}</h2>
          <p className="cp-sub">
            {fmtData(campanha.data_inicio)} a {fmtData(campanha.data_fim)}
            {', '}{sit.estado === 'andamento' ? (dias === 0 ? 'último dia!' : `faltam ${dias} ${dias === 1 ? 'dia' : 'dias'}`) : sit.texto}
          </p>
        </div>
        {campanha.premio && <div className="cp-premio">🎁 {campanha.premio}</div>}
      </div>
      <div className="cp-chips">
        {calc.totais.map((t) => <span key={t.item.id}>{t.item.nome}: <b>{fmtValor(t.item.alvo, t.item.unidade)}</b>{campanha.modo === 'individual' ? ' cada' : ' no total'}</span>)}
        {calc.completos > 0 && <span className="cp-chip-festa">🏆 {calc.completos} {calc.completos === 1 ? 'já completou' : 'já completaram'}</span>}
      </div>
      {!calc.ranking.length ? (
        <p className="cp-vazio-msg">Inclua participantes para a disputa começar.</p>
      ) : temaAtual === 'foguete' ? <Foguete ranking={calc.ranking} />
        : temaAtual === 'podio' ? <Podio ranking={calc.ranking} />
        : temaAtual === 'termometro' ? <Termometro calc={calc} campanha={campanha} />
        : <Corrida ranking={calc.ranking} />}
    </div>
  );
}
