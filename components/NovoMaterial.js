'use client';
import { useMemo, useState } from 'react';
import { documentoDaVenda } from '@/lib/fontes';
import { normalizar } from '@/lib/nomes';
import RegistrarMaterial from './RegistrarMaterial';

const fmtN = (n) => Number(n).toLocaleString('pt-BR');
const NOMES_CNPJ = ['cnpj', 'nr cnpj', 'cpf cnpj', 'cnpj cpf', 'cpf', 'documento', 'nr documento', 'cnpj cliente'];
const NOMES_DEST = ['consultor', 'consultor venda', 'vendedor', 'responsavel', 'destinatario'];
const ABAS_IGNORAR = ['resumo', 'filtros usados'];

// leitura das linhas -> leads válidos, sem repetidos
function montarLeads(registros) {
  const vistos = new Set();
  const leads = [];
  let invalidos = 0, repetidos = 0, vazios = 0;
  for (const { doc, destinatario } of registros) {
    if (doc === null || doc === undefined || String(doc).trim() === '') { vazios++; continue; }
    const d = documentoDaVenda(doc);
    if (!d.valido) { invalidos++; continue; }
    if (vistos.has(d.cnpj)) { repetidos++; continue; }
    vistos.add(d.cnpj);
    leads.push({ cnpj: d.cnpj, destinatario: destinatario ? String(destinatario).trim() : null });
  }
  return { leads, invalidos, repetidos, vazios };
}

// melhor coluna de CNPJ: pelo nome do cabeçalho ou pela que tem mais documentos válidos
function acharColunaDoc(cab, linhas) {
  const porNome = cab.findIndex((c) => NOMES_CNPJ.includes(normalizar(c).trim()));
  if (porNome >= 0) return porNome;
  let melhor = -1, max = 0;
  cab.forEach((_, i) => {
    const n = linhas.slice(0, 200).filter((l) => documentoDaVenda(l[i]).valido).length;
    if (n > max) { max = n; melhor = i; }
  });
  return melhor;
}

export default function NovoMaterial({ grupos, produtos = [], materialId = null }) {
  const [modo, setModo] = useState('planilha');
  const [arq, setArq] = useState(null); // { nome, abas: { nome: linhas[][] } }
  const [aba, setAba] = useState('');
  const [colDoc, setColDoc] = useState(-1);
  const [colDest, setColDest] = useState(-1);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const [lendo, setLendo] = useState(false);

  async function abrir(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setErro(''); setLendo(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', raw: true });
      const abas = {};
      wb.SheetNames.forEach((n) => { abas[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: false }); });
      const uteis = wb.SheetNames.filter((n) => !ABAS_IGNORAR.includes(normalizar(n).trim()));
      const inicial = uteis.length > 1 ? '__todas' : uteis[0] || wb.SheetNames[0];
      setArq({ nome: f.name, abas, uteis });
      escolherAba(inicial, abas, uteis);
    } catch {
      setErro('Não consegui ler o arquivo. Use Excel (.xlsx) ou CSV.');
    } finally { setLendo(false); }
  }

  function escolherAba(nome, abas = arq?.abas, uteis = arq?.uteis) {
    setAba(nome);
    const base = abas?.[nome === '__todas' ? uteis[0] : nome] || [];
    const cab = (base[0] || []).map((c) => String(c ?? ''));
    setColDoc(acharColunaDoc(cab, base.slice(1)));
    setColDest(nome === '__todas' ? -1 : cab.findIndex((c) => NOMES_DEST.includes(normalizar(c).trim())));
  }

  const cab = useMemo(() => {
    if (!arq) return [];
    const base = arq.abas[aba === '__todas' ? arq.uteis[0] : aba] || [];
    return (base[0] || []).map((c, i) => String(c ?? '') || `Coluna ${i + 1}`);
  }, [arq, aba]);

  const resultado = useMemo(() => {
    if (modo === 'colar') {
      const partes = texto.split(/[\n;,\t]+/).map((s) => s.trim()).filter(Boolean);
      return montarLeads(partes.map((doc) => ({ doc, destinatario: null })));
    }
    if (!arq || colDoc < 0) return null;
    const registros = [];
    const nomes = aba === '__todas' ? arq.uteis : [aba];
    for (const n of nomes) {
      for (const l of (arq.abas[n] || []).slice(1)) {
        registros.push({ doc: l[colDoc], destinatario: aba === '__todas' ? n : colDest >= 0 ? l[colDest] : null });
      }
    }
    return montarLeads(registros);
  }, [modo, texto, arq, aba, colDoc, colDest]);

  const porDest = useMemo(() => {
    const m = new Map();
    (resultado?.leads || []).forEach((l) => { if (l.destinatario) m.set(l.destinatario, (m.get(l.destinatario) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [resultado]);

  return (
    <div>
      <div className="alternar-visao" style={{ marginBottom: 10 }}>
        <button type="button" className={modo === 'planilha' ? 'ativo' : ''} onClick={() => setModo('planilha')}>Subir planilha</button>
        <button type="button" className={modo === 'colar' ? 'ativo' : ''} onClick={() => setModo('colar')}>Colar CNPJs</button>
      </div>

      {modo === 'planilha' ? (
        <>
          <div className="campos">
            <label className="campo">Arquivo (Excel ou CSV)<input type="file" accept=".xlsx,.xls,.csv" onChange={abrir} /></label>
            {arq && (
              <label className="campo">Aba
                <select value={aba} onChange={(e) => escolherAba(e.target.value)}>
                  {arq.uteis.length > 1 && <option value="__todas">Todas as abas (nome da aba = destinatário)</option>}
                  {Object.keys(arq.abas).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            )}
            {arq && (
              <label className="campo">Coluna do CNPJ
                <select value={colDoc} onChange={(e) => setColDoc(Number(e.target.value))}>
                  <option value={-1}>Escolha…</option>
                  {cab.map((c, i) => <option key={i} value={i}>{c}</option>)}
                </select>
              </label>
            )}
            {arq && aba !== '__todas' && (
              <label className="campo">Destinatário (opcional)
                <select value={colDest} onChange={(e) => setColDest(Number(e.target.value))}>
                  <option value={-1}>Nenhum</option>
                  {cab.map((c, i) => <option key={i} value={i}>{c}</option>)}
                </select>
              </label>
            )}
          </div>
          {lendo && <p className="dica">Lendo o arquivo…</p>}
          {erro && <p className="msg msg-erro">{erro}</p>}
        </>
      ) : (
        <label className="campo" style={{ display: 'block' }}>CNPJs (um por linha; pode ser com ou sem pontuação)
          <textarea rows={8} value={texto} onChange={(e) => setTexto(e.target.value)} style={{ width: '100%' }} placeholder={'12.345.678/0001-90\n98765432000110'} />
        </label>
      )}

      {resultado && (
        <>
          <p className="dica" style={{ marginTop: 8 }}>
            <b>{fmtN(resultado.leads.length)} leads válidos</b>
            {resultado.repetidos ? `, ${fmtN(resultado.repetidos)} repetidos` : ''}
            {resultado.invalidos ? <>, <b style={{ color: 'var(--risco)' }}>{fmtN(resultado.invalidos)} inválidos</b></> : ''}
            {resultado.vazios && modo === 'planilha' ? `, ${fmtN(resultado.vazios)} linhas sem CNPJ` : ''}. Repetidos e inválidos não entram.
          </p>
          {porDest.length > 0 && (
            <p className="dica">Por destinatário: {porDest.slice(0, 12).map(([d, n]) => `${d} (${fmtN(n)})`).join(' · ')}{porDest.length > 12 ? ` e mais ${porDest.length - 12}` : ''}</p>
          )}
          {resultado.leads.length > 0 && (
            <RegistrarMaterial
              key={`${modo}-${aba}-${colDoc}-${colDest}-${resultado.leads.length}`}
              leads={resultado.leads}
              grupos={grupos}
              produtos={produtos}
              origem={modo === 'colar' ? 'manual' : 'planilha'}
              materialId={materialId}
              nomePadrao={arq?.nome?.replace(/\.[^.]+$/, '') || ''}
            />
          )}
        </>
      )}
    </div>
  );
}
