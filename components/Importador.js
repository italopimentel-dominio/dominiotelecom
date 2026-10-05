'use client';
import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { normalizar, similaridade } from '@/lib/nomes';
import { numero, fmtValor } from '@/lib/formato';

const PALAVRAS_NOME = ['nome', 'colaborador', 'vendedor', 'consultor', 'atendente', 'funcionario', 'operador', 'executivo'];
const PALAVRAS_EQUIPE = ['equipe', 'supervisor', 'supervisao', 'time', 'celula', 'coordenador', 'gestor', 'regional'];
const SITUACAO = {
  encontrado: { rotulo: 'Encontrado', classe: 'tag-ok' },
  parecido: { rotulo: 'Nome parecido, confira', classe: 'tag-atencao' },
  ambiguo: { rotulo: 'Mais de um com esse nome', classe: 'tag-atencao' },
  novo: { rotulo: 'Não cadastrado', classe: 'tag-risco' },
};

function detectarCabecalho(linhas) {
  for (let i = 0; i < Math.min(linhas.length, 15); i++) {
    const textos = (linhas[i] || []).filter((c) => typeof c === 'string' && c.trim() && numero(c) === null);
    if (textos.length >= 2) return i;
  }
  return 0;
}

function acharColuna(cabecalho, palavras) {
  const i = cabecalho.findIndex((h) => {
    const n = normalizar(h);
    return palavras.some((p) => n.split(' ').includes(p) || n.startsWith(p));
  });
  return i >= 0 ? String(i) : '';
}

const RE_VALOR = /receita|valor|r\$|fatur|reais|ticket/i;
const RE_VALOR_G = /receita|valor|r\$|fatur|reais|ticket/gi;

// Liga cada produto (e medida) à coluna de nome mais parecido.
// Produto com quantidade e receita: a coluna de receita precisa ter "receita", "valor" ou "R$" no nome.
function mapearProdutos(cabecalho, produtos, ocupadas) {
  const usadas = new Set(ocupadas);
  const mapa = {};
  produtos.forEach((p) => {
    let melhor = -1, nota = 0;
    cabecalho.forEach((h, i) => {
      if (usadas.has(String(i)) || !h) return;
      const ehValor = RE_VALOR.test(h);
      if (p.ambos && (p.unidade === 'brl') !== ehValor) return;
      const s = similaridade(h.replace(RE_VALOR_G, ' '), p.nome);
      if (s > nota) { nota = s; melhor = i; }
    });
    if (melhor >= 0 && nota >= 0.7) { mapa[p.id] = String(melhor); usadas.add(String(melhor)); }
    else mapa[p.id] = '';
  });
  return mapa;
}

async function lerArquivo(arquivo) {
  const XLSX = await import('xlsx');
  const buf = await arquivo.arrayBuffer();
  let wb;
  if (/\.(csv|txt)$/i.test(arquivo.name)) {
    let texto;
    try { texto = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { texto = new TextDecoder('windows-1252').decode(buf); }
    const primeira = texto.split(/\r?\n/)[0] || '';
    const sep = (primeira.match(/;/g) || []).length > (primeira.match(/,/g) || []).length ? ';' : primeira.includes('\t') ? '\t' : ',';
    wb = XLSX.read(texto, { type: 'string', FS: sep, raw: true });
  } else {
    wb = XLSX.read(buf, { type: 'array' });
  }
  const abas = {};
  wb.SheetNames.forEach((n) => {
    abas[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: false });
  });
  return { abas, nomes: wb.SheetNames };
}

export default function Importador({ periodos, periodoInicial, produtos, colaboradores, grupos, apelidos, acao }) {
  const [periodoId, setPeriodoId] = useState(periodoInicial || periodos[0]?.id || '');
  const [arquivo, setArquivo] = useState(null);
  const [planilha, setPlanilha] = useState(null);
  const [aba, setAba] = useState('');
  const [cab, setCab] = useState(0);
  const [colNome, setColNome] = useState('');
  const [colEquipe, setColEquipe] = useState('');
  const [mapa, setMapa] = useState({});
  const [modo, setModo] = useState('substituir');
  const [decisoes, setDecisoes] = useState({});
  const [filtro, setFiltro] = useState('atencao');
  const [grupoLote, setGrupoLote] = useState('');
  const [erroLeitura, setErroLeitura] = useState('');
  const [resultado, setResultado] = useState(null);
  const [pendente, iniciar] = useTransition();

  const colabPorId = useMemo(() => new Map(colaboradores.map((c) => [c.id, c])), [colaboradores]);
  const mapaApelidos = useMemo(() => new Map(apelidos.map((a) => [a.apelido, a.colaborador_id])), [apelidos]);
  const linhas = planilha?.abas[aba] || [];
  const cabecalho = (linhas[cab] || []).map((h) => (h === null ? '' : String(h).trim()));
  const nomeColuna = (i) => cabecalho[i] || `Coluna ${i + 1}`;
  const colunas = Array.from({ length: Math.max(0, ...linhas.slice(0, 50).map((l) => l.length)) }, (_, i) => i);

  function configurarAba(dados, nomeAba) {
    const ls = dados.abas[nomeAba] || [];
    const c = detectarCabecalho(ls);
    const cabs = (ls[c] || []).map((h) => (h === null ? '' : String(h)));
    const n = acharColuna(cabs, PALAVRAS_NOME);
    const e = acharColuna(cabs, PALAVRAS_EQUIPE);
    setAba(nomeAba);
    setCab(c);
    setColNome(n);
    setColEquipe(e);
    setMapa(mapearProdutos(cabs, produtos, [n, e]));
    setDecisoes({});
  }

  async function escolherArquivo(e) {
    const f = e.target.files?.[0];
    setErroLeitura('');
    setResultado(null);
    if (!f) return;
    try {
      const dados = await lerArquivo(f);
      if (!dados.nomes.length) throw new Error('vazio');
      setArquivo(f.name);
      setPlanilha(dados);
      configurarAba(dados, dados.nomes[0]);
    } catch {
      setErroLeitura('Não foi possível ler o arquivo. Use .xlsx, .xls ou .csv.');
      setPlanilha(null);
    }
  }

  function trocarCabecalho(v) {
    const c = Number(v);
    const cabs = (linhas[c] || []).map((h) => (h === null ? '' : String(h)));
    const n = acharColuna(cabs, PALAVRAS_NOME);
    const e = acharColuna(cabs, PALAVRAS_EQUIPE);
    setCab(c);
    setColNome(n);
    setColEquipe(e);
    setMapa(mapearProdutos(cabs, produtos, [n, e]));
    setDecisoes({});
  }

  const produtosMapeados = produtos.filter((p) => mapa[p.id] !== '' && mapa[p.id] !== undefined);

  // nomes da planilha, somando linhas repetidas
  const pessoas = useMemo(() => {
    if (colNome === '' || !planilha) return [];
    const porChave = new Map();
    linhas.slice(cab + 1).forEach((l) => {
      const original = String(l[Number(colNome)] ?? '').trim();
      const chave = normalizar(original);
      if (!chave || chave.startsWith('total')) return;
      if (!porChave.has(chave)) {
        porChave.set(chave, { chave, original, equipe: colEquipe !== '' ? String(l[Number(colEquipe)] ?? '').trim() : '', valores: {}, linhas: 0 });
      }
      const p = porChave.get(chave);
      p.linhas += 1;
      produtosMapeados.forEach((prod) => {
        const v = numero(l[Number(mapa[prod.id])]);
        if (v !== null) p.valores[prod.id] = (p.valores[prod.id] || 0) + v;
      });
    });
    return [...porChave.values()].map((p) => ({ ...p, ...classificar(p) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planilha, aba, cab, colNome, colEquipe, mapa]);

  function classificar(p) {
    const viaApelido = mapaApelidos.get(p.chave);
    if (viaApelido && colabPorId.has(viaApelido)) return { situacao: 'encontrado', sugerido: viaApelido };
    const exatos = colaboradores.filter((c) => normalizar(c.nome) === p.chave);
    const ativos = exatos.filter((c) => c.ativo);
    if (exatos.length === 1) return { situacao: 'encontrado', sugerido: exatos[0].id };
    if (ativos.length === 1) return { situacao: 'encontrado', sugerido: ativos[0].id };
    if (exatos.length > 1) return { situacao: 'ambiguo', sugerido: '', opcoes: exatos.map((c) => c.id) };
    let melhor = null, nota = 0;
    colaboradores.forEach((c) => {
      const s = similaridade(p.original, c.nome) + (c.ativo ? 0.01 : 0);
      if (s > nota) { nota = s; melhor = c; }
    });
    if (melhor && nota >= 0.72) return { situacao: 'parecido', sugerido: melhor.id };
    let grupo = '';
    if (p.equipe) {
      let gn = 0;
      grupos.forEach((g) => { const s = similaridade(p.equipe, g.nome); if (s > gn) { gn = s; grupo = g.id; } });
      if (gn < 0.7) grupo = '';
    }
    return { situacao: 'novo', sugerido: '', grupoSugerido: grupo };
  }

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
        nd[p.chave] = acaoLote === 'ignorar'
          ? { acao: 'ignorar' }
          : { acao: 'novo', nome: decisao(p).nome || p.original, grupo_id: grupoLote };
      });
      return nd;
    });
  }

  const resumo = useMemo(() => {
    let vincular = 0, novos = 0, ignorar = 0, pendentes = 0;
    pessoas.forEach((p) => {
      const d = decisao(p);
      if (d.acao === 'ignorar') ignorar++;
      else if (d.acao === 'novo') { novos++; if (!d.grupo_id || !d.nome?.trim()) pendentes++; }
      else { vincular++; if (!d.colaborador_id) pendentes++; }
    });
    return { vincular, novos, ignorar, pendentes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pessoas, decisoes]);

  function importar() {
    const novos = [];
    const lista = [];
    pessoas.forEach((p) => {
      const d = decisao(p);
      if (d.acao === 'ignorar' || !Object.keys(p.valores).length) return;
      if (d.acao === 'novo') {
        novos.push({ chave: p.chave, nome: d.nome, grupo_id: d.grupo_id });
        lista.push({ chave: p.chave, valores: p.valores });
      } else {
        const c = colabPorId.get(d.colaborador_id);
        lista.push({
          colaborador_id: d.colaborador_id,
          apelido: c && normalizar(c.nome) !== p.chave ? p.original : null,
          valores: p.valores,
        });
      }
    });
    iniciar(async () => {
      const r = await acao({ periodo_id: periodoId, modo, novos, linhas: lista });
      setResultado(r);
      if (r?.ok) { setPlanilha(null); setArquivo(null); setDecisoes({}); }
    });
  }

  const visiveis = filtro === 'atencao' ? pessoas.filter((p) => p.situacao !== 'encontrado') : pessoas;
  const opcaoColab = (c) => `${c.nome} (${c.grupoNome})${c.ativo ? '' : ' - inativo'}`;
  const colabsOrdenados = useMemo(() => [...colaboradores].sort((a, b) => a.nome.localeCompare(b.nome)), [colaboradores]);
  const periodoNome = periodos.find((p) => p.id === periodoId)?.nome;

  return (
    <div className="importador">
      {resultado?.ok && (
        <div className="bloco aviso-ok">
          <strong>{resultado.ok}</strong>
          <p className="dica" style={{ marginTop: 4 }}>
            Os resultados já aparecem nos colaboradores e somam nas equipes. <Link href={`/?p=${periodoId}`}>Ver painel</Link>
          </p>
        </div>
      )}

      <section className="secao passo">
        <h2>1. Arquivo</h2>
        <div className="bloco campos">
          <label className="campo">Período dos resultados
            <select value={periodoId} onChange={(e) => setPeriodoId(e.target.value)}>
              {periodos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </label>
          <label className="campo">Planilha (.xlsx, .xls ou .csv)
            <input type="file" accept=".xlsx,.xls,.csv,.txt" onChange={escolherArquivo} />
          </label>
          {planilha && planilha.nomes.length > 1 && (
            <label className="campo">Aba
              <select value={aba} onChange={(e) => configurarAba(planilha, e.target.value)}>
                {planilha.nomes.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          )}
        </div>
        {erroLeitura && <p className="msg msg-erro">{erroLeitura}</p>}
      </section>

      {planilha && (
        <section className="secao passo">
          <h2>2. Colunas</h2>
          <p className="dica" style={{ marginBottom: 10 }}>Já deixei marcadas as colunas que reconheci em {arquivo}. Confira e ajuste o que precisar.</p>
          <div className="bloco">
            <div className="campos">
              <label className="campo">Linha do cabeçalho
                <select value={cab} onChange={(e) => trocarCabecalho(e.target.value)}>
                  {linhas.slice(0, 15).map((l, i) => (
                    <option key={i} value={i}>Linha {i + 1}: {l.filter((x) => x !== null).slice(0, 3).join(', ').slice(0, 40)}</option>
                  ))}
                </select>
              </label>
              <label className="campo">Nome do colaborador
                <select value={colNome} onChange={(e) => { setColNome(e.target.value); setDecisoes({}); }}>
                  <option value="">Escolha</option>
                  {colunas.map((i) => <option key={i} value={i}>{nomeColuna(i)}</option>)}
                </select>
              </label>
              <label className="campo">Equipe (opcional, ajuda a cadastrar novos)
                <select value={colEquipe} onChange={(e) => setColEquipe(e.target.value)}>
                  <option value="">Não tem</option>
                  {colunas.map((i) => <option key={i} value={i}>{nomeColuna(i)}</option>)}
                </select>
              </label>
            </div>

            <h3 style={{ margin: '18px 0 8px' }}>Qual coluna tem o resultado de cada produto</h3>
            <div className="grade-mapa">
              {produtos.map((p) => (
                <label key={p.id} className="campo">{p.nome}{p.unidade === 'brl' ? ' (R$)' : p.ambos ? ' (quantidade)' : ''}
                  <select value={mapa[p.id] ?? ''} onChange={(e) => setMapa((m) => ({ ...m, [p.id]: e.target.value }))}>
                    <option value="">Não importar</option>
                    {colunas.map((i) => <option key={i} value={i}>{nomeColuna(i)}</option>)}
                  </select>
                </label>
              ))}
            </div>

            <h3 style={{ margin: '18px 0 8px' }}>O que fazer com o que já foi lançado</h3>
            <label className="check"><input type="radio" name="modo" checked={modo === 'substituir'} onChange={() => setModo('substituir')} /> Substituir pelo valor da planilha (use quando a planilha traz o acumulado do mês)</label>
            <label className="check"><input type="radio" name="modo" checked={modo === 'somar'} onChange={() => setModo('somar')} /> Somar ao que já estava lançado (use quando a planilha traz só um dia ou uma semana)</label>
          </div>

          <details style={{ marginTop: 10 }}>
            <summary className="dica" style={{ cursor: 'pointer' }}>Ver as primeiras linhas do arquivo</summary>
            <div className="tabela-wrap" style={{ marginTop: 8 }}>
              <table>
                <tbody>
                  {linhas.slice(cab, cab + 6).map((l, i) => (
                    <tr key={i} className={i === 0 ? 'linha-grupo' : ''}>
                      {colunas.map((c) => <td key={c} className="esq">{l[c] ?? ''}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      )}

      {planilha && colNome !== '' && (
        <section className="secao passo">
          <h2>3. Colaboradores</h2>
          <p className="dica" style={{ marginBottom: 10 }}>
            {pessoas.length} nomes na planilha: {pessoas.filter((p) => p.situacao === 'encontrado').length} encontrados no cadastro,{' '}
            {pessoas.filter((p) => p.situacao === 'parecido' || p.situacao === 'ambiguo').length} para conferir e{' '}
            {pessoas.filter((p) => p.situacao === 'novo').length} não cadastrados.
            Quando você vincula um nome diferente, o sistema lembra na próxima importação.
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
          {visiveis.length === 0 ? (
            <p className="dica" style={{ padding: '14px 0' }}>Todos os nomes foram encontrados no cadastro.</p>
          ) : (
            <div className="tabela-wrap">
              <table>
                <thead><tr><th>Nome na planilha</th><th className="esq">Resultados</th><th className="esq">Situação</th><th className="esq">O que fazer</th></tr></thead>
                <tbody>
                  {visiveis.map((p) => {
                    const d = decisao(p);
                    const opcoes = p.situacao === 'ambiguo' ? colabsOrdenados.filter((c) => p.opcoes.includes(c.id)) : colabsOrdenados;
                    return (
                      <tr key={p.chave} className={d.acao === 'ignorar' ? 'inativo' : ''}>
                        <td>{p.original}{p.equipe && <span className="nome-sub">{p.equipe}</span>}{p.linhas > 1 && <span className="nome-sub">{p.linhas} linhas somadas</span>}</td>
                        <td className="esq fraco" style={{ whiteSpace: 'normal', minWidth: 160 }}>
                          {produtosMapeados.filter((pr) => p.valores[pr.id] !== undefined).map((pr) => `${pr.nome}: ${fmtValor(p.valores[pr.id], pr.unidade, 2)}`).join('; ') || 'sem valores'}
                        </td>
                        <td className="esq"><span className={`tag ${SITUACAO[p.situacao].classe}`}>{SITUACAO[p.situacao].rotulo}</span></td>
                        <td className="esq">
                          <div className="campos" style={{ flexWrap: 'nowrap' }}>
                            <select value={d.acao} onChange={(e) => mudar(p.chave, e.target.value === 'novo' ? { acao: 'novo', nome: d.nome || p.original, grupo_id: d.grupo_id || p.grupoSugerido || '' } : { acao: e.target.value }, d)} aria-label={`Ação para ${p.original}`}>
                              <option value="vincular">Vincular a</option>
                              <option value="novo">Cadastrar novo</option>
                              <option value="ignorar">Ignorar</option>
                            </select>
                            {d.acao === 'vincular' && (
                              <select value={d.colaborador_id || ''} onChange={(e) => mudar(p.chave, { colaborador_id: e.target.value }, d)} aria-label="Colaborador" style={{ maxWidth: 320 }}>
                                <option value="">Escolha o colaborador</option>
                                {opcoes.map((c) => <option key={c.id} value={c.id}>{opcaoColab(c)}</option>)}
                              </select>
                            )}
                            {d.acao === 'novo' && (
                              <>
                                <input type="text" value={d.nome ?? p.original} onChange={(e) => mudar(p.chave, { nome: e.target.value }, d)} aria-label="Nome do novo colaborador" style={{ width: 190 }} />
                                <select value={d.grupo_id || ''} onChange={(e) => mudar(p.chave, { grupo_id: e.target.value }, d)} aria-label="Equipe" style={{ maxWidth: 260 }}>
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

      {planilha && colNome !== '' && pessoas.length > 0 && (
        <section className="secao passo">
          <h2>4. Importar</h2>
          <div className="bloco">
            <p>
              Vou gravar os resultados de {periodoNome}: {resumo.vincular} colaboradores já cadastrados
              {resumo.novos ? `, ${resumo.novos} novos` : ''}{resumo.ignorar ? `, ${resumo.ignorar} ignorados` : ''}.
              {modo === 'substituir' ? ' Os valores lançados antes serão substituídos.' : ' Os valores serão somados aos já lançados.'}
            </p>
            {!produtosMapeados.length && <p className="msg msg-erro">Escolha a coluna de pelo menos um produto no passo 2.</p>}
            {resumo.pendentes > 0 && <p className="msg msg-erro">Falta escolher o colaborador ou a equipe de {resumo.pendentes} nomes no passo 3.</p>}
            {resultado?.erro && <p className="msg msg-erro">{resultado.erro}</p>}
            <button
              type="button"
              className="btn"
              style={{ marginTop: 12 }}
              disabled={pendente || resumo.pendentes > 0 || !produtosMapeados.length || !periodoId}
              onClick={importar}
            >
              {pendente ? 'Importando…' : 'Importar resultados'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
