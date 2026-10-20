import Link from 'next/link';
import InfoBalao from './InfoBalao';

// Placar "quem treinou": um cartão por ponto focal com ONB e treinamentos (Telecom + Serviços) feitos no período
// e quantos já têm o formulário respondido. Clicar no nome filtra tudo o que a pessoa fez;
// clicar em ONB ou Treinamentos filtra só aquele grupo (clicar de novo desliga).
// itens: [{ id, nome, onb: { n, f }, trn: { n, f }, telecom: { n, f }, servicos: { n, f } }]
const cor = ({ n, f }) => (!n ? 'var(--texto-fraco, #8f88a8)' : f === n ? 'var(--ok)' : f === 0 ? 'var(--risco)' : 'var(--atencao)');

function Linha({ href, ativo, rotulo, v, titulo, info }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    <Link href={href} aria-current={ativo ? 'true' : undefined} title={titulo}
      style={{ flex: 1, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, padding: '3px 6px', borderRadius: 6, textDecoration: 'none', color: 'inherit', background: ativo ? 'var(--fundo-sel, rgba(110, 80, 200, .12))' : 'transparent' }}>
      <span><b style={{ fontSize: '1.15em' }}>{v.n}</b> {rotulo}</span>
      <span style={{ color: cor(v), fontWeight: 600, whiteSpace: 'nowrap' }} aria-label={`${v.f} de ${v.n} formulários respondidos`}>
        {v.n ? `${v.f}/${v.n} form.` : '—'}
      </span>
    </Link>
    {info}
    </span>
  );
}

export default function PlacarFocais({ itens, titulo, sel, selFt, hrefDe }) {
  if (!itens.length) return <p className="dica" style={{ margin: '10px 0' }}>Nenhum treinamento realizado neste período.</p>;
  return (
    <section style={{ margin: '12px 0' }} aria-labelledby="placar-focais">
      <h2 id="placar-focais" style={{ marginBottom: 2, fontSize: '1rem' }}>{titulo}</h2>
      <p className="dica" style={{ marginBottom: 8 }}>
        Conta quem fez o treinamento (em conjunto conta para os dois). “form.” = formulários respondidos. Clique para filtrar a lista.
      </p>
      <nav className="equipes-assid" aria-label="Treinamentos por ponto focal">
        {itens.map((x) => {
          const ativo = sel === x.id;
          return (
            <div key={x.id} className={`cartao-equipe${ativo ? ' sel' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Link href={hrefDe(ativo && !selFt ? '' : x.id, '')} className="linha1" aria-current={ativo && !selFt ? 'true' : undefined}
                style={{ textDecoration: 'none', color: 'inherit', marginBottom: 2 }}>
                <span className="nome">{x.nome}</span>
                <span className="dica">{x.onb.n + x.trn.n} no total</span>
              </Link>
              <Linha href={hrefDe(ativo && selFt === 'onb' ? '' : x.id, ativo && selFt === 'onb' ? '' : 'onb')} ativo={ativo && selFt === 'onb'}
                rotulo={x.onb.n === 1 ? 'ONB' : 'ONBs'} v={x.onb} titulo="Filtrar os onboardings feitos por esta pessoa" />
              <Linha href={hrefDe(ativo && selFt === 'trn' ? '' : x.id, ativo && selFt === 'trn' ? '' : 'trn')} ativo={ativo && selFt === 'trn'}
                rotulo={x.trn.n === 1 ? 'treinamento' : 'treinamentos'} v={x.trn} titulo="Filtrar os treinamentos (Telecom e Serviços) feitos por esta pessoa"
                info={x.trn.n > 0 && (
                  <InfoBalao titulo="Treinamentos por tipo" rotulo={`Treinamentos de ${x.nome} por tipo`}>
                    {[['Telecom', x.telecom], ['Serviços', x.servicos]].map(([r, v]) => (
                      <span key={r} style={{ display: 'block' }}>{v.n} {r}{v.n > 0 ? ` · ${v.f}/${v.n} formulários` : ''}</span>
                    ))}
                  </InfoBalao>
                )} />
            </div>
          );
        })}
      </nav>
    </section>
  );
}
