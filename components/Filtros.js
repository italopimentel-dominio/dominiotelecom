import Link from 'next/link';

// Peças dos filtros compactos (Ativação, Treinamentos, Acompanhamento).

// Lê um parâmetro de lista ("a,b") da URL
export const lista = (v) => String(v || '').split(',').filter(Boolean);

// Monta a URL trocando/limpando parâmetros (vazio = remove); sempre volta para a página 1
export function urlCom(base, atuais, extra) {
  const tudo = { ...atuais, ...extra };
  const q = new URLSearchParams(Object.entries(tudo).filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : v]));
  q.delete('pag');
  const t = q.toString();
  return t ? `${base}?${t}` : base;
}

// Pílulas dos pontos focais numa linha: itens [{ id: ''|'sem'|uuid, nome, n }]
export function PilulasFocais({ itens, selecionado, hrefDe }) {
  return (
    <div className="pilulas-focais" role="group" aria-label="Ponto focal">
      <span className="rot">Ponto focal</span>
      {itens.map((x) => {
        const sel = (selecionado || '') === x.id;
        return (
          <Link key={x.id || 'todos'} href={hrefDe(sel && x.id ? '' : x.id)} scroll={false} className={`pilula${sel ? ' sel' : ''}`} aria-current={sel ? 'true' : undefined}>
            {x.nome} <span className="cont">{x.n}</span>
          </Link>
        );
      })}
    </div>
  );
}

// Faixa "102 → 14 parceiros com: [filtro ×] … Limpar tudo"
export function FaixaAtivos({ total, filtrados, ativos, limparHref, nome = 'parceiros' }) {
  if (!ativos.length) return <p className="faixa-ativos dica">{total} {nome}. Use os filtros acima para recortar.</p>;
  return (
    <div className="faixa-ativos">
      <span className="dica">{total} → <b style={{ color: 'var(--tinta)' }}>{filtrados} {nome}</b> com:</span>
      {ativos.map((a) => (
        <Link key={a.chave} href={a.href} scroll={false} className="tag-filtro" aria-label={`Tirar filtro: ${a.t}`}>{a.t} <span aria-hidden="true">×</span></Link>
      ))}
      <Link href={limparHref} scroll={false} className="link-acao">Limpar tudo</Link>
    </div>
  );
}
