'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { normalizar } from '@/lib/nomes';
import { importarParceiros, concluirImportacaoParceiros } from '@/app/actions/indireto';

const fmtN = (n) => Number(n).toLocaleString('pt-BR');
const BLOCO = 500;
// colunas reconhecidas pelo cabeçalho (sem acento, minúsculo)
const CAMPOS = [
  { k: 'nome', rotulo: 'Nome', nomes: ['nome', 'parceiro', 'nome fantasia', 'razao social', 'nome parceiro', 'consultor'] },
  { k: 'documento', rotulo: 'CPF/CNPJ', nomes: ['cnpj', 'cpf', 'cpf cnpj', 'cnpj cpf', 'documento', 'doc'] },
  { k: 'email', rotulo: 'E-mail', nomes: ['email', 'e mail'] },
  { k: 'telefone', rotulo: 'Telefone', nomes: ['telefone', 'celular', 'whatsapp', 'fone', 'contato'] },
  { k: 'cidade', rotulo: 'Cidade', nomes: ['cidade', 'municipio'] },
  { k: 'uf', rotulo: 'UF', nomes: ['uf', 'estado'] },
  { k: 'observacoes', rotulo: 'Observações', nomes: ['observacao', 'observacoes', 'obs'] },
];

export default function ImportarParceiros({ focais = [], statusLista = [] }) {
  const [modo, setModo] = useState('planilha');
  const [arq, setArq] = useState(null); // { nome, abas: { nome: linhas[][] } }
  const [aba, setAba] = useState('');
  const [cols, setCols] = useState({});
  const [texto, setTexto] = useState('');
  const [config, setConfig] = useState({ status: statusLista.find((s) => s.ativo)?.chave || '', ponto_focal_id: '', data_ativacao: '' });
  const [estado, setEstado] = useState({ rodando: false, feitos: 0, erro: '', fim: null });
  const [erroArq, setErroArq] = useState('');

  async function abrir(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setErroArq('');
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', raw: true });
      const abas = {};
      wb.SheetNames.forEach((n) => { abas[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: false }); });
      setArq({ nome: f.name, abas });
      escolherAba(wb.SheetNames[0], abas);
    } catch { setErroArq('Não consegui ler o arquivo. Use Excel (.xlsx) ou CSV.'); }
  }
  function escolherAba(nome, abas = arq?.abas) {
    setAba(nome);
    const cab = ((abas?.[nome] || [])[0] || []).map((c) => normalizar(String(c ?? '')).trim());
    const achadas = {};
    CAMPOS.forEach((c) => { achadas[c.k] = cab.findIndex((h) => c.nomes.includes(h)); });
    if (achadas.nome < 0) achadas.nome = 0;
    setCols(achadas);
    setEstado({ rodando: false, feitos: 0, erro: '', fim: null });
  }
  const cab = arq ? ((arq.abas[aba] || [])[0] || []).map((c, i) => String(c ?? '') || `Coluna ${i + 1}`) : [];

  // linhas -> parceiros (sem repetidos dentro da lista)
  const lista = useMemo(() => {
    let brutos = [];
    if (modo === 'colar') {
      brutos = texto.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
        const [nome, documento] = l.split(/\t|;/).map((x) => x?.trim());
        return { nome, documento };
      });
    } else if (arq) {
      brutos = (arq.abas[aba] || []).slice(1).map((l) => {
        const o = {};
        CAMPOS.forEach((c) => { if (cols[c.k] >= 0) o[c.k] = l[cols[c.k]] == null ? '' : String(l[cols[c.k]]).trim(); });
        return o;
      });
    }
    const vistos = new Set();
    const itens = [];
    let repetidos = 0;
    brutos.forEach((b) => {
      if (!b.nome) return;
      const k = normalizar(b.nome);
      if (vistos.has(k)) { repetidos++; return; }
      vistos.add(k);
      itens.push(b);
    });
    return { itens, repetidos, comDoc: itens.filter((i) => String(i.documento || '').replace(/\D/g, '')).length };
  }, [modo, texto, arq, aba, cols]);

  async function importar() {
    setEstado({ rodando: true, feitos: 0, erro: '', fim: null });
    const tot = { inseridos: 0, pulados: [], docInvalido: 0 };
    for (let i = 0; i < lista.itens.length; i += BLOCO) {
      const r = await importarParceiros(lista.itens.slice(i, i + BLOCO), config);
      if (r.erro) return setEstado({ rodando: false, feitos: i, erro: `${r.erro}${tot.inseridos ? ` (${fmtN(tot.inseridos)} já importados)` : ''}`, fim: null });
      tot.inseridos += r.inseridos; tot.pulados.push(...r.pulados); tot.docInvalido += r.docInvalido;
      setEstado((e) => ({ ...e, feitos: Math.min(i + BLOCO, lista.itens.length) }));
    }
    await concluirImportacaoParceiros();
    setEstado({ rodando: false, feitos: lista.itens.length, erro: '', fim: tot });
  }

  const ativosStatus = statusLista.filter((s) => s.ativo);
  return (
    <div>
      <div className="alternar-visao" style={{ marginBottom: 10 }}>
        <button type="button" className={modo === 'planilha' ? 'ativo' : ''} onClick={() => setModo('planilha')}>Subir planilha</button>
        <button type="button" className={modo === 'colar' ? 'ativo' : ''} onClick={() => setModo('colar')}>Colar lista</button>
      </div>

      {modo === 'planilha' ? (
        <>
          <div className="campos">
            <label className="campo">Arquivo (Excel ou CSV)<input type="file" accept=".xlsx,.xls,.csv" onChange={abrir} /></label>
            {arq && Object.keys(arq.abas).length > 1 && (
              <label className="campo">Aba
                <select value={aba} onChange={(e) => escolherAba(e.target.value)}>
                  {Object.keys(arq.abas).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            )}
          </div>
          {erroArq && <p className="msg msg-erro">{erroArq}</p>}
          {arq && (
            <div className="campos" style={{ marginTop: 8 }}>
              {CAMPOS.map((c) => (
                <label key={c.k} className="campo">Coluna: {c.rotulo}{c.k === 'nome' ? ' *' : ''}
                  <select value={cols[c.k] ?? -1} onChange={(e) => setCols((x) => ({ ...x, [c.k]: Number(e.target.value) }))}>
                    {c.k !== 'nome' && <option value={-1}>Não tem</option>}
                    {cab.map((h, i) => <option key={i} value={i}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>
          )}
        </>
      ) : (
        <label className="campo" style={{ display: 'block' }}>Um parceiro por linha: nome, ou nome e CPF/CNPJ separados por ponto e vírgula (ou colados do Excel)
          <textarea rows={8} value={texto} onChange={(e) => setTexto(e.target.value)} style={{ width: '100%' }} placeholder={'MARIA DA SILVA;123.456.789-09\nJOÃO SOUZA\nEMPRESA X LTDA;12.345.678/0001-90'} />
        </label>
      )}

      {lista.itens.length > 0 && !estado.fim && (
        <div className="bloco" style={{ marginTop: 12 }}>
          <p className="dica" style={{ marginBottom: 8 }}>
            <b>{fmtN(lista.itens.length)} parceiros</b> na lista ({fmtN(lista.comDoc)} com CPF/CNPJ)
            {lista.repetidos ? `, ${fmtN(lista.repetidos)} nomes repetidos ignorados` : ''}.
            Quem já está cadastrado (mesmo CPF/CNPJ ou mesmo nome) é pulado.
            Prévia: {lista.itens.slice(0, 5).map((i) => i.nome).join(', ')}{lista.itens.length > 5 ? '…' : ''}
          </p>
          <div className="campos">
            <label className="campo">Status de todos *
              <select value={config.status} onChange={(e) => setConfig((c) => ({ ...c, status: e.target.value }))}>
                {ativosStatus.map((s) => <option key={s.chave} value={s.chave}>{s.nome}</option>)}
              </select>
            </label>
            <label className="campo">Ponto focal (quem vai cuidar)
              <select value={config.ponto_focal_id} onChange={(e) => setConfig((c) => ({ ...c, ponto_focal_id: e.target.value }))}>
                <option value="">Sem ponto focal</option>
                {focais.map((f) => <option key={f.id} value={f.id}>{f.nome || f.usuario}</option>)}
              </select>
            </label>
            <label className="campo">Data de ativação
              <input type="date" value={config.data_ativacao} onChange={(e) => setConfig((c) => ({ ...c, data_ativacao: e.target.value }))} />
              {config.status === 'ativo' && !config.data_ativacao && <span className="nome-sub">vazio = hoje</span>}
            </label>
            <button type="button" className="btn" disabled={estado.rodando || !config.status} onClick={importar}>
              {estado.rodando ? `Importando… ${fmtN(estado.feitos)} de ${fmtN(lista.itens.length)}` : `Importar ${fmtN(lista.itens.length)} parceiros`}
            </button>
          </div>
          {estado.erro && <p className="msg msg-erro" role="alert">{estado.erro}</p>}
        </div>
      )}

      {estado.fim && (
        <div className="msg msg-ok" style={{ marginTop: 12 }}>
          <b>{fmtN(estado.fim.inseridos)} parceiros importados.</b>
          {estado.fim.docInvalido > 0 && ` ${fmtN(estado.fim.docInvalido)} entraram sem CPF/CNPJ porque o número era inválido (o número ficou nas observações).`}
          {estado.fim.pulados.length > 0 && (
            <> {fmtN(estado.fim.pulados.length)} já estavam cadastrados e foram pulados: {estado.fim.pulados.slice(0, 15).join(', ')}{estado.fim.pulados.length > 15 ? '…' : ''}.</>
          )}{' '}
          <Link href="/indireto">Ver a lista de parceiros</Link>
        </div>
      )}
    </div>
  );
}
