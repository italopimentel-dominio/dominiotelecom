'use client';
import { useEffect, useMemo, useState } from 'react';
import { normalizar } from '@/lib/nomes';
import {
  CAMPOS_FILTRO, SAIDA_PADRAO, COLS_TELEFONE, ROTULOS, chaveCol, vazio, num,
  fmtTelefone, fmtDocumento, tipoAutomatico, passaFiltro, filtroAtivo,
} from '@/lib/preparador';

const CHAVE_MODELOS = 'preparador_modelos_v1';
const fmtN = (n) => Number(n).toLocaleString('pt-BR');

function FiltroLista({ f, opcoes, mudar }) {
  const [busca, setBusca] = useState('');
  const marcados = new Set(f.valores || []);
  const visiveis = busca ? opcoes.filter(([v]) => normalizar(v).includes(normalizar(busca))) : opcoes;
  const alternar = (v) => {
    const n = new Set(marcados);
    if (n.has(v)) n.delete(v); else n.add(v);
    mudar({ valores: [...n] });
  };
  return (
    <div>
      {opcoes.length > 10 && <input type="text" className="prep-busca" placeholder="Procurar" value={busca} onChange={(e) => setBusca(e.target.value)} />}
      <div className="prep-opcoes">
        {visiveis.map(([v, n]) => (
          <label key={v} className="check"><input type="checkbox" checked={marcados.has(v)} onChange={() => alternar(v)} /> <span>{v === '(vazio)' ? <em>vazio</em> : v}</span> <small>{fmtN(n)}</small></label>
        ))}
      </div>
      <p className="prep-dica">{marcados.size ? `${marcados.size} marcados` : 'Nenhum marcado = todos'}{marcados.size > 0 && <button type="button" onClick={() => mudar({ valores: [] })}>limpar</button>}</p>
    </div>
  );
}

function FiltroNumero({ f, mudar }) {
  return (
    <div>
      <select value={f.modo || 'qualquer'} onChange={(e) => mudar({ modo: e.target.value })}>
        <option value="qualquer">Qualquer</option>
        <option value="entre">Entre</option>
        <option value="preenchido">Tem (preenchido)</option>
        <option value="vazio">Não tem (vazio)</option>
      </select>
      {f.modo === 'entre' && (
        <div className="prep-entre">
          <input type="text" inputMode="decimal" placeholder="de" value={f.min ?? ''} onChange={(e) => mudar({ min: e.target.value })} />
          <span>a</span>
          <input type="text" inputMode="decimal" placeholder="até" value={f.max ?? ''} onChange={(e) => mudar({ max: e.target.value })} />
        </div>
      )}
    </div>
  );
}

function FiltroModo({ f, mudar, opcoes }) {
  return (
    <select value={f.modo || 'qualquer'} onChange={(e) => mudar({ modo: e.target.value })}>
      {opcoes.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
    </select>
  );
}

export default function Preparador() {
  const [arq, setArq] = useState(null); // { nome, abas, wb }
  const [aba, setAba] = useState('');
  const [cab, setCab] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  const [filtros, setFiltros] = useState({});
  const [extras, setExtras] = useState([]);
  const [saida, setSaida] = useState({ escolhidas: null, incluirFiltros: true, juntarTelefones: false, separar: 'nao', colSeparar: 'CONSULTOR VENDA', lote: 50, nome: 'material_clientes' });
  const [modelos, setModelos] = useState({});
  const [nomeModelo, setNomeModelo] = useState('');
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    try { setModelos(JSON.parse(localStorage.getItem(CHAVE_MODELOS) || '{}')); } catch { setModelos({}); }
  }, []);
  const guardarModelos = (m) => { setModelos(m); try { localStorage.setItem(CHAVE_MODELOS, JSON.stringify(m)); } catch {} };

  const idx = useMemo(() => { const m = new Map(); cab.forEach((c, i) => { if (!m.has(chaveCol(c))) m.set(chaveCol(c), i); }); return m; }, [cab]);
  const col = (nome) => idx.get(chaveCol(nome));
  const nomeReal = (nome) => cab[col(nome)] ?? nome;

  async function abrir(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setErro(''); setLendo(true);
    await new Promise((r) => setTimeout(r, 60)); // deixa a tela mostrar "Lendo..." antes do processamento pesado
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: true });
      setArq({ nome: f.name, abas: wb.SheetNames, wb });
      carregarAba(wb, wb.SheetNames[0], XLSX);
    } catch {
      setErro('Não consegui ler o arquivo. Use .xlsx, .xls ou .csv.');
    } finally { setLendo(false); }
  }

  async function carregarAba(wb, nome, XLSXmod) {
    const XLSX = XLSXmod || (await import('xlsx'));
    const dados = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: null, blankrows: false });
    const iCab = Math.max(0, dados.findIndex((l) => l.filter((c) => !vazio(c)).length >= 3));
    const cabecalho = (dados[iCab] || []).map((c) => (vazio(c) ? '' : String(c).trim()));
    setAba(nome);
    setCab(cabecalho);
    setLinhas(dados.slice(iCab + 1).filter((l) => l.some((c) => !vazio(c))));
    setExtras([]);
    // filtro padrão: só situação ATIVA
    const iSit = cabecalho.findIndex((c) => chaveCol(c) === chaveCol('SITUACAO_RECEITA'));
    const novo = {};
    if (iSit >= 0) {
      const vals = [...new Set(dados.slice(iCab + 1).map((l) => (vazio(l[iSit]) ? '(vazio)' : String(l[iSit]).trim())))];
      const ativas = vals.filter((v) => /ATIVA/i.test(v));
      if (ativas.length) novo.SITUACAO_RECEITA = { tipo: 'lista', valores: ativas };
    }
    setFiltros(novo);
  }

  // campos de filtro disponíveis nesta planilha (os prontos + os que o usuário adicionar)
  const campos = useMemo(() => {
    const prontos = CAMPOS_FILTRO.filter((c) => idx.has(chaveCol(c.col)));
    const adicionados = extras.filter((c) => idx.has(chaveCol(c))).map((c) => {
      const i = idx.get(chaveCol(c));
      return { col: c, rotulo: cab[i], tipo: tipoAutomatico(linhas.slice(0, 5000).map((l) => l[i])), extra: true };
    });
    return [...prontos, ...adicionados];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, extras, linhas]);

  // valores distintos (com contagem) das colunas de lista
  const opcoesDe = useMemo(() => {
    const m = {};
    campos.filter((c) => c.tipo === 'lista').forEach((c) => {
      const i = idx.get(chaveCol(c.col));
      const cont = new Map();
      linhas.forEach((l) => { const v = vazio(l[i]) ? '(vazio)' : String(l[i]).trim(); cont.set(v, (cont.get(v) || 0) + 1); });
      m[c.col] = [...cont.entries()].sort((a, b) => (a[0] === '(vazio)') - (b[0] === '(vazio)') || b[1] - a[1]);
    });
    return m;
  }, [campos, linhas, idx]);

  const ativos = campos.filter((c) => filtroAtivo(filtros[c.col]));
  const filtradas = useMemo(() => {
    const regras = ativos.map((c) => ({ i: idx.get(chaveCol(c.col)), f: { ...filtros[c.col], tipo: c.tipo } }));
    if (!regras.length) return linhas;
    return linhas.filter((l) => regras.every(({ i, f }) => passaFiltro(l[i], f)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, filtros, idx, campos]);

  const mudarFiltro = (c, parcial) => setFiltros((x) => ({ ...x, [c.col]: { ...(x[c.col] || {}), tipo: c.tipo, ...parcial } }));

  // ---------- colunas de saída ----------
  const disponiveisSaida = SAIDA_PADRAO.filter((c) => c === '__ENDERECO' || idx.has(chaveCol(c)));
  const escolhidas = saida.escolhidas || disponiveisSaida;
  const colunasSaida = useMemo(() => {
    let lista = disponiveisSaida.filter((c) => escolhidas.includes(c));
    if (saida.juntarTelefones) {
      const primeiro = lista.findIndex((c) => COLS_TELEFONE.includes(c));
      lista = lista.filter((c) => !COLS_TELEFONE.includes(c));
      if (primeiro >= 0) lista.splice(primeiro, 0, '__TELEFONES');
    }
    if (saida.incluirFiltros) ativos.forEach((c) => { if (!lista.includes(c.col) && c.col !== 'SITUACAO_RECEITA') lista.push(c.col); });
    return lista;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escolhidas, saida.juntarTelefones, saida.incluirFiltros, ativos.map((c) => c.col).join('|'), idx]);

  const valorSaida = (l, c) => {
    const get = (n) => { const i = col(n); return i === undefined ? null : l[i]; };
    if (c === '__ENDERECO') {
      const rua = vazio(get('DS_ENDERECO')) ? '' : String(get('DS_ENDERECO')).trim();
      const nr = vazio(get('NUMERO')) || String(get('NUMERO')) === '0' ? '' : String(get('NUMERO')).trim();
      const cid = vazio(get('DS_CIDADE')) ? '' : String(get('DS_CIDADE')).trim();
      const cep = vazio(get('NR_CEP')) ? '' : String(get('NR_CEP')).trim();
      return [[rua, nr].filter(Boolean).join(', '), cid, cep && `CEP ${cep}`].filter(Boolean).join(' - ');
    }
    if (c === '__TELEFONES') return [...new Set(COLS_TELEFONE.map((t) => fmtTelefone(get(t))).filter(Boolean))].join(' / ');
    if (c === 'NR_CNPJ') return fmtDocumento(get('NR_CNPJ'), get('TIPO_DOCUMENTO'));
    if (COLS_TELEFONE.includes(c)) return fmtTelefone(get(c));
    const v = get(c);
    if (vazio(v)) return '';
    if (v instanceof Date) return v;
    return typeof v === 'string' ? v.trim() : v;
  };
  const rotulo = (c) => ROTULOS[c] || nomeReal(c);
  const textoPrevia = (v) => (v instanceof Date ? v.toLocaleDateString('pt-BR') : typeof v === 'number' ? v.toLocaleString('pt-BR') : v);

  function descreverFiltros() {
    return ativos.map((c) => {
      const f = filtros[c.col];
      let d = '';
      if (c.tipo === 'lista') d = f.valores.join(', ');
      else if (c.tipo === 'numero') d = f.modo === 'entre' ? `de ${f.min || '...'} até ${f.max || '...'}` : f.modo === 'vazio' ? 'não tem (vazio)' : 'tem (preenchido)';
      else if (c.tipo === 'presenca') d = f.modo === 'sim' ? c.sim || 'preenchido' : c.nao || 'vazio';
      else if (c.tipo === 'debito') d = f.modo === 'com' ? 'com débito' : 'sem débito';
      else d = `contém "${f.texto}"`;
      return [c.rotulo || c.col, d];
    });
  }

  async function baixar(formato) {
    setGerando(true);
    try {
      const XLSX = await import('xlsx');
      const titulo = colunasSaida.map(rotulo);
      const paraLinhas = (rs) => rs.map((l) => colunasSaida.map((c) => valorSaida(l, c)));
      const nome = (saida.nome || 'material').replace(/[\\/:*?"<>|]+/g, '_');
      if (formato === 'csv') {
        const ws = XLSX.utils.aoa_to_sheet([titulo, ...paraLinhas(filtradas)]);
        const csv = XLSX.utils.sheet_to_csv(ws, { FS: ';' });
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = `${nome}.csv`; a.click();
        URL.revokeObjectURL(a.href);
        return;
      }
      const wb = XLSX.utils.book_new();
      const larguras = colunasSaida.map((c) => ({ wch: c === '__ENDERECO' ? 55 : c === '__TELEFONES' ? 48 : c === 'NM_CLIENTE' ? 42 : c.startsWith('EMAIL') ? 32 : 18 }));
      const usados = new Set();
      const nomeAba = (s) => {
        let n = String(s || 'Sem valor').replace(/[\\/?*:[\]]/g, ' ').slice(0, 28).trim() || 'Sem valor';
        let k = n, i = 2;
        while (usados.has(k.toLowerCase())) k = `${n.slice(0, 25)} ${i++}`;
        usados.add(k.toLowerCase());
        return k;
      };
      const addAba = (nomeA, rs) => {
        const ws = XLSX.utils.aoa_to_sheet([titulo, ...paraLinhas(rs)]);
        ws['!cols'] = larguras;
        ws['!autofilter'] = { ref: ws['!ref'] };
        XLSX.utils.book_append_sheet(wb, ws, nomeAba(nomeA));
      };
      const resumo = [['Material gerado em', new Date().toLocaleString('pt-BR')], ['Arquivo de origem', `${arq?.nome} (aba ${aba})`], ['Clientes no material', filtradas.length], [], ['Filtros usados'], ...descreverFiltros()];
      if (saida.separar === 'coluna' && col(saida.colSeparar) !== undefined) {
        const i = col(saida.colSeparar);
        const grupos = new Map();
        filtradas.forEach((l) => { const k = vazio(l[i]) ? 'Sem valor' : String(l[i]).trim(); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(l); });
        const ordem = [...grupos.entries()].sort((a, b) => b[1].length - a[1].length);
        resumo.push([], [`Separado por ${nomeReal(saida.colSeparar)}`, 'Clientes'], ...ordem.map(([k, rs]) => [k, rs.length]));
        const wsR = XLSX.utils.aoa_to_sheet(resumo); wsR['!cols'] = [{ wch: 40 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, wsR, nomeAba('Resumo'));
        ordem.forEach(([k, rs]) => addAba(k, rs));
      } else if (saida.separar === 'lotes' && Number(saida.lote) > 0) {
        const n = Number(saida.lote);
        const qtd = Math.ceil(filtradas.length / n);
        resumo.push([], [`Dividido em ${qtd} lotes de até ${n} clientes`]);
        const wsR = XLSX.utils.aoa_to_sheet(resumo); wsR['!cols'] = [{ wch: 40 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, wsR, nomeAba('Resumo'));
        for (let k = 0; k < qtd; k++) addAba(`Lote ${k + 1}`, filtradas.slice(k * n, (k + 1) * n));
      } else {
        addAba('Clientes', filtradas);
        const wsR = XLSX.utils.aoa_to_sheet(resumo); wsR['!cols'] = [{ wch: 40 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, wsR, nomeAba('Filtros usados'));
      }
      XLSX.writeFile(wb, `${nome}.xlsx`);
    } finally { setGerando(false); }
  }

  function salvarModelo() {
    const n = nomeModelo.trim();
    if (!n) return;
    guardarModelos({ ...modelos, [n]: { filtros, extras, saida } });
    setNomeModelo('');
  }
  function aplicarModelo(n) {
    const m = modelos[n];
    if (!m) return;
    setExtras(m.extras || []);
    setFiltros(m.filtros || {});
    setSaida((s) => ({ ...s, ...(m.saida || {}) }));
  }
  function excluirModelo(n) {
    const c = { ...modelos }; delete c[n]; guardarModelos(c);
  }

  const colunasOutras = cab.filter((c) => c && !campos.some((x) => chaveCol(x.col) === chaveCol(c)));

  return (
    <div className="preparador">
      <section className="bloco">
        <div className="campos">
          <label className="campo" style={{ flex: '1 1 300px' }}>Base de clientes (.xlsx, .xls ou .csv)
            <input type="file" accept=".xlsx,.xls,.csv" onChange={abrir} disabled={lendo} />
          </label>
          {arq && arq.abas.length > 1 && (
            <label className="campo">Aba
              <select value={aba} onChange={(e) => carregarAba(arq.wb, e.target.value)}>
                {arq.abas.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          )}
        </div>
        {lendo && <p className="dica" style={{ marginTop: 8 }}>Lendo a planilha... arquivos grandes podem levar alguns segundos.</p>}
        {erro && <p className="msg msg-erro">{erro}</p>}
        {arq && !lendo && <p className="dica" style={{ marginTop: 8 }}>{arq.nome}: {fmtN(linhas.length)} linhas e {cab.filter(Boolean).length} colunas. Tudo é processado no seu computador; nada é enviado ao servidor.</p>}
      </section>

      {linhas.length > 0 && (
        <>
          <div className="prep-contador">
            <b>{fmtN(filtradas.length)}</b> de {fmtN(linhas.length)} clientes atendem aos filtros
            {ativos.length > 0 && <button type="button" className="lt-apagar" onClick={() => setFiltros({})}>limpar todos os filtros</button>}
          </div>

          <section className="secao">
            <div className="linha-acoes" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <h2>Filtros</h2>
              <div className="linha-acoes">
                {Object.keys(modelos).length > 0 && (
                  <select defaultValue="" onChange={(e) => { aplicarModelo(e.target.value); e.target.value = ''; }} aria-label="Usar um filtro salvo">
                    <option value="" disabled>Usar filtro salvo...</option>
                    {Object.keys(modelos).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                )}
                <input type="text" placeholder="Nome para salvar este filtro" value={nomeModelo} onChange={(e) => setNomeModelo(e.target.value)} style={{ width: 220 }} />
                <button type="button" className="btn btn-sec btn-peq" onClick={salvarModelo} disabled={!nomeModelo.trim()}>Salvar filtro</button>
              </div>
            </div>
            {Object.keys(modelos).length > 0 && (
              <p className="dica" style={{ marginBottom: 8 }}>Filtros salvos neste navegador: {Object.keys(modelos).map((n) => <span key={n} className="tag" style={{ marginRight: 4 }}>{n} <button type="button" className="lt-apagar" onClick={() => excluirModelo(n)} aria-label={`Excluir ${n}`}>×</button></span>)}</p>
            )}
            <div className="prep-grade">
              {campos.map((c) => {
                const f = filtros[c.col] || { tipo: c.tipo };
                const on = filtroAtivo(filtros[c.col]);
                return (
                  <div key={c.col} className={`prep-filtro${on ? ' ativo' : ''}`}>
                    <div className="prep-filtro-cab">
                      <strong>{c.rotulo}</strong>
                      {c.extra && <button type="button" className="lt-apagar" onClick={() => { setExtras((x) => x.filter((y) => y !== c.col)); setFiltros((x) => { const n = { ...x }; delete n[c.col]; return n; }); }}>remover</button>}
                    </div>
                    {c.tipo === 'lista' && <FiltroLista f={f} opcoes={opcoesDe[c.col] || []} mudar={(p) => mudarFiltro(c, p)} />}
                    {c.tipo === 'numero' && <FiltroNumero f={f} mudar={(p) => mudarFiltro(c, p)} />}
                    {c.tipo === 'presenca' && <FiltroModo f={f} mudar={(p) => mudarFiltro(c, p)} opcoes={[['qualquer', 'Qualquer'], ['sim', c.sim || 'Preenchido'], ['nao', c.nao || 'Vazio']]} />}
                    {c.tipo === 'debito' && <FiltroModo f={f} mudar={(p) => mudarFiltro(c, p)} opcoes={[['qualquer', 'Qualquer'], ['com', 'Com débito'], ['sem', 'Sem débito']]} />}
                    {c.tipo === 'texto' && <input type="text" placeholder="contém..." value={f.texto || ''} onChange={(e) => mudarFiltro(c, { texto: e.target.value })} />}
                  </div>
                );
              })}
              {colunasOutras.length > 0 && (
                <div className="prep-filtro prep-mais">
                  <strong>+ Filtrar por outra coluna</strong>
                  <select defaultValue="" onChange={(e) => { if (e.target.value) setExtras((x) => [...x, e.target.value]); e.target.value = ''; }}>
                    <option value="">Escolha a coluna</option>
                    {colunasOutras.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
            </div>
          </section>

          <section className="secao">
            <h2 style={{ marginBottom: 8 }}>Material</h2>
            <div className="bloco">
              <h3 style={{ marginBottom: 6 }}>Colunas</h3>
              <div className="prep-colunas">
                {disponiveisSaida.map((c) => (
                  <label key={c} className="check">
                    <input type="checkbox" checked={escolhidas.includes(c)} onChange={() => setSaida((s) => {
                      const atual = s.escolhidas || disponiveisSaida;
                      return { ...s, escolhidas: atual.includes(c) ? atual.filter((x) => x !== c) : [...atual, c] };
                    })} />
                    {rotulo(c)}
                  </label>
                ))}
              </div>
              <div className="campos" style={{ marginTop: 10 }}>
                <label className="check"><input type="checkbox" checked={saida.juntarTelefones} onChange={(e) => setSaida((s) => ({ ...s, juntarTelefones: e.target.checked }))} /> Juntar todos os telefones numa coluna só (sem repetidos)</label>
                <label className="check"><input type="checkbox" checked={saida.incluirFiltros} onChange={(e) => setSaida((s) => ({ ...s, incluirFiltros: e.target.checked }))} /> Incluir as colunas usadas nos filtros</label>
              </div>
              <h3 style={{ margin: '14px 0 6px' }}>Separar</h3>
              <div className="campos">
                <label className="check"><input type="radio" checked={saida.separar === 'nao'} onChange={() => setSaida((s) => ({ ...s, separar: 'nao' }))} /> Tudo numa aba</label>
                <label className="check"><input type="radio" checked={saida.separar === 'coluna'} onChange={() => setSaida((s) => ({ ...s, separar: 'coluna' }))} /> Uma aba para cada</label>
                {saida.separar === 'coluna' && (
                  <select value={saida.colSeparar} onChange={(e) => setSaida((s) => ({ ...s, colSeparar: e.target.value }))} aria-label="Separar por">
                    {cab.filter(Boolean).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
                <label className="check"><input type="radio" checked={saida.separar === 'lotes'} onChange={() => setSaida((s) => ({ ...s, separar: 'lotes' }))} /> Lotes de</label>
                {saida.separar === 'lotes' && <input type="number" min="1" value={saida.lote} onChange={(e) => setSaida((s) => ({ ...s, lote: e.target.value }))} style={{ width: 90 }} aria-label="Clientes por lote" />}
                {saida.separar === 'lotes' && <span className="dica">clientes</span>}
              </div>
              <div className="campos" style={{ marginTop: 14 }}>
                <label className="campo">Nome do arquivo<input type="text" value={saida.nome} onChange={(e) => setSaida((s) => ({ ...s, nome: e.target.value }))} /></label>
                <button type="button" className="btn" disabled={!filtradas.length || gerando} onClick={() => baixar('xlsx')}>{gerando ? 'Gerando…' : `Baixar Excel (${fmtN(filtradas.length)})`}</button>
                <button type="button" className="btn btn-sec" disabled={!filtradas.length || gerando || saida.separar !== 'nao'} onClick={() => baixar('csv')} title={saida.separar !== 'nao' ? 'CSV só sem separação' : ''}>Baixar CSV</button>
              </div>
            </div>
          </section>

          <section className="secao">
            <h2 style={{ marginBottom: 8 }}>Prévia {filtradas.length > 30 && <span className="dica">(primeiras 30 linhas)</span>}</h2>
            <div className="tabela-wrap">
              <table>
                <thead><tr>{colunasSaida.map((c) => <th key={c} className="esq">{rotulo(c)}</th>)}</tr></thead>
                <tbody>
                  {filtradas.slice(0, 30).map((l, i) => (
                    <tr key={i}>{colunasSaida.map((c) => <td key={c} className="esq">{textoPrevia(valorSaida(l, c))}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
