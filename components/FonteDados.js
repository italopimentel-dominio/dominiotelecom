'use client';
import { useMemo, useState, useTransition } from 'react';
import { normalizar, capitalizar } from '@/lib/nomes';
import { fmtValor } from '@/lib/formato';

const SITUACAO = {
  encontrado: { rotulo: 'Encontrado', classe: 'tag-ok' },
  parecido: { rotulo: 'Nome parecido, confira', classe: 'tag-atencao' },
  ambiguo: { rotulo: 'Mais de um com esse nome', classe: 'tag-atencao' },
  novo: { rotulo: 'Não cadastrado', classe: 'tag-risco' },
};
const nomeMes = (m) => { const [a, n] = m.split('-'); return `${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(n) - 1]}/${a}`; };

export default function FonteDados({ fonte, lerFonte, aplicarFonte }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [decisoes, setDecisoes] = useState({});
  const [marcados, setMarcados] = useState({});
  const [resultado, setResultado] = useState(null);
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
  const decisao = (p) => decisoes[p.chave] || { colaborador_id: p.situacao === 'novo' ? '' : p.sugerido || '', ignorar: false };
  const destinos = dados ? Object.entries(dados.destinos) : [];
  const mesesGravar = dados ? dados.meses.filter((m) => marcados[m.mes] && m.periodo && !m.periodo.fechado) : [];

  // valores que serão gravados e comparação com o que existe
  const calc = useMemo(() => {
    if (!dados) return null;
    const escopo = [];
    destinos.forEach(([, d]) => { if (d.produto) { if (d.produto.qtd) escopo.push({ produto_id: d.produto.id, medida: 'qtd' }); if (d.produto.brl) escopo.push({ produto_id: d.produto.id, medida: 'brl' }); } });
    const novos = new Map();
    const apelidos = [];
    dados.pessoas.forEach((p) => {
      const dc = decisao(p);
      if (dc.ignorar || !dc.colaborador_id) return;
      const c = colabPorId.get(dc.colaborador_id);
      if (c && normalizar(c.nome) !== p.chave) apelidos.push({ apelido: p.nome, colaborador_id: c.id });
      mesesGravar.forEach((m) => {
        const doMes = p.meses[m.mes] || {};
        destinos.forEach(([k, d]) => {
          if (!d.produto || !doMes[k]) return;
          const add = (medida, v) => { const ch = `${m.periodo.id}|${dc.colaborador_id}|${d.produto.id}|${medida}`; novos.set(ch, (novos.get(ch) || 0) + v); };
          if (d.produto.qtd) add('qtd', doMes[k].qtd);
          if (d.produto.brl) add('brl', doMes[k].valor);
        });
      });
    });
    const perIds = new Set(mesesGravar.map((m) => m.periodo.id));
    const atuais = new Map(dados.atuais.filter((a) => perIds.has(a.periodo_id) && escopo.some((e) => e.produto_id === a.produto_id && e.medida === a.medida))
      .map((a) => [`${a.periodo_id}|${a.colaborador_id}|${a.produto_id}|${a.medida}`, Number(a.valor)]));
    const mudancas = [];
    let iguais = 0;
    new Set([...novos.keys(), ...atuais.keys()]).forEach((ch) => {
      const n = Math.round((novos.get(ch) || 0) * 100) / 100;
      const a = atuais.has(ch) ? atuais.get(ch) : null;
      if (a !== null && Math.abs(a - n) < 0.005) { iguais++; return; }
      if (a === null && n === 0) return;
      const [pid, cid, prod, medida] = ch.split('|');
      mudancas.push({ pid, cid, prod, medida, antes: a, depois: n });
    });
    const valores = [...novos.entries()].map(([ch, valor]) => { const [periodo_id, colaborador_id, produto_id, medida] = ch.split('|'); return { periodo_id, colaborador_id, produto_id, medida, valor }; });
    return { escopo, valores, apelidos, mudancas, iguais };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados, decisoes, marcados]);

  const pendentes = dados ? dados.pessoas.filter((p) => { const d = decisao(p); return !d.ignorar && !d.colaborador_id; }).length : 0;
  const nomeProd = (id) => destinos.find(([, d]) => d.produto?.id === id)?.[1].produto.nome || '';
  const nomePer = (id) => dados?.meses.find((m) => m.periodo?.id === id)?.periodo.nome || '';

  function gravar() {
    if (!calc) return;
    const zerados = calc.mudancas.filter((m) => m.depois === 0).length;
    if (!window.confirm(`Gravar ${mesesGravar.map((m) => m.periodo.nome).join(', ')}? ${calc.mudancas.length} valores vão mudar${zerados ? ` (${zerados} ficam zerados)` : ''}. Dá para desfazer depois.`)) return;
    iniciarGravacao(async () => {
      const r = await aplicarFonte({
        fonte_id: fonte.id, url: fonte.url,
        periodos: mesesGravar.map((m) => m.periodo.id),
        valores: calc.valores, escopo: calc.escopo, apelidos: calc.apelidos,
        resumo: { mudancas: calc.mudancas.length, iguais: calc.iguais, contagem: dados.contagem },
      });
      setResultado(r);
      if (r?.ok) setDados(null);
    });
  }

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
            Lido agora: {dados.contagem.total} linhas na planilha, <b>{dados.contagem.contadas} contadas</b> (EXECUTADO),
            {' '}{dados.contagem.naoExecutadas} ainda não executadas e {dados.contagem.naoContabiliza} "não contabiliza" ficaram de fora.
          </p>

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

          {dados.pessoas.some((p) => p.situacao !== 'encontrado') && (
            <>
              <h3 style={{ margin: '16px 0 8px' }}>Nomes para conferir</h3>
              <div className="tabela-wrap">
                <table>
                  <thead><tr><th>Nome na planilha</th><th className="esq">Situação</th><th className="esq">É quem no sistema</th></tr></thead>
                  <tbody>
                    {dados.pessoas.filter((p) => p.situacao !== 'encontrado').map((p) => {
                      const d = decisao(p);
                      return (
                        <tr key={p.chave} className={d.ignorar ? 'inativo' : ''}>
                          <td>{p.nome}<span className="nome-sub">{p.equipe}</span></td>
                          <td className="esq"><span className={`tag ${SITUACAO[p.situacao].classe}`}>{SITUACAO[p.situacao].rotulo}</span></td>
                          <td className="esq">
                            <div className="campos" style={{ flexWrap: 'nowrap' }}>
                              <select value={d.ignorar ? '__ignorar' : d.colaborador_id} onChange={(e) => setDecisoes((x) => ({ ...x, [p.chave]: e.target.value === '__ignorar' ? { ignorar: true, colaborador_id: '' } : { ignorar: false, colaborador_id: e.target.value } }))} aria-label={`Quem é ${p.nome}`} style={{ maxWidth: 320 }}>
                                <option value="">Escolha o colaborador</option>
                                <option value="__ignorar">Ignorar (não gravar)</option>
                                {dados.colaboradores.map((c) => <option key={c.id} value={c.id}>{capitalizar(c.nome)}{c.ativo ? '' : ' (desligado)'}</option>)}
                              </select>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="dica" style={{ marginTop: 6 }}>Quem não está cadastrado precisa ser admitido em Equipes e colaboradores (com a data de admissão) para entrar; até lá, escolha "Ignorar". O vínculo de nomes diferentes fica guardado para as próximas leituras.</p>
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
                {calc.mudancas.length} valores mudam, {calc.iguais} ficam iguais. Nos meses marcados, {destinos.filter(([, d]) => d.produto).map(([, d]) => d.produto.nome).join(', ')} passam a ser exatamente o que está na planilha: quem tinha resultado lançado e não aparece nela fica zerado.
              </p>
              {calc.mudancas.length > 0 && (
                <div className="tabela-wrap" style={{ maxHeight: 360 }}>
                  <table>
                    <thead><tr><th>Colaborador</th><th className="esq">Mês</th><th className="esq">Produto</th><th>Antes</th><th>Depois</th></tr></thead>
                    <tbody>
                      {calc.mudancas.slice(0, 300).map((m, i) => (
                        <tr key={i}>
                          <td>{capitalizar(colabPorId.get(m.cid)?.nome || '—')}</td>
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
