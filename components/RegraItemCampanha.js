'use client';
// Editor da regra automática de um item de campanha: fontes, condições sobre as colunas da planilha,
// contar pedidos ou somar coluna, prévia do resultado e gravação.
import { useState, useTransition } from 'react';
import { OPERADORES, CAMPO_PRODUTO, operador, textoRegra, regraValida } from '@/lib/campanhaRegras';

const novaCondicao = () => ({ campo: '', op: 'em', valores: [] });
const novaFonte = (fonte_id = '') => ({ fonte_id, condicoes: [novaCondicao()], soma: '' });
const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '');
const num = (n) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

const estilo = {
  painel: { marginTop: 10, padding: 14, border: '1px solid var(--borda, #e3e0ea)', borderRadius: 12, background: 'var(--fundo-suave, #faf9fc)' },
  fonte: { padding: 12, border: '1px solid var(--borda, #e3e0ea)', borderRadius: 10, background: 'var(--fundo, #fff)', marginTop: 10 },
  linhaCond: { display: 'flex', gap: 6, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 8 },
  pilula: (ativa) => ({
    border: `1px solid ${ativa ? 'var(--acento, #6b40e7)' : 'var(--borda, #d8d4e2)'}`, background: ativa ? 'var(--acento, #6b40e7)' : 'transparent',
    color: ativa ? '#fff' : 'inherit', borderRadius: 999, padding: '3px 10px', fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap',
  }),
  chip: { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--acento-suave, #ece6fd)', borderRadius: 999, padding: '2px 4px 2px 10px', fontSize: 12.5 },
  x: { border: 0, background: 'transparent', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 4px', color: 'inherit' },
};

// Escolha de valores: poucas opções viram pílulas clicáveis; muitas viram busca com lista + chips
function Valores({ opcoes, valores, onChange, idLista }) {
  const [busca, setBusca] = useState('');
  const marcado = (v) => valores.some((x) => x.toLowerCase() === v.toLowerCase());
  const alternar = (v) => onChange(marcado(v) ? valores.filter((x) => x.toLowerCase() !== v.toLowerCase()) : [...valores, v]);
  const incluir = () => { const v = busca.trim(); if (v && !marcado(v)) onChange([...valores, v]); setBusca(''); };
  if (opcoes.length && opcoes.length <= 15) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flex: '1 1 260px' }}>
        {opcoes.map((o) => (
          <button key={o.v} type="button" style={estilo.pilula(marcado(o.v))} onClick={() => alternar(o.v)}>
            {o.rotulo || o.v}{o.n ? <span style={{ opacity: 0.7 }}> · {num(o.n)}</span> : null}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div style={{ flex: '1 1 260px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: valores.length ? 6 : 0 }}>
        {valores.map((v) => (
          <span key={v} style={estilo.chip}>{v}<button type="button" style={estilo.x} onClick={() => alternar(v)} aria-label={`Tirar ${v}`}>×</button></span>
        ))}
      </div>
      <input type="text" list={idLista} value={busca} placeholder={opcoes.length ? 'Digite para buscar e tecle Enter' : 'Digite o valor e tecle Enter'}
        onChange={(e) => {
          const v = e.target.value;
          // escolheu direto da lista
          const achou = opcoes.find((o) => o.v === v);
          if (achou) { if (!marcado(achou.v)) onChange([...valores, achou.v]); setBusca(''); } else setBusca(v);
        }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); incluir(); } }}
        style={{ width: '100%', maxWidth: 320 }} />
      {opcoes.length > 0 && (
        <datalist id={idLista}>
          {opcoes.map((o) => <option key={o.v} value={o.v}>{o.n ? `${num(o.n)} linhas` : ''}</option>)}
        </datalist>
      )}
    </div>
  );
}

export default function RegraItemCampanha({ item, fontes, filtro, salvar, carregarCampos, previa }) {
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState(regraValida(item.regra) ? 'auto' : 'mao');
  const [regra, setRegra] = useState(() => (regraValida(item.regra)
    ? { medida: item.regra.medida || 'pedidos', fontes: item.regra.fontes.map((f) => ({ ...f, condicoes: f.condicoes?.length ? f.condicoes : [novaCondicao()], soma: f.soma || '' })) }
    : { medida: 'pedidos', fontes: [novaFonte()] }));
  const [campos, setCampos] = useState({}); // fonte_id -> { campos } | { erro } | 'carregando'
  const [msg, setMsg] = useState(null);
  const [teste, setTeste] = useState(null);
  const [pendente, iniciar] = useTransition();

  const buscarCampos = (fonte_id) => {
    if (!fonte_id || campos[fonte_id]) return;
    setCampos((c) => ({ ...c, [fonte_id]: 'carregando' }));
    carregarCampos(fonte_id).then((r) => setCampos((c) => ({ ...c, [fonte_id]: r?.erro ? { erro: r.erro } : { campos: r.campos } })));
  };
  const abrir = () => { setAberto(true); setMsg(null); setTeste(null); regra.fontes.forEach((f) => buscarCampos(f.fonte_id)); };

  const mudar = (fn) => { setRegra((r) => fn(structuredClone(r))); setTeste(null); setMsg(null); };
  const mudarFonte = (i, fn) => mudar((r) => { fn(r.fontes[i]); return r; });
  const mudarCond = (i, j, fn) => mudarFonte(i, (f) => fn(f.condicoes[j]));

  const limpa = () => ({ medida: regra.medida, fontes: regra.fontes.filter((f) => f.fonte_id) });

  const testar = () => iniciar(async () => {
    setMsg(null);
    const r = await previa(limpa(), filtro);
    if (r?.erro) setMsg({ erro: r.erro }); else setTeste(r);
  });
  const gravar = () => iniciar(async () => {
    const r = await salvar(modo === 'auto' ? limpa() : null);
    setMsg(r?.erro ? { erro: r.erro } : { ok: r?.ok || 'Salvo.' });
    if (!r?.erro) setAberto(false);
  });

  const resumo = regraValida(item.regra) ? textoRegra(item.regra, fontes) : null;
  if (!aberto) {
    return (
      <div style={{ marginTop: 6 }}>
        {resumo
          ? <p className="dica" style={{ margin: 0 }}><span className="tag tag-ok" style={{ marginRight: 6 }}>⚡ Automático</span>{resumo}</p>
          : <p className="dica" style={{ margin: 0 }}><span className="tag" style={{ marginRight: 6 }}>✋ À mão</span>Resultado digitado em "Lançar resultados".</p>}
        <button type="button" className="btn btn-sec btn-peq" style={{ marginTop: 6 }} onClick={abrir}>⚙ {resumo ? 'Editar regra' : 'Usar regra automática'}</button>
        {msg?.ok && <span className="dica" style={{ marginLeft: 8 }}>{msg.ok}</span>}
      </div>
    );
  }

  return (
    <div style={estilo.painel}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <strong style={{ marginRight: 4 }}>Resultado de “{item.nome}”:</strong>
        <button type="button" style={estilo.pilula(modo === 'mao')} onClick={() => { setModo('mao'); setTeste(null); }}>✋ Lançado à mão</button>
        <button type="button" style={estilo.pilula(modo === 'auto')} onClick={() => setModo('auto')}>⚡ Automático pelas planilhas</button>
      </div>

      {modo === 'mao' ? (
        <p className="dica" style={{ marginTop: 10 }}>O resultado é digitado na tabela “Lançar resultados”. {regraValida(item.regra) ? 'Os valores digitados antes da regra voltam a valer.' : ''}</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
            <span className="dica" style={{ margin: 0 }}>Como conta:</span>
            <button type="button" style={estilo.pilula(regra.medida === 'pedidos')} onClick={() => mudar((r) => { r.medida = 'pedidos'; return r; })}>Pedidos (1 por NEO)</button>
            <button type="button" style={estilo.pilula(regra.medida === 'soma')} onClick={() => mudar((r) => { r.medida = 'soma'; return r; })}>Somar uma coluna</button>
            <span className="dica" style={{ margin: 0 }}>· vale a data de entrada do pedido, dentro do período da campanha</span>
          </div>

          {regra.fontes.map((f, i) => {
            const fonte = fontes.find((x) => x.id === f.fonte_id);
            const est = campos[f.fonte_id];
            const lista = est && est.campos ? est.campos : [];
            const opcoesCampo = (campo) => {
              if (campo === CAMPO_PRODUTO) return Object.entries(fonte?.destinos || {}).map(([v, rotulo]) => ({ v, rotulo }));
              return lista.find((c) => c.coluna === campo)?.valores || [];
            };
            return (
              <div key={i} style={estilo.fonte}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label className="campo" style={{ margin: 0 }}>Fonte
                    <select value={f.fonte_id} onChange={(e) => { const id = e.target.value; mudarFonte(i, (x) => { x.fonte_id = id; x.condicoes = [novaCondicao()]; x.soma = ''; }); buscarCampos(id); }}>
                      <option value="">Escolha</option>
                      {fontes.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                    </select>
                  </label>
                  {regra.fontes.length > 1 && (
                    <button type="button" className="lt-apagar" onClick={() => mudar((r) => { r.fontes.splice(i, 1); return r; })}>tirar esta fonte</button>
                  )}
                </div>

                {f.fonte_id && est === 'carregando' && <p className="dica" style={{ marginTop: 8 }}>Carregando as colunas…</p>}
                {f.fonte_id && est?.erro && <p className="dica" style={{ marginTop: 8, color: 'var(--perigo, #c0392b)' }}>{est.erro}</p>}

                {f.fonte_id && est?.campos && (
                  <>
                    <p className="dica" style={{ margin: '10px 0 0' }}>Conta as linhas que atendem a <strong>todas</strong> as condições:</p>
                    {f.condicoes.map((c, j) => {
                      const op = operador(c.op);
                      const info = lista.find((x) => x.coluna === c.campo);
                      return (
                        <div key={j} style={estilo.linhaCond}>
                          <select value={c.campo} aria-label="Coluna" onChange={(e) => { const v = e.target.value; mudarCond(i, j, (x) => { x.campo = v; x.valores = []; }); }} style={{ maxWidth: 230 }}>
                            <option value="">Coluna…</option>
                            <option value={CAMPO_PRODUTO}>★ Produto do sistema</option>
                            {lista.map((x) => <option key={x.coluna} value={x.coluna}>{x.coluna}</option>)}
                          </select>
                          <select value={c.op} aria-label="Condição" onChange={(e) => { const v = e.target.value; mudarCond(i, j, (x) => { x.op = v; if (!operador(v).lista && !operador(v).texto) x.valores = []; }); }}>
                            {OPERADORES.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
                          </select>
                          {c.campo && op?.lista && (
                            <Valores idLista={`vals-${item.id}-${i}-${j}`} opcoes={opcoesCampo(c.campo)} valores={c.valores} onChange={(v) => mudarCond(i, j, (x) => { x.valores = v; })} />
                          )}
                          {c.campo && op?.texto && (
                            <input type="text" value={c.valores[0] || ''} placeholder="texto" onChange={(e) => { const v = e.target.value; mudarCond(i, j, (x) => { x.valores = v ? [v] : []; }); }} style={{ width: 180 }} />
                          )}
                          <button type="button" style={estilo.x} title="Tirar condição" onClick={() => mudarFonte(i, (x) => { x.condicoes.splice(j, 1); if (!x.condicoes.length) x.condicoes.push(novaCondicao()); })}>×</button>
                          {info?.muitos && op?.lista && <span className="dica" style={{ flexBasis: '100%', margin: 0 }}>Coluna com muitos valores diferentes: a lista mostra os mais frequentes, mas dá para digitar qualquer um.</span>}
                        </div>
                      );
                    })}
                    <button type="button" className="btn btn-sec btn-peq" style={{ marginTop: 8 }} onClick={() => mudarFonte(i, (x) => { x.condicoes.push(novaCondicao()); })}>+ Condição</button>

                    {regra.medida === 'soma' && (
                      <label className="campo" style={{ marginTop: 10, maxWidth: 280 }}>Coluna a somar
                        <select value={f.soma || ''} onChange={(e) => { const v = e.target.value; mudarFonte(i, (x) => { x.soma = v; }); }}>
                          <option value="">Escolha</option>
                          {lista.map((x) => <option key={x.coluna} value={x.coluna}>{x.coluna}</option>)}
                        </select>
                      </label>
                    )}
                  </>
                )}
              </div>
            );
          })}
          <button type="button" className="btn btn-sec btn-peq" style={{ marginTop: 10 }} onClick={() => mudar((r) => { r.fontes.push(novaFonte()); return r; })}>+ Somar outra fonte (ex.: Básica + B2C)</button>

          {regraValida(limpa()) && <p className="dica" style={{ marginTop: 12 }}><strong>Resumo:</strong> {textoRegra(limpa(), fontes)}</p>}

          {teste && (
            <div className="bloco" style={{ marginTop: 10 }}>
              <strong>{num(teste.total)} {regra.medida === 'soma' ? 'no total' : 'pedidos'}</strong> de {dataBR(teste.periodo.de)} a {dataBR(teste.periodo.ate)}
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                <li>{num(teste.contado)} de participantes da campanha ({teste.comResultado} de {teste.participantes} com resultado)</li>
                {teste.fora > 0 && <li>{num(teste.fora)} de quem não participa{teste.foraNomes?.length ? `: ${teste.foraNomes.map((x) => `${x.nome} (${num(x.qtd)})`).join(', ')}` : ''}</li>}
                {teste.semVinculo > 0 && <li>{num(teste.semVinculo)} de nomes sem vínculo no sistema (vincule na tela de fontes)</li>}
              </ul>
            </div>
          )}
        </>
      )}

      {msg?.erro && <p className="dica" style={{ marginTop: 10, color: 'var(--perigo, #c0392b)' }}>{msg.erro}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        {modo === 'auto' && <button type="button" className="btn btn-sec" disabled={pendente || !regraValida(limpa())} onClick={testar}>{pendente ? 'Calculando…' : '🔎 Testar regra'}</button>}
        <button type="button" className="btn" disabled={pendente} onClick={gravar}>Salvar</button>
        <button type="button" className="btn btn-sec" disabled={pendente} onClick={() => setAberto(false)}>Cancelar</button>
      </div>
    </div>
  );
}
