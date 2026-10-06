'use client';
import { useMemo, useState, useTransition } from 'react';
import { normalizar, capitalizar } from '@/lib/nomes';
import { fmtValor } from '@/lib/formato';

const SITUACAO = {
  encontrado: { rotulo: 'Encontrado', classe: 'tag-ok' },
  parecido: { rotulo: 'Nome parecido, confira', classe: 'tag-atencao' },
  ambiguo: { rotulo: 'Mais de um com esse nome', classe: 'tag-atencao' },
  novo: { rotulo: 'Não cadastrado', classe: 'tag-risco' },
  equipe: { rotulo: 'Entra direto na equipe', classe: 'tag-acento' },
};
const nomeMes = (m) => { const [a, n] = m.split('-'); return `${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(n) - 1]}/${a}`; };

export default function FonteDados({ fonte, lerFonte, aplicarFonte }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [decisoes, setDecisoes] = useState({});
  const [marcados, setMarcados] = useState({});
  const [resultado, setResultado] = useState(null);
  const [lote, setLote] = useState('');
  const [lendo, iniciarLeitura] = useTransition();
  const [gravando, iniciarGravacao] = useTransition();

  function ler() {
    setErro(''); setResultado(null);
    iniciarLeitura(async () => {
      const r = await lerFonte(fonte.id);
      if (r?.erro) { setErro(r.erro); setDados(null); return; }
      setDados(r);
      setDecisoes({});
      setMarcados(Object.fromEntries(r.meses.map((m) => [m.mes, !!m.periodo && !m.periodo.fechado])));
    });
  }

  const colabPorId = useMemo(() => new Map((dados?.colaboradores || []).map((c) => [c.id, c])), [dados]);
  const grupoPorId = useMemo(() => new Map((dados?.grupos || []).map((g) => [g.id, g])), [dados]);
  const primeiroMes = (p) => { const ms = Object.keys(p.meses).sort(); return ms.length ? `${ms[0]}-01` : ''; };
  // decisão de cada nome: colab (é alguém do cadastro), novo (cadastrar agora), grupo (direto na equipe), ignorar
  const decisao = (p) => {
    if (decisoes[p.chave]) return decisoes[p.chave];
    if (p.situacao === 'equipe') return { tipo: 'grupo', grupo_id: p.grupoDireto };
    if (p.situacao === 'novo') return { tipo: '', grupo_id: p.grupoSugerido || '' };
    return { tipo: 'colab', colaborador_id: p.sugerido || '' };
  };
  const mudar = (p, novo) => setDecisoes((x) => ({ ...x, [p.chave]: novo }));
  const destinos = dados ? Object.entries(dados.destinos) : [];
  const mesesGravar = dados ? dados.meses.filter((m) => marcados[m.mes] && m.periodo && !m.periodo.fechado) : [];

  function aplicarLote(tipo) {
    setDecisoes((x) => {
      const n = { ...x };
      dados.pessoas.filter((p) => p.situacao === 'novo').forEach((p) => {
        n[p.chave] = tipo === 'ignorar' ? { tipo: 'ignorar' }
          : tipo === 'grupo' ? { tipo: 'grupo', grupo_id: lote }
          : { tipo: 'novo', nome: capitalizar(p.nome), grupo_id: lote, data_admissao: primeiroMes(p) };
      });
      return n;
    });
  }

  const calc = useMemo(() => {
    if (!dados) return null;
    const escopo = [];
    destinos.forEach(([, d]) => { if (d.produto) { if (d.produto.qtd) escopo.push({ produto_id: d.produto.id, medida: 'qtd' }); if (d.produto.brl) escopo.push({ produto_id: d.produto.id, medida: 'brl' }); } });
    const valores = [], apelidos = [], novos = [], equipes = [];
    const novosMap = new Map(); // chave da comparação -> valor
    dados.pessoas.forEach((p) => {
      const dc = decisao(p);
      let alvo = null, ref = null;
      if (dc.tipo === 'colab' && dc.colaborador_id) {
        alvo = { tipo: 'colab', id: dc.colaborador_id }; ref = `c|${dc.colaborador_id}`;
        const c = colabPorId.get(dc.colaborador_id);
        if (c && normalizar(c.nome) !== p.chave) apelidos.push({ apelido: p.nome, colaborador_id: c.id });
      } else if (dc.tipo === 'novo' && dc.grupo_id) {
        alvo = { tipo: 'novo', chave: p.chave }; ref = `n|${p.chave}`;
        novos.push({ chave: p.chave, nome: dc.nome || capitalizar(p.nome), grupo_id: dc.grupo_id, data_admissao: dc.data_admissao || primeiroMes(p) });
      } else if (dc.tipo === 'grupo' && dc.grupo_id) {
        alvo = { tipo: 'grupo', id: dc.grupo_id }; ref = `g|${dc.grupo_id}`;
        equipes.push({ apelido: p.nome, grupo_id: dc.grupo_id });
      }
      if (!alvo) return;
      mesesGravar.forEach((m) => {
        const doMes = p.meses[m.mes] || {};
        destinos.forEach(([k, d]) => {
          if (!d.produto || !doMes[k]) return;
          const add = (medida, v) => {
            valores.push({ periodo_id: m.periodo.id, alvo, produto_id: d.produto.id, medida, valor: v });
            const ch = `${m.periodo.id}|${ref}|${d.produto.id}|${medida}`;
            novosMap.set(ch, (novosMap.get(ch) || 0) + v);
          };
          if (d.produto.qtd) add('qtd', doMes[k].qtd);
          if (d.produto.brl) add('brl', doMes[k].valor);
        });
      });
    });
    const perIds = new Set(mesesGravar.map((m) => m.periodo.id));
    const naEscopo = (a) => perIds.has(a.periodo_id) && escopo.some((e) => e.produto_id === a.produto_id && e.medida === a.medida);
    const gruposFonte = new Set([...(dados.gruposDiretos || []), ...equipes.map((e) => e.grupo_id)]);
    const atuais = new Map([
      ...dados.atuais.filter(naEscopo).map((a) => [`${a.periodo_id}|c|${a.colaborador_id}|${a.produto_id}|${a.medida}`, Number(a.valor)]),
      ...(dados.atuaisGrupo || []).filter((a) => naEscopo(a) && gruposFonte.has(a.grupo_id)).map((a) => [`${a.periodo_id}|g|${a.grupo_id}|${a.produto_id}|${a.medida}`, Number(a.valor)]),
    ]);
    const mudancas = [];
    let iguais = 0;
    new Set([...novosMap.keys(), ...atuais.keys()]).forEach((ch) => {
      const n = Math.round((novosMap.get(ch) || 0) * 100) / 100;
      const a = atuais.has(ch) ? atuais.get(ch) : null;
      if (a !== null && Math.abs(a - n) < 0.005) { iguais++; return; }
      if (a === null && n === 0) return;
      const [pid, tipo, id, prod, medida] = ch.split('|');
      mudancas.push({ pid, tipo, id, prod, medida, antes: a, depois: n });
    });
    return { escopo, valores, apelidos, novos, equipes, mudancas, iguais };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados, decisoes, marcados]);

  const pendentes = dados ? dados.pessoas.filter((p) => {
    const d = decisao(p);
    if (d.tipo === 'ignorar') return false;
    if (d.tipo === 'colab') return !d.colaborador_id;
    if (d.tipo === 'novo' || d.tipo === 'grupo') return !d.grupo_id;
    return true;
  }).length : 0;
  const nomeProd = (id) => destinos.find(([, d]) => d.produto?.id === id)?.[1].produto.nome || '';
  const nomePer = (id) => dados?.meses.find((m) => m.periodo?.id === id)?.periodo.nome || '';
  const nomeAlvo = (m) => (m.tipo === 'c' ? capitalizar(colabPorId.get(m.id)?.nome || '—') : m.tipo === 'g' ? `Equipe ${grupoPorId.get(m.id)?.nome.split(' / ').pop() || ''}` : `${capitalizar(dados.pessoas.find((p) => p.chave === m.id)?.nome || '')} (novo)`);

  function gravar() {
    if (!calc) return;
    const zerados = calc.mudancas.filter((m) => m.depois === 0).length;
    if (!window.confirm(`Gravar ${mesesGravar.map((m) => m.periodo.nome).join(', ')}? ${calc.mudancas.length} valores vão mudar${zerados ? ` (${zerados} ficam zerados)` : ''}${calc.novos.length ? ` e ${calc.novos.length} pessoas serão cadastradas` : ''}. Dá para desfazer os resultados depois.`)) return;
    iniciarGravacao(async () => {
      const r = await aplicarFonte({
        fonte_id: fonte.id, url: fonte.url,
        periodos: mesesGravar.map((m) => m.periodo.id),
        valores: calc.valores, escopo: calc.escopo, apelidos: calc.apelidos, novos: calc.novos, equipes: calc.equipes,
        // vendas por nome, para vincular a primeira venda dos parceiros do Indireto
        vendasParceiros: dados.pessoas.flatMap((p) => mesesGravar.flatMap((m) => destinos
          .filter(([k, d]) => d.produto && p.meses[m.mes]?.[k]?.qtd > 0)
          .map(([k, d]) => ({ nome: p.nome, mes: m.mes, produto: d.produto.nome, qtd: p.meses[m.mes][k].qtd, valor: p.meses[m.mes][k].valor })))),
        gruposDiretos: dados.gruposDiretos || [],
        resumo: { mudancas: calc.mudancas.length, iguais: calc.iguais, contagem: dados.contagem },
      });
      setResultado(r);
      if (r?.ok) setDados(null);
    });
  }

  const paraConferir = dados ? dados.pessoas.filter((p) => p.situacao !== 'encontrado') : [];

  return (
    <div className="fonte-previa">
      <div className="linha-acoes">
        <button type="button" className="btn" onClick={ler} disabled={lendo}>{lendo ? 'Lendo a planilha…' : 'Ler planilha agora (prévia)'}</button>
        <span className="dica">Ler não grava nada. Você confere tudo antes.</span>
      </div>
      {erro && <p className="msg msg-erro">{erro}</p>}
      {resultado?.ok && <p className="filtro-ativo" style={{ marginTop: 10 }}>{resultado.ok}</p>}
      {resultado?.erro && <p className="msg msg-erro">{resultado.erro}</p>}

      {dados && (
        <>
          <p className="dica" style={{ marginTop: 12 }}>
            Lido agora: {dados.contagem.total} linhas na planilha, <b>{dados.contagem.contadas} contadas</b> ({dados.statusConta || 'EXECUTADO'}),
            {' '}{dados.contagem.naoExecutadas} com outro status{dados.contagem.tipoFora ? `, ${dados.contagem.tipoFora} com tipo de produto fora da regra` : ''} e {dados.contagem.naoContabiliza} "não contabiliza" ficaram de fora.
          </p>
          {dados.contagem.classes && Object.keys(dados.contagem.classes).length > 0 && (
            <p className="dica" style={{ marginTop: 4 }}>
              Classes encontradas (no status que conta):{' '}
              {Object.entries(dados.contagem.classes).sort((a, b) => b[1].linhas - a[1].linhas).map(([c, info], i) => (
                <span key={c}>
                  {i > 0 && ' · '}
                  {c} ({info.linhas}) → {info.destinos.length
                    ? info.destinos.map((d) => dados.destinos[d]?.produto?.nome || dados.destinos[d]?.rotulo || d).join(', ')
                    : <b style={{ color: 'var(--risco)' }}>não conta</b>}
                </span>
              ))}
            </p>
          )}
          {destinos.some(([, d]) => !d.produto) && <p className="msg msg-erro">Escolha o produto do sistema de cada resultado (em "Configurar a fonte") antes de gravar.</p>}
          {destinos.filter(([, d]) => d.produto && !d.produto.brl).map(([k, d]) => <p key={k} className="dica">{d.produto.nome} está só em quantidade no cadastro: a receita da planilha será ignorada. Para guardar a receita, marque o produto como "Quantidade e receita".</p>)}

          <h3 style={{ margin: '16px 0 8px' }}>Meses encontrados</h3>
          <div className="tabela-wrap">
            <table>
              <thead><tr><th>Gravar</th><th className="esq">Mês</th>{destinos.map(([k, d]) => <th key={k}>{d.produto?.nome || d.rotulo}</th>)}</tr></thead>
              <tbody>
                {dados.meses.map((m) => {
                  const tot = (k) => dados.pessoas.reduce((s, p) => { const x = p.meses[m.mes]?.[k]; return x ? { q: s.q + x.qtd, v: s.v + x.valor } : s; }, { q: 0, v: 0 });
                  return (
                    <tr key={m.mes} className={m.periodo && !m.periodo.fechado ? '' : 'inativo'}>
                      <td><input type="checkbox" disabled={!m.periodo || m.periodo.fechado} checked={!!marcados[m.mes] && !!m.periodo && !m.periodo.fechado} onChange={(e) => setMarcados((x) => ({ ...x, [m.mes]: e.target.checked }))} aria-label={`Gravar ${nomeMes(m.mes)}`} /></td>
                      <td className="esq">{m.periodo ? m.periodo.nome : nomeMes(m.mes)}<span className="nome-sub">{!m.periodo ? 'mês não existe no sistema' : m.periodo.fechado ? 'mês fechado, não será alterado' : ''}</span></td>
                      {destinos.map(([k]) => { const t = tot(k); return <td key={k}>{fmtValor(t.q, 'qtd')}<span className="nome-sub">{fmtValor(t.v, 'brl', 2)}</span></td>; })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {paraConferir.length > 0 && (
            <>
              <h3 style={{ margin: '16px 0 8px' }}>Nomes para conferir</h3>
              {dados.pessoas.some((p) => p.situacao === 'novo') && (
                <div className="bloco campos" style={{ marginBottom: 10 }}>
                  <label className="campo">Todos os não cadastrados
                    <select value={lote} onChange={(e) => setLote(e.target.value)}>
                      <option value="">Escolha a equipe</option>
                      {dados.grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                    </select>
                  </label>
                  <button type="button" className="btn btn-sec" disabled={!lote} onClick={() => aplicarLote('novo')}>Cadastrar todos nessa equipe</button>
                  <button type="button" className="btn btn-sec" disabled={!lote} onClick={() => aplicarLote('grupo')}>Lançar todos direto nessa equipe</button>
                  <button type="button" className="btn btn-sec" onClick={() => aplicarLote('ignorar')}>Ignorar todos</button>
                </div>
              )}
              <div className="tabela-wrap">
                <table>
                  <thead><tr><th>Nome na planilha</th><th className="esq">Situação</th><th className="esq">O que fazer</th></tr></thead>
                  <tbody>
                    {paraConferir.map((p) => {
                      const d = decisao(p);
                      return (
                        <tr key={p.chave} className={d.tipo === 'ignorar' ? 'inativo' : ''}>
                          <td>{p.nome}<span className="nome-sub">{p.equipe}</span></td>
                          <td className="esq"><span className={`tag ${SITUACAO[p.situacao]?.classe || ''}`}>{SITUACAO[p.situacao]?.rotulo}</span></td>
                          <td className="esq">
                            <div className="campos" style={{ flexWrap: 'wrap' }}>
                              <select value={d.tipo} onChange={(e) => {
                                const t = e.target.value;
                                mudar(p, t === 'colab' ? { tipo: 'colab', colaborador_id: p.sugerido || '' }
                                  : t === 'novo' ? { tipo: 'novo', nome: capitalizar(p.nome), grupo_id: d.grupo_id || p.grupoSugerido || '', data_admissao: primeiroMes(p) }
                                  : t === 'grupo' ? { tipo: 'grupo', grupo_id: d.grupo_id || p.grupoSugerido || '' }
                                  : { tipo: t });
                              }} aria-label={`O que fazer com ${p.nome}`}>
                                <option value="" disabled>Escolha</option>
                                <option value="colab">É alguém do cadastro</option>
                                <option value="novo">Cadastrar agora numa equipe</option>
                                <option value="grupo">Lançar direto numa equipe (sem cadastrar)</option>
                                <option value="ignorar">Ignorar</option>
                              </select>
                              {d.tipo === 'colab' && (
                                <select value={d.colaborador_id || ''} onChange={(e) => mudar(p, { ...d, colaborador_id: e.target.value })} aria-label="Colaborador" style={{ maxWidth: 280 }}>
                                  <option value="">Escolha o colaborador</option>
                                  {dados.colaboradores.map((c) => <option key={c.id} value={c.id}>{capitalizar(c.nome)}{c.ativo ? '' : ' (desligado)'}</option>)}
                                </select>
                              )}
                              {(d.tipo === 'novo' || d.tipo === 'grupo') && (
                                <select value={d.grupo_id || ''} onChange={(e) => mudar(p, { ...d, grupo_id: e.target.value })} aria-label="Equipe" style={{ maxWidth: 280 }}>
                                  <option value="">Escolha a equipe</option>
                                  {dados.grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                                </select>
                              )}
                              {d.tipo === 'novo' && (
                                <label className="dica" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>admissão
                                  <input type="date" value={d.data_admissao || ''} onChange={(e) => mudar(p, { ...d, data_admissao: e.target.value })} aria-label="Data de admissão" />
                                </label>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="dica" style={{ marginTop: 6 }}>
                <b>Cadastrar agora</b> cria a pessoa na equipe (aparece no painel, nas metas e no organograma). <b>Lançar direto na equipe</b> soma o resultado só na equipe, sem criar a pessoa (bom para o Indireto); o sistema lembra disso nas próximas leituras.
              </p>
            </>
          )}

          {(dados.pendencias.semValor.length > 0 || dados.pendencias.semMes.length > 0 || dados.pendencias.mesInvalido.length > 0) && (
            <details className="recolhivel" style={{ marginTop: 14 }}>
              <summary>Pendências na planilha ({dados.pendencias.semValor.length + dados.pendencias.semMes.length + dados.pendencias.mesInvalido.length})</summary>
              <div className="bloco" style={{ marginTop: 6 }}>
                {dados.pendencias.semValor.length > 0 && <p><b>{dados.pendencias.semValor.length} linhas executadas sem valor</b> (a quantidade conta; a receita fica zerada até preencherem):</p>}
                <ul className="pend-lista">{dados.pendencias.semValor.map((x, i) => <li key={i}>{capitalizar(x.consultor)}, NEO {x.neo}, {x.classe || 'aparelho'}, {nomeMes(x.mes)}</li>)}</ul>
                {dados.pendencias.semMes.length > 0 && <p style={{ marginTop: 8 }}><b>{dados.pendencias.semMes.length} executadas sem mês</b> (não entram até preencherem o mês):</p>}
                <ul className="pend-lista">{dados.pendencias.semMes.map((x, i) => <li key={i}>{capitalizar(x.consultor)}, NEO {x.neo}, {x.classe}</li>)}</ul>
                {dados.pendencias.mesInvalido.map((x, i) => <p key={i} className="dica">Mês não reconhecido: "{x.mes}" ({capitalizar(x.consultor)}, NEO {x.neo})</p>)}
              </div>
            </details>
          )}

          {calc && mesesGravar.length > 0 && (
            <>
              <h3 style={{ margin: '16px 0 8px' }}>O que vai mudar no sistema</h3>
              <p className="dica" style={{ marginBottom: 8 }}>
                {calc.mudancas.length} valores mudam, {calc.iguais} ficam iguais{calc.novos.length ? `, ${calc.novos.length} pessoas serão cadastradas` : ''}. Nos meses marcados, {destinos.filter(([, d]) => d.produto).map(([, d]) => d.produto.nome).join(', ')} passam a ser exatamente o que está na planilha: quem tinha resultado lançado e não aparece nela fica zerado.
              </p>
              {calc.mudancas.length > 0 && (
                <div className="tabela-wrap" style={{ maxHeight: 360 }}>
                  <table>
                    <thead><tr><th>Quem</th><th className="esq">Mês</th><th className="esq">Produto</th><th>Antes</th><th>Depois</th></tr></thead>
                    <tbody>
                      {calc.mudancas.slice(0, 300).map((m, i) => (
                        <tr key={i}>
                          <td>{nomeAlvo(m)}</td>
                          <td className="esq">{nomePer(m.pid)}</td>
                          <td className="esq">{nomeProd(m.prod)} ({m.medida === 'brl' ? 'R$' : 'qtd'})</td>
                          <td className="fraco">{m.antes === null ? '—' : fmtValor(m.antes, m.medida, 2)}</td>
                          <td className={m.depois === 0 ? 'txt-risco' : 'txt-ok'}>{fmtValor(m.depois, m.medida, 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <div className="bloco" style={{ marginTop: 14 }}>
            {pendentes > 0 && <p className="msg msg-erro">Falta decidir {pendentes} nomes em "Nomes para conferir".</p>}
            <button type="button" className="btn" disabled={gravando || pendentes > 0 || !mesesGravar.length || destinos.some(([, d]) => !d.produto)} onClick={gravar}>
              {gravando ? 'Gravando…' : `Gravar no sistema (${mesesGravar.map((m) => m.periodo.nome).join(', ') || 'nenhum mês marcado'})`}
            </button>
            <p className="dica" style={{ marginTop: 6 }}>Antes de gravar, o sistema guarda os valores atuais. Cada gravação aparece no registro abaixo com o botão Desfazer.</p>
          </div>
        </>
      )}
    </div>
  );
}
