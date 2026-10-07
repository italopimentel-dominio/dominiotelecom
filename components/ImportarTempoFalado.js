'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { lerCsv, tipoDoArquivo, lerLeadsBuilder, ler3C, lerPonto, consolidar, hms } from '@/lib/tempoFalado';
import { normalizar } from '@/lib/nomes';
import { salvarTempoFalado } from '@/app/actions/tempoFalado';

const ROTULO = { leadsbuilder: 'LeadsBuilder', '3c': '3C', ponto: 'Folha de ponto' };

export default function ImportarTempoFalado({ mesPadrao, colaboradores = [], apelidos = [] }) {
  const router = useRouter();
  const [mes, setMes] = useState(mesPadrao);
  const [arquivos, setArquivos] = useState([]); // { nome, tipo, dados, empresa }
  const [vinculos, setVinculos] = useState({}); // chave do nome -> colaborador_id
  const [estado, setEstado] = useState({ lendo: false, salvando: false, erro: '', ok: '' });
  const mapaApelidos = useMemo(() => new Map(apelidos.map((a) => [a.apelido, a.colaborador_id])), [apelidos]);
  const colabOrdenados = useMemo(() => [...colaboradores].sort((a, b) => a.nome.localeCompare(b.nome)), [colaboradores]);

  async function adicionar(e) {
    const lista = [...(e.target.files || [])];
    e.target.value = '';
    if (!lista.length) return;
    setEstado((s) => ({ ...s, lendo: true, erro: '', ok: '' }));
    const XLSX = await import('xlsx');
    const novos = [];
    for (const f of lista) {
      try {
        let linhas;
        if (/\.csv$/i.test(f.name)) linhas = lerCsv(await f.text());
        else {
          const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
          linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
        }
        const tipo = tipoDoArquivo(linhas);
        if (!tipo) { novos.push({ nome: f.name, tipo: null }); continue; }
        const empresa = f.name.replace(/\.[^.]+$/, '').replace(/presentes?/i, '').trim() || f.name;
        const dados = tipo === 'leadsbuilder' ? lerLeadsBuilder(linhas) : tipo === '3c' ? ler3C(linhas) : lerPonto(linhas, empresa);
        novos.push({ nome: f.name, tipo, dados, empresa });
      } catch { novos.push({ nome: f.name, tipo: null }); }
    }
    setArquivos((a) => [...a.filter((x) => !novos.some((n) => n.nome === x.nome)), ...novos]);
    setEstado((s) => ({ ...s, lendo: false }));
  }

  const resultado = useMemo(() => {
    const de = (t) => arquivos.filter((a) => a.tipo === t).flatMap((a) => a.dados);
    if (!arquivos.some((a) => a.tipo === 'leadsbuilder' || a.tipo === '3c')) return null;
    return consolidar({
      lb: de('leadsbuilder'), c3: de('3c'), ponto: de('ponto'), colaboradores, apelidos: mapaApelidos,
      vinculos: new Map(Object.entries(vinculos).filter(([, v]) => v)),
    });
  }, [arquivos, colaboradores, mapaApelidos, vinculos]);

  async function gravar() {
    setEstado((s) => ({ ...s, salvando: true, erro: '', ok: '' }));
    const novosApelidos = Object.entries(vinculos).filter(([, id]) => id).flatMap(([k, id]) => {
      const l = resultado.linhas.find((x) => x.colaborador_id === id);
      return [{ apelido: k, colaborador_id: id }, ...(l?.nomesOrigem || []).map((n) => ({ apelido: normalizar(n), colaborador_id: id }))];
    });
    const r = await salvarTempoFalado(mes, resultado.linhas, novosApelidos);
    setEstado((s) => ({ ...s, salvando: false, erro: r.erro || '', ok: r.ok || '' }));
    if (r.ok) { setArquivos([]); setVinculos({}); router.push(`/tempo-falado?mes=${mes}`); router.refresh(); }
  }

  const chaveNome = (nome) => normalizar(nome).replace(/[0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  return (
    <div>
      <div className="campos">
        <label className="campo">Mês<input type="month" value={mes} onChange={(e) => setMes(e.target.value)} /></label>
        <label className="campo" style={{ flex: '2 1 320px' }}>Relatórios do mês (pode selecionar vários de uma vez)
          <input type="file" multiple accept=".csv,.xlsx,.xls" onChange={adicionar} />
        </label>
      </div>
      <p className="dica" style={{ marginTop: 6 }}>
        Suba do jeito que saem dos sistemas: o CSV do LeadsBuilder, o CSV do 3C e as folhas de ponto de presentes (uma por CNPJ).
        O tipo de cada arquivo é reconhecido sozinho. 3C: Falando = speaking + MTPA (manual_acw) + manual.
      </p>
      {estado.lendo && <p className="dica">Lendo…</p>}
      {arquivos.length > 0 && (
        <ul className="dica" style={{ margin: '8px 0 0 18px' }}>
          {arquivos.map((a) => (
            <li key={a.nome}>
              {a.nome}: {a.tipo ? <b>{ROTULO[a.tipo]}{a.tipo === 'ponto' ? ` (${a.empresa})` : ''}</b> : <b style={{ color: 'var(--risco)' }}>não reconhecido</b>}
              {a.tipo && ` · ${a.dados.length} ${a.tipo === 'ponto' ? 'pessoas' : 'operadores'}`}{' '}
              <button type="button" className="link-acao" onClick={() => setArquivos((x) => x.filter((y) => y.nome !== a.nome))}>tirar</button>
            </li>
          ))}
        </ul>
      )}

      {resultado && (
        <>
          {resultado.naoVinculados.length > 0 && (
            <div className="bloco" style={{ marginTop: 12 }}>
              <b>Nomes que não reconheci ({resultado.naoVinculados.length})</b>
              <p className="dica" style={{ margin: '4px 0 8px' }}>Escolha o colaborador cadastrado. O sistema guarda e reconhece sozinho nos próximos meses. Quem ficar sem vínculo entra no relatório com o nome do discador.</p>
              {resultado.naoVinculados.map((l) => {
                const k = chaveNome(l.nomesOrigem[0] || l.nome);
                return (
                  <div key={l.chave} className="campos" style={{ alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ minWidth: 260 }}>{l.nomesOrigem.join(' / ')} <span className="dica">({hms(l.falando)})</span></span>
                    <select value={vinculos[k] || ''} onChange={(e) => setVinculos((v) => ({ ...v, [k]: e.target.value }))}>
                      <option value="">Sem vínculo</option>
                      {colabOrdenados.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          )}

          <p className="dica" style={{ marginTop: 10 }}>
            Prévia: <b>{resultado.linhas.length} pessoas</b>
            {!arquivos.some((a) => a.tipo === 'ponto') && <b style={{ color: 'var(--risco)' }}> · falta a folha de ponto (dias trabalhados)</b>}
            {resultado.semDiscador.length > 0 && ` · ${resultado.semDiscador.length} pessoas do ponto sem tempo nos discadores (normal para administrativo)`}.
          </p>
          <div className="tabela-wrap tabela-fixa" style={{ maxHeight: 360 }}>
            <table>
              <thead><tr><th>Consultor</th><th>Falando</th><th>TMA</th><th>Dias</th><th>Média/dia</th><th className="esq">Alertas</th></tr></thead>
              <tbody>
                {resultado.linhas.map((l) => (
                  <tr key={l.chave}>
                    <td>{l.nome}</td><td>{hms(l.falando)}</td><td>{hms(l.tma)}</td><td>{l.dias}</td><td>{hms(l.media)}</td>
                    <td className="esq">{l.alertas.map((a) => <span key={a} className="tag tag-atencao" style={{ marginRight: 4 }}>{a}</span>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn" style={{ marginTop: 10 }} disabled={estado.salvando || !mes} onClick={gravar}>
            {estado.salvando ? 'Gravando…' : `Gravar ${mes.slice(5)}/${mes.slice(0, 4)} (substitui o que houver deste mês)`}
          </button>
        </>
      )}
      {estado.erro && <p className="msg msg-erro" role="alert">{estado.erro}</p>}
      {estado.ok && <p className="msg msg-ok">{estado.ok}</p>}
    </div>
  );
}
