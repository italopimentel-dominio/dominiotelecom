'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { lerCsv, casarNome } from '@/lib/tempoFalado';
import { tipoArquivoAssiduidade, lerPontoDatas, lerPlanilhaAssiduidade, ativoNoDia } from '@/lib/assiduidade';
import { normalizar } from '@/lib/nomes';
import { lancarAssiduidadeEmLote } from '@/app/actions/assiduidade';

// Sobe a folha de ponto (marca P onde estiver em branco) ou a planilha de assiduidade antiga (traz P/F/A)
export default function ImportarAssiduidade({ mes, colaboradores, apelidos = [] }) {
  const router = useRouter();
  const [arquivos, setArquivos] = useState([]);
  const [estado, setEstado] = useState({ gravando: false, erro: '', ok: '' });
  const cand = useMemo(() => colaboradores.map((c) => ({ chave: normalizar(c.nome).replace(/\s+/g, ' ').trim(), ref: c.id })), [colaboradores]);
  const apel = useMemo(() => new Map(apelidos.map((a) => [a.apelido, a.colaborador_id])), [apelidos]);
  const porId = useMemo(() => new Map(colaboradores.map((c) => [c.id, c])), [colaboradores]);
  const achar = (nome) => apel.get(normalizar(nome)) || casarNome(nome, cand);

  async function adicionar(e) {
    const lista = [...(e.target.files || [])];
    e.target.value = '';
    const XLSX = await import('xlsx');
    const novos = [];
    for (const f of lista) {
      let linhas;
      if (/\.csv$/i.test(f.name)) linhas = lerCsv(await f.text());
      else { const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }); linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }); }
      const tipo = tipoArquivoAssiduidade(linhas);
      novos.push({ nome: f.name, tipo, linhas });
    }
    setArquivos((a) => [...a.filter((x) => !novos.some((n) => n.nome === x.nome)), ...novos]);
    setEstado({ gravando: false, erro: '', ok: '' });
  }

  const resultado = useMemo(() => {
    const ponto = [], planilha = [], naoAchados = new Set();
    arquivos.forEach((a) => {
      if (a.tipo === 'ponto') {
        lerPontoDatas(a.linhas).forEach((p) => {
          const id = achar(p.nome); const c = porId.get(id);
          if (!c) { naoAchados.add(p.nome); return; }
          p.datas.filter((d) => d.startsWith(mes) && ativoNoDia(c, d)).forEach((d) => ponto.push({ colaborador_id: id, data: d, status: 'P', grupo_id: c.grupo_id }));
        });
      } else if (a.tipo === 'planilha') {
        lerPlanilhaAssiduidade(a.linhas, mes).forEach((p) => {
          const id = achar(p.nome); const c = porId.get(id);
          if (!c) { naoAchados.add(p.nome); return; }
          p.marcas.forEach((m) => planilha.push({ colaborador_id: id, data: m.data, status: m.status, grupo_id: c.grupo_id }));
        });
      }
    });
    return { ponto, planilha, naoAchados: [...naoAchados] };
  }, [arquivos, mes, cand, apel, porId]);

  async function gravar() {
    setEstado({ gravando: true, erro: '', ok: '' });
    let total = 0, semPermissao = 0;
    for (const [lista, opc] of [[resultado.planilha, { origem: 'planilha' }], [resultado.ponto, { origem: 'ponto', soVazios: true }]]) {
      for (let i = 0; i < lista.length; i += 4000) {
        const r = await lancarAssiduidadeEmLote(lista.slice(i, i + 4000), opc);
        if (r.erro) return setEstado({ gravando: false, erro: r.erro, ok: '' });
        total += r.gravados; semPermissao += r.semPermissao;
      }
    }
    setEstado({ gravando: false, erro: '', ok: `${total} marcações gravadas.${semPermissao ? ` ${semPermissao} ficaram de fora por serem de equipes que você não lidera.` : ''}` });
    setArquivos([]);
    router.refresh();
  }

  return (
    <div>
      <label className="campo">Folha de ponto (presentes) e/ou planilha de assiduidade antiga
        <input type="file" multiple accept=".xlsx,.xls,.csv" onChange={adicionar} />
      </label>
      <p className="dica" style={{ marginTop: 4 }}>
        Ponto: marca <b>P</b> nos dias com registro, só onde estiver em branco (não desfaz o que o supervisor marcou).
        Planilha antiga: traz P, F e A como estão. Vale para o mês selecionado na tela.
      </p>
      {arquivos.length > 0 && (
        <>
          <ul className="dica" style={{ margin: '6px 0 0 18px' }}>
            {arquivos.map((a) => <li key={a.nome}>{a.nome}: {a.tipo === 'ponto' ? 'folha de ponto' : a.tipo === 'planilha' ? 'planilha de assiduidade' : <b style={{ color: 'var(--risco)' }}>não reconhecido</b>}</li>)}
          </ul>
          <p className="dica" style={{ marginTop: 6 }}>
            {resultado.ponto.length > 0 && <>Ponto: <b>{resultado.ponto.length}</b> presenças. </>}
            {resultado.planilha.length > 0 && <>Planilha: <b>{resultado.planilha.length}</b> marcações. </>}
            {resultado.naoAchados.length > 0 && <>Não encontrei no cadastro (ficam de fora): {resultado.naoAchados.slice(0, 20).join(', ')}{resultado.naoAchados.length > 20 ? '…' : ''}.</>}
          </p>
          <button type="button" className="btn" disabled={estado.gravando || !(resultado.ponto.length + resultado.planilha.length)} onClick={gravar}>
            {estado.gravando ? 'Gravando…' : 'Gravar'}
          </button>
        </>
      )}
      {estado.erro && <p className="msg msg-erro">{estado.erro}</p>}
      {estado.ok && <p className="msg msg-ok">{estado.ok}</p>}
    </div>
  );
}
