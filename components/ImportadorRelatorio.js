'use client';
import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { normalizar } from '@/lib/nomes';
import { fmtValor } from '@/lib/formato';
import { lerRelatorio, medidaDoNome, sugerirProduto } from '@/lib/relatorio';
import { classificarNome, sugerirGrupo } from '@/lib/conferenciaNomes';

const SITUACAO = {
  encontrado: { rotulo: 'Encontrado', classe: 'tag-ok' },
  parecido: { rotulo: 'Nome parecido, confira', classe: 'tag-atencao' },
  ambiguo: { rotulo: 'Mais de um com esse nome', classe: 'tag-atencao' },
  novo: { rotulo: 'Não cadastrado', classe: 'tag-risco' },
};
const MESES_ANT = [['m1', 1], ['m2', 2], ['m3', 3]];

function mesesAntes(referencia, n) {
  const [a, m] = referencia.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 - n, 1));
  return d.toISOString().slice(0, 10);
}

export default function ImportadorRelatorio({ periodos, periodoInicial, produtos, colaboradores, grupos, apelidos, acao }) {
  const [arquivos, setArquivos] = useState([]);
  const [periodoId, setPeriodoId] = useState(periodoInicial || '');
  const [historico, setHistorico] = useState(false);
  const [modo, setModo] = useState('substituir');
  const [decisoes, setDecisoes] = useState({});
  const [grupoDe, setGrupoDe] = useState({});
  const [filtro, setFiltro] = useState('atencao');
  const [grupoLote, setGrupoLote] = useState('');
  const [erroLeitura, setErroLeitura] = useState('');
  const [resultado, setResultado] = useState(null);
  const [pendente, iniciar] = useTransition();

  const colabPorId = useMemo(() => new Map(colaboradores.map((c) => [c.id, c])), [colaboradores]);
  const mapaApelidos = useMemo(() => new Map(apelidos.map((a) => [a.apelido, a.colaborador_id])), [apelidos]);
  const colabsOrdenados = useMemo(() => [...colaboradores].sort((a, b) => a.nome.localeCompare(b.nome)), [colaboradores]);
  const produtoPorId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);

  async function escolherArquivos(e) {
    const lista = [...(e.target.files || [])];
    setErroLeitura('');
    setResultado(null);
    if (!lista.length) return;
    const XLSX = await import('xlsx');
    const lidos = [];
    const falhas = [];
    for (const f of lista) {
      try {
        const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
        const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null, blankrows: false });
        const rel = lerRelatorio(linhas);
        if (!rel) { falhas.push(f.name); continue; }
        lidos.push({ nome: f.name, rel, produto_id: sugerirProduto(f.name, produtos), medida: rel.medida || medidaDoNome(f.name) || 'qtd' });
      } catch { falhas.push(f.name); }
    }
    if (falhas.length) setErroLeitura(`Não reconheci o formato de: ${falhas.join(', ')}. Use os arquivos exportados do relatório (aba Export).`);
    setArquivos(lidos);
    const mes = lidos.find((a) => a.rel.mes)?.rel.mes;
    const per = mes && periodos.find((p) => p.referencia.startsWith(mes));
    if (per) setPeriodoId(per.id);
    setDecisoes({});
    setGrupoDe({});
  }
  const mudarArquivo = (i, parcial) => setArquivos((l) => l.map((a, j) => (j === i ? { ...a, ...parcial } : a)));

  const periodo = periodos.find((p) => p.id === periodoId);
  const periodoDoMes = (k) => (k === 'm0' ? periodo : periodo && periodos.find((p) => p.referencia === mesesAntes(periodo.referencia, Number(k.slice(1)))));
  const mesesUsados = ['m0', ...(historico ? MESES_ANT.map(([k]) => k) : [])].filter((k) => periodoDoMes(k));
  const validos = arquivos.filter((a) => a.produto_id && a.medida);

  // junta as pessoas de todos os arquivos: valores[mes]["produto|medida"]
  const pessoas = useMemo(() => {
    const porChave = new Map();
    validos.forEach((a) => {
      const item = `${a.produto_id}|${a.medida}`;
      a.rel.pessoas.forEach((p) => {
        const chave = normalizar(p.nome);
        if (!porChave.has(chave)) porChave.set(chave, { chave, original: p.nome, equipe: p.equipe, setor: p.setor, unidade: p.unidade, valores: { m0: {}, m1: {}, m2: {}, m3: {} } });
        const x = porChave.get(chave);
        if (!x.equipe && p.equipe) x.equipe = p.equipe;
        // no mês principal, quem aparece no relatório sem número fica com zero (substituir deixa a base igual ao relatório)
        const v0 = p.valores.m0 ?? (modo === 'substituir' ? 0 : null);
        if (v0 !== null) x.valores.m0[item] = (x.valores.m0[item] || 0) + v0;
        MESES_ANT.forEach(([k]) => { if (p.valores[k] !== null) x.valores[k][item] = (x.valores[k][item] || 0) + p.valores[k]; });
      });
    });
    const ctx = { colaboradores, mapaApelidos, grupos };
    return [...porChave.values()].map((p) => ({ ...p, ...classificarNome(p.original, p.equipe, ctx) }))
      .sort((a, b) => a.original.localeCompare(b.original));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivos, modo]);

  // canais sem consultor (ex.: CANAL INDIRETO) -> resultado direto numa equipe
  const linhasGrupo = useMemo(() => {
    const porNome = new Map();
    validos.forEach((a) => {
      const item = `${a.produto_id}|${a.medida}`;
      a.rel.grupos.forEach((g) => {
        if (!porNome.has(g.nome)) porNome.set(g.nome, { nome: g.nome, valores: { m0: {}, m1: {}, m2: {}, m3: {} } });
        const x = porNome.get(g.nome);
        ['m0', ...MESES_ANT.map(([k]) => k)].forEach((k) => { if (g.valores[k] !== null) x.valores[k][item] = (x.valores[k][item] || 0) + g.valores[k]; });
      });
    });
    return [...porNome.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivos]);
  const grupoEscolhido = (nome) => (nome in grupoDe ? grupoDe[nome] : sugerirGrupo(nome, grupos));

  function decisao(p) {
    const d = decisoes[p.chave];
    if (d) return d;
    if (p.situacao === 'novo') return { acao: 'novo', nome: p.original, grupo_id: p.grupoSugerido || '' };
    return { acao: 'vincular', colaborador_id: p.sugerido || '' };
  }
  const mudar = (chave, parcial, atual) => setDecisoes((d) => ({ ...d, [chave]: { ...atual, ...parcial } }));
  function aplicarLote(acaoLote) {
    setDecisoes((d) => {
      const nd = { ...d };
      pessoas.filter((p) => p.situacao === 'novo').forEach((p) => {
        nd[p.chave] = acaoLote === 'ignorar' ? { acao: 'ignorar' } : { acao: 'novo', nome: decisao(p).nome || p.original, grupo_id: grupoLote };
      });
      return nd;
    });
  }

  const pendencias = pessoas.filter((p) => {
    const d = decisao(p);
    return (d.acao === 'novo' && (!d.grupo_id || !d.nome?.trim())) || (d.acao === 'vincular' && !d.colaborador_id) || (d.acao === 'equipe' && !d.grupo_id);
  }).length;

  // conferência: total do arquivo x total que será gravado (mês principal)
  const conferencia = validos.map((a) => {
    const item = `${a.produto_id}|${a.medida}`;
    const totalArq = a.rel.total?.m0 ?? 0;
    const pessoasOk = pessoas.filter((p) => decisao(p).acao !== 'ignorar' && (decisao(p).acao !== 'equipe' || decisao(p).grupo_id)).reduce((s, p) => s + (p.valores.m0[item] || 0), 0);
    const gruposOk = linhasGrupo.filter((g) => grupoEscolhido(g.nome)).reduce((s, g) => s + (g.valores.m0[item] || 0), 0);
    return { a, totalArq, importado: pessoasOk + gruposOk };
  });

  function importar() {
    const novos = [];
    const base = [];
    const diretos = []; // { grupo_id, p }
    pessoas.forEach((p) => {
      const d = decisao(p);
      if (d.acao === 'ignorar') return;
      if (d.acao === 'equipe') { diretos.push({ grupo_id: d.grupo_id, p }); return; }
      if (d.acao === 'novo') { novos.push({ chave: p.chave, nome: d.nome, grupo_id: d.grupo_id }); base.push({ p, ref: { chave: p.chave } }); }
      else {
        const c = colabPorId.get(d.colaborador_id);
        base.push({ p, ref: { colaborador_id: d.colaborador_id, apelido: c && normalizar(c.nome) !== p.chave ? p.original : null } });
      }
    });
    const lotes = mesesUsados.map((k) => ({
      periodo_id: periodoDoMes(k).id,
      pessoas: base.map(({ p, ref }) => ({ ...ref, valores: p.valores[k] })).filter((x) => Object.keys(x.valores).length),
      grupos: [
        ...linhasGrupo.map((g) => ({ grupo_id: grupoEscolhido(g.nome), valores: g.valores[k] })),
        ...diretos.map(({ grupo_id, p }) => ({ grupo_id, valores: p.valores[k] })),
      ].filter((x) => x.grupo_id && Object.keys(x.valores).length),
    }));
    iniciar(async () => {
      const r = await acao({ modo, novos, lotes });
      setResultado(r);
      if (r?.ok) { setArquivos([]); setDecisoes({}); }
    });
  }

  const visiveis = filtro === 'atencao' ? pessoas.filter((p) => p.situacao !== 'encontrado') : pessoas;
  const resumoValores = (p) => validos.map((a) => {
    const v = p.valores.m0[`${a.produto_id}|${a.medida}`];
    return v ? `${produtoPorId.get(a.produto_id)?.nome} ${fmtValor(v, a.medida, 2)}` : null;
  }).filter(Boolean).join('; ') || 'sem resultado no mês';
  const mesesFaltando = historico && periodo ? MESES_ANT.filter(([k]) => !periodoDoMes(k)).map(([, n]) => n) : [];

  return (
    <div className="importador">
      {resultado?.ok && (
        <div className="bloco aviso-ok">
          <strong>{resultado.ok}</strong>
          <p className="dica" style={{ marginTop: 4 }}>Os resultados já aparecem nos colaboradores e somam nas equipes. <Link href={`/?p=${periodoId}`}>Ver painel</Link></p>
        </div>
      )}

      <section className="secao passo">
        <h2>1. Arquivos do relatório</h2>
        <div className="bloco">
          <label className="campo">Selecione todos os arquivos de uma vez (ex.: alta_movel_qtd, alta_movel_receita...)
            <input type="file" multiple accept=".xlsx,.xls" onChange={escolherArquivos} />
          </label>
          {erroLeitura && <p className="msg msg-erro">{erroLeitura}</p>}
          {arquivos.length > 0 && (
            <div className="tabela-wrap" style={{ marginTop: 12 }}>
              <table>
                <thead><tr><th>Arquivo</th><th className="esq">Produto</th><th className="esq">Medida</th><th>Mês no arquivo</th><th>Total do arquivo</th></tr></thead>
                <tbody>
                  {arquivos.map((a, i) => (
                    <tr key={a.nome}>
                      <td>{a.nome}</td>
                      <td className="esq">
                        <select value={a.produto_id} onChange={(e) => mudarArquivo(i, { produto_id: e.target.value })} aria-label={`Produto de ${a.nome}`}>
                          <option value="">Escolha</option>
                          {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                        </select>
                      </td>
                      <td className="esq">
                        <select value={a.medida} onChange={(e) => mudarArquivo(i, { medida: e.target.value })} aria-label={`Medida de ${a.nome}`}>
                          <option value="qtd">Quantidade</option>
                          <option value="brl">Receita (R$)</option>
                        </select>
                      </td>
                      <td>{a.rel.mes ? a.rel.mes.split('-').reverse().join('/') : '—'}</td>
                      <td>{fmtValor(a.rel.total?.m0 ?? 0, a.medida, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {arquivos.length > 0 && (
            <div className="campos" style={{ marginTop: 14 }}>
              <label className="campo">Gravar no mês
                <select value={periodoId} onChange={(e) => setPeriodoId(e.target.value)}>
                  {periodos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </label>
              <label className="check"><input type="checkbox" checked={historico} onChange={(e) => setHistorico(e.target.checked)} /> Trazer também os 3 meses anteriores (colunas M-1, M-2, M-3)</label>
              <label className="check"><input type="radio" checked={modo === 'substituir'} onChange={() => setModo('substituir')} /> Substituir pelo relatório</label>
              <label className="check"><input type="radio" checked={modo === 'somar'} onChange={() => setModo('somar')} /> Somar ao que já existe</label>
            </div>
          )}
          {mesesFaltando.length > 0 && <p className="dica" style={{ marginTop: 6 }}>Os meses M-{mesesFaltando.join(', M-')} não existem no sistema e serão pulados. Crie-os no Quadro de metas para trazer o histórico deles.</p>}
        </div>
      </section>

      {validos.length > 0 && linhasGrupo.length > 0 && (
        <section className="secao passo">
          <h2>2. Canais sem consultor no relatório</h2>
          <p className="dica" style={{ marginBottom: 10 }}>O relatório traz só o total desses canais. Escolha em qual equipe do sistema o resultado entra.</p>
          <div className="bloco">
            {linhasGrupo.map((g) => (
              <div key={g.nome} className="campos" style={{ marginBottom: 6 }}>
                <span style={{ minWidth: 200, fontWeight: 600 }}>{g.nome}</span>
                <select value={grupoEscolhido(g.nome)} onChange={(e) => setGrupoDe((x) => ({ ...x, [g.nome]: e.target.value }))} aria-label={`Equipe para ${g.nome}`}>
                  <option value="">Não importar</option>
                  {grupos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                </select>
              </div>
            ))}
          </div>
        </section>
      )}

      {validos.length > 0 && (
        <section className="secao passo">
          <h2>3. Colaboradores</h2>
          <p className="dica" style={{ marginBottom: 10 }}>
            {pessoas.length} pessoas nos arquivos: {pessoas.filter((p) => p.situacao === 'encontrado').length} encontradas,{' '}
            {pessoas.filter((p) => p.situacao === 'parecido' || p.situacao === 'ambiguo').length} para conferir e {pessoas.filter((p) => p.situacao === 'novo').length} não cadastradas.
            Para cadastrar, o sistema já sugere a equipe pelo nome do supervisor no relatório.
          </p>
          {pessoas.some((p) => p.situacao === 'novo') && (
            <div className="bloco campos" style={{ marginBottom: 10 }}>
              <label className="campo">Todos os não cadastrados
                <select value={grupoLote} onChange={(e) => setGrupoLote(e.target.value)}>
                  <option value="">Escolha a equipe</option>
                  {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              </label>
              <button type="button" className="btn btn-sec" disabled={!grupoLote} onClick={() => aplicarLote('novo')}>Cadastrar todos nessa equipe</button>
              <button type="button" className="btn btn-sec" onClick={() => aplicarLote('ignorar')}>Ignorar todos</button>
            </div>
          )}
          <div className="abas">
            <button type="button" className={filtro === 'atencao' ? 'aba ativa' : 'aba'} onClick={() => setFiltro('atencao')}>Precisam de atenção</button>
            <button type="button" className={filtro === 'todos' ? 'aba ativa' : 'aba'} onClick={() => setFiltro('todos')}>Todos</button>
          </div>
          {visiveis.length === 0 ? <p className="dica" style={{ padding: '14px 0' }}>Todos os nomes foram encontrados no cadastro.</p> : (
            <div className="tabela-wrap">
              <table>
                <thead><tr><th>Nome no relatório</th><th className="esq">Resultado no mês</th><th className="esq">Situação</th><th className="esq">O que fazer</th></tr></thead>
                <tbody>
                  {visiveis.map((p) => {
                    const d = decisao(p);
                    const opcoes = p.situacao === 'ambiguo' ? colabsOrdenados.filter((c) => p.opcoes.includes(c.id)) : colabsOrdenados;
                    return (
                      <tr key={p.chave} className={d.acao === 'ignorar' ? 'inativo' : ''}>
                        <td>{p.original}<span className="nome-sub">{[p.setor, p.equipe].filter(Boolean).join(', ')}</span></td>
                        <td className="esq fraco" style={{ whiteSpace: 'normal', minWidth: 160 }}>{resumoValores(p)}</td>
                        <td className="esq"><span className={`tag ${SITUACAO[p.situacao].classe}`}>{SITUACAO[p.situacao].rotulo}</span></td>
                        <td className="esq">
                          <div className="campos" style={{ flexWrap: 'nowrap' }}>
                            <select value={d.acao} onChange={(e) => mudar(p.chave, e.target.value === 'novo' ? { acao: 'novo', nome: d.nome || p.original, grupo_id: d.grupo_id || p.grupoSugerido || '' } : e.target.value === 'equipe' ? { acao: 'equipe', grupo_id: d.grupo_id || p.grupoSugerido || '' } : { acao: e.target.value }, d)} aria-label={`Ação para ${p.original}`}>
                              <option value="vincular">Vincular a</option>
                              <option value="novo">Cadastrar novo</option>
                              <option value="equipe">Lançar direto numa equipe</option>
                              <option value="ignorar">Ignorar</option>
                            </select>
                            {d.acao === 'equipe' && (
                              <select value={d.grupo_id || ''} onChange={(e) => mudar(p.chave, { grupo_id: e.target.value }, d)} aria-label="Equipe" style={{ maxWidth: 260 }}>
                                <option value="">Escolha a equipe</option>
                                {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                              </select>
                            )}
                            {d.acao === 'vincular' && (
                              <select value={d.colaborador_id || ''} onChange={(e) => mudar(p.chave, { colaborador_id: e.target.value }, d)} aria-label="Colaborador" style={{ maxWidth: 300 }}>
                                <option value="">Escolha o colaborador</option>
                                {opcoes.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.grupoNome}){c.ativo ? '' : ' - inativo'}</option>)}
                              </select>
                            )}
                            {d.acao === 'novo' && (
                              <>
                                <input type="text" value={d.nome ?? p.original} onChange={(e) => mudar(p.chave, { nome: e.target.value }, d)} aria-label="Nome do novo colaborador" style={{ width: 190 }} />
                                <select value={d.grupo_id || ''} onChange={(e) => mudar(p.chave, { grupo_id: e.target.value }, d)} aria-label="Equipe" style={{ maxWidth: 240 }}>
                                  <option value="">Escolha a equipe</option>
                                  {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                                </select>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {validos.length > 0 && (
        <section className="secao passo">
          <h2>4. Conferir e importar</h2>
          <div className="tabela-wrap">
            <table>
              <thead><tr><th>Arquivo</th><th>Total do relatório</th><th>Vai entrar no sistema</th><th></th></tr></thead>
              <tbody>
                {conferencia.map(({ a, totalArq, importado }) => {
                  const igual = Math.abs(totalArq - importado) < 0.01;
                  return (
                    <tr key={a.nome}>
                      <td>{produtoPorId.get(a.produto_id)?.nome} ({a.medida === 'brl' ? 'R$' : 'qtd'})<span className="nome-sub">{a.nome}</span></td>
                      <td>{fmtValor(totalArq, a.medida, 2)}</td>
                      <td>{fmtValor(importado, a.medida, 2)}</td>
                      <td>{igual ? <span className="tag tag-ok">Bate</span> : <span className="tag tag-atencao">Diferença de {fmtValor(totalArq - importado, a.medida, 2)}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bloco" style={{ marginTop: 10 }}>
            <p>Vou gravar em {mesesUsados.map((k) => periodoDoMes(k)?.nome).join(', ')}{modo === 'substituir' ? ', substituindo o que estava lançado para essas pessoas e produtos.' : ', somando ao que já existe.'}</p>
            {arquivos.length > validos.length && <p className="msg msg-erro">Escolha o produto de todos os arquivos no passo 1.</p>}
            {pendencias > 0 && <p className="msg msg-erro">Falta escolher o colaborador ou a equipe de {pendencias} nomes no passo 3.</p>}
            {resultado?.erro && <p className="msg msg-erro">{resultado.erro}</p>}
            <button type="button" className="btn" style={{ marginTop: 12 }} disabled={pendente || pendencias > 0 || !periodo || arquivos.length > validos.length} onClick={importar}>
              {pendente ? 'Importando…' : 'Importar relatório'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
