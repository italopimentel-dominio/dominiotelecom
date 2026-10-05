import { fmtValor } from '@/lib/formato';

const CORES = ['#6b40e7', '#e0457b', '#1b7446', '#d97706', '#2563a8', '#0f766e', '#8a3fb3', '#c2410c'];

// Mostra do que é feito o resultado de um produto "soma".
// compacta: só o texto ("10 Alta Fibra, 40 Reno Móvel"); completa: barra empilhada + legenda.
export default function Composicao({ itens, compacta = false }) {
  const lista = itens.map((x, i) => ({ ...x, cor: CORES[i % CORES.length], conta: x.valor * x.peso }));
  const comValor = lista.filter((x) => x.valor > 0).sort((a, b) => b.conta - a.conta);
  const total = lista.reduce((s, x) => s + x.conta, 0);
  const rotulo = (x) => `${fmtValor(x.valor, x.produto.unidade, 1)} ${x.produto.nome}${x.peso !== 1 ? ` (x${String(x.peso).replace('.', ',')})` : ''}`;
  if (compacta) {
    return <span className="nome-sub comp-texto">{comValor.length ? comValor.map(rotulo).join(', ') : 'nada lançado ainda'}</span>;
  }
  return (
    <div className="comp">
      <div className="comp-barra" role="img" aria-label={comValor.map(rotulo).join(', ')}>
        {total > 0 ? comValor.map((x) => (
          <span key={x.produto.id} style={{ width: `${(x.conta / total) * 100}%`, background: x.cor }} title={`${rotulo(x)}: ${Math.round((x.conta / total) * 100)}%`} />
        )) : <span style={{ width: '100%', background: '#ebe9f1' }} />}
      </div>
      <ul className="comp-legenda">
        {lista.map((x) => (
          <li key={x.produto.id} className={x.valor > 0 ? '' : 'comp-zero'}>
            <i style={{ background: x.cor }} />
            <b>{fmtValor(x.valor, x.produto.unidade, 1)}</b> {x.produto.nome}
            {x.peso !== 1 && <span className="dica"> vale x{String(x.peso).replace('.', ',')}</span>}
            {total > 0 && x.valor > 0 && <span className="dica"> ({Math.round((x.conta / total) * 100)}%)</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
