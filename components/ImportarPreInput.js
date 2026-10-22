'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { dataHoraIso } from '@/lib/preInput';
import { importarMovimentosPreInput, importarItensPreInput, concluirImportacaoPreInput } from '@/app/actions/preInput';

const fmtN = (n) => Number(n).toLocaleString('pt-BR');
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

// Lê as exportações do CRM (Movimentação e Produção), reconhecendo cada uma pelo cabeçalho.
function lerArquivo(linhas) {
  const cab = (linhas[0] || []).map(norm);
  const i = (n) => cab.indexOf(n);
  if (i('DESCRICAO') >= 0 && i('DATA HORA') >= 0 && i('NUMERO') >= 0) {
    const regs = [];
    let semData = 0;
    linhas.slice(1).forEach((l) => {
      const d = String(l[i('DESCRICAO')] ?? '').trim();
      const m = d.match(/^movimentado para\s+(.+)$/i);
      if (!m) return;
      const dh = dataHoraIso(l[i('DATA HORA')]);
      if (!dh) { semData++; return; }
      regs.push({ neo: String(l[i('NUMERO')] ?? '').trim(), data_hora: dh, fila: m[1].trim(), usuario: l[i('NOME USUARIO')] ?? null });
    });
    return { tipo: 'movimentacao', regs, semData, pedidos: new Set(regs.map((r) => r.neo)).size };
  }
  if (i('NUMERO ATIVIDADE') >= 0 && i('GRUPO') >= 0) {
    const regs = linhas.slice(1).filter((l) => l[i('NUMERO ATIVIDADE')]).map((l) => ({
      neo: String(l[i('NUMERO ATIVIDADE')]).trim(), item: i('ITEM') >= 0 ? l[i('ITEM')] ?? '' : '', grupo: l[i('GRUPO')],
      produto: i('PRODUTO') >= 0 ? l[i('PRODUTO')] ?? '' : '', qtd: i('QUANTIDADE') >= 0 ? Number(String(l[i('QUANTIDADE')] ?? '1').replace(',', '.')) || 1 : 1,
    }));
    return { tipo: 'producao', regs, pedidos: new Set(regs.map((r) => r.neo)).size };
  }
  return { tipo: null, regs: [] };
}

export default function ImportarPreInput() {
  const router = useRouter();
  const [arquivos, setArquivos] = useState([]);
  const [estado, setEstado] = useState({ gravando: false, feitos: 0, total: 0, erro: '', ok: '' });

  async function adicionar(e) {
    const lista = [...(e.target.files || [])];
    e.target.value = '';
    const XLSX = await import('xlsx');
    const novos = [];
    for (const f of lista) {
      try {
        const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', raw: true });
        const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: null });
        novos.push({ nome: f.name, ...lerArquivo(linhas) });
      } catch { novos.push({ nome: f.name, tipo: null, regs: [] }); }
    }
    setArquivos((a) => [...a.filter((x) => !novos.some((n) => n.nome === x.nome)), ...novos]);
    setEstado({ gravando: false, feitos: 0, total: 0, erro: '', ok: '' });
  }

  async function gravar() {
    const validos = arquivos.filter((a) => a.tipo);
    const total = validos.reduce((s, a) => s + a.regs.length, 0);
    setEstado({ gravando: true, feitos: 0, total, erro: '', ok: '' });
    let feitos = 0;
    for (const a of validos) {
      const fn = a.tipo === 'movimentacao' ? importarMovimentosPreInput : importarItensPreInput;
      // produção: manda os produtos de um mesmo pedido juntos (a gravação troca os produtos por pedido)
      const regs = a.tipo === 'producao' ? [...a.regs].sort((x, y) => x.neo.localeCompare(y.neo)) : a.regs;
      for (let i = 0; i < regs.length; i += 2500) {
        let fim = Math.min(i + 2500, regs.length);
        while (a.tipo === 'producao' && fim < regs.length && regs[fim].neo === regs[fim - 1].neo) fim++;
        const r = await fn(regs.slice(i, fim));
        if (r.erro) return setEstado((e) => ({ ...e, gravando: false, erro: r.erro }));
        feitos += fim - i;
        setEstado((e) => ({ ...e, feitos }));
        i = fim - 2500;
      }
    }
    await concluirImportacaoPreInput();
    setArquivos([]);
    setEstado({ gravando: false, feitos: 0, total: 0, erro: '', ok: `${fmtN(total)} linhas gravadas. Os números foram atualizados.` });
    router.refresh();
  }

  const mov = arquivos.filter((a) => a.tipo === 'movimentacao');
  const prod = arquivos.filter((a) => a.tipo === 'producao');
  return (
    <div>
      <label className="campo">Exportações do CRM (Movimentação e/ou Produção, Excel)
        <input type="file" multiple accept=".xlsx,.xls,.csv" onChange={adicionar} />
      </label>
      <p className="dica" style={{ marginTop: 4 }}>
        Pode subir os dois juntos, quantas vezes quiser por dia. Da <b>Movimentação</b> entram só as linhas “Movimentado para…”, e a mesma linha subida de novo não duplica.
        Da <b>Produção</b>, os produtos de cada pedido são trocados pelos do arquivo mais novo.
      </p>
      {arquivos.length > 0 && (
        <>
          <ul className="dica" style={{ margin: '6px 0 0 18px' }}>
            {arquivos.map((a) => (
              <li key={a.nome}>{a.nome}: {a.tipo === 'movimentacao' ? `Movimentação · ${fmtN(a.regs.length)} movimentações de ${fmtN(a.pedidos)} pedidos${a.semData ? ` (${a.semData} sem data, ignoradas)` : ''}`
                : a.tipo === 'producao' ? `Produção · ${fmtN(a.regs.length)} linhas de produto de ${fmtN(a.pedidos)} pedidos`
                : <b style={{ color: 'var(--risco)' }}>não reconhecido (esperava a exportação de Movimentação ou de Produção)</b>}</li>
            ))}
          </ul>
          {!prod.length && mov.length > 0 && <p className="dica" style={{ marginTop: 4 }}>Sem o arquivo de Produção, os pedidos novos ficam sem produto e usam o SLA padrão.</p>}
          <button type="button" className="btn" style={{ marginTop: 8 }} disabled={estado.gravando || !(mov.length + prod.length)} onClick={gravar}>
            {estado.gravando ? `Gravando… ${fmtN(estado.feitos)} de ${fmtN(estado.total)}` : 'Gravar e atualizar'}
          </button>
        </>
      )}
      {estado.erro && <p className="msg msg-erro" role="alert">{estado.erro}</p>}
      {estado.ok && <p className="msg msg-ok">{estado.ok}</p>}
    </div>
  );
}
