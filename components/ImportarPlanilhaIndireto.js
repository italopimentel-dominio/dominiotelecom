'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { lerPlanilhaIndireto, nomesParaLigar, sugerirFocal, sugerirStatus, montarPlano, chaveNome } from '@/lib/importacaoIndireto';
import { gravarImportacaoIndireto } from '@/app/actions/importarIndireto';

const fmtN = (n) => Number(n).toLocaleString('pt-BR');
const TIPO = { onboarding: 'ONB', telecom: 'Telecom', servicos: 'Serviços' };
const dm = (iso) => (iso ? `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');

export default function ImportarPlanilhaIndireto({ focais, statusLista, parceiros, treinosExistentes, nomesColaboradores, grupos, apelidosFocais }) {
  const [arq, setArq] = useState(null); // { nome, abas }
  const [aba, setAba] = useState('');
  const [erroArq, setErroArq] = useState('');
  const [ligFocal, setLigFocal] = useState({});
  const [ligStatus, setLigStatus] = useState({});
  const [escolhas, setEscolhas] = useState({});
  const [statusParticipante, setStatusParticipante] = useState('aguardando_interacao');
  const [colabModo, setColabModo] = useState('ativos');
  const [grupoId, setGrupoId] = useState(() => grupos.find((g) => chaveNome(g.nome) === 'indireto')?.id || grupos.find((g) => chaveNome(g.nome).includes('indireto'))?.id || '');
  const [estado, setEstado] = useState({ gravando: false, erro: '', fim: null });
  const nomeFocal = (id) => { const f = focais.find((x) => x.id === id); return f ? f.nome || f.usuario : '—'; };

  async function abrir(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setErroArq('');
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', raw: true });
      const abas = {};
      wb.SheetNames.forEach((n) => { abas[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: true }); });
      setArq({ nome: f.name, abas });
      trocarAba(wb.SheetNames.find((n) => chaveNome(n) === 'indireto') || wb.SheetNames[0], abas);
    } catch { setErroArq('Não consegui ler o arquivo. No Google Planilhas, use Arquivo → Fazer download → Microsoft Excel (.xlsx).'); }
  }
  function trocarAba(nome, abas = arq?.abas) {
    setAba(nome);
    const l = lerPlanilhaIndireto(abas?.[nome] || []);
    const n = nomesParaLigar(l);
    setLigFocal(Object.fromEntries(n.focais.map((x) => [x.chave, sugerirFocal(x.chave, focais, apelidosFocais)])));
    setLigStatus(Object.fromEntries(n.status.map((x) => [x.chave, sugerirStatus(x.chave, statusLista)])));
    setEscolhas({});
    setEstado({ gravando: false, erro: '', fim: null });
  }

  const lido = useMemo(() => (arq && aba ? lerPlanilhaIndireto(arq.abas[aba] || []) : null), [arq, aba]);
  const nomes = useMemo(() => (lido ? nomesParaLigar(lido) : { focais: [], status: [] }), [lido]);
  const ctx = useMemo(() => ({ parceiros, treinosExistentes: new Set(treinosExistentes), nomesColaboradores: new Set(nomesColaboradores) }), [parceiros, treinosExistentes, nomesColaboradores]);
  const plano = useMemo(() => (lido ? montarPlano(lido, ctx, { focal: ligFocal, status: ligStatus, statusParticipante, colabModo }, escolhas) : null), [lido, ctx, ligFocal, ligStatus, statusParticipante, colabModo, escolhas]);

  const focaisSemLigar = nomes.focais.filter((x) => !ligFocal[x.chave]?.p1);
  const statusSemLigar = nomes.status.filter((x) => !ligStatus[x.chave]);
  const faltas = [
    focaisSemLigar.length && `${focaisSemLigar.length} ${focaisSemLigar.length === 1 ? 'ponto focal' : 'pontos focais'} sem ligar`,
    statusSemLigar.length && `${statusSemLigar.length} ${statusSemLigar.length === 1 ? 'status' : 'status'} sem ligar`,
    plano?.abertos && `${plano.abertos} ${plano.abertos === 1 ? 'duplicidade' : 'duplicidades'} para escolher`,
    plano?.colaboradores.length > 0 && !grupoId && 'equipe Indireto não escolhida',
  ].filter(Boolean);

  async function gravar() {
    setEstado({ gravando: true, erro: '', fim: null });
    const r = await gravarImportacaoIndireto({
      focais: nomes.focais.map((x) => ({ apelido: x.chave, profile_id: ligFocal[x.chave]?.p1 === '-' ? null : ligFocal[x.chave]?.p1 || null, profile_id_2: ligFocal[x.chave]?.p2 || null })),
      novos: plano.novos, atualizar: plano.atualizar.map(({ id, campos }) => ({ id, campos })),
      treinos: plano.treinos.map(({ nome, ...t }) => t), colaboradores: plano.colaboradores, grupoId: grupoId || null,
    });
    if (r.erro) return setEstado({ gravando: false, erro: r.erro, fim: null });
    setEstado({ gravando: false, erro: '', fim: r });
    setArq(null);
  }

  if (estado.fim) {
    const f = estado.fim;
    return (
      <div className="msg msg-ok">
        <b>Importação concluída.</b> {fmtN(f.novos)} parceiros cadastrados, {fmtN(f.atualizados)} completados, {fmtN(f.treinos)} treinamentos registrados
        {f.colaboradores ? ` e ${fmtN(f.colaboradores)} colaboradores na equipe Indireto` : ''}.{' '}
        <Link href="/indireto/acompanhamento">Ver o acompanhamento</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="campos">
        <label className="campo">Planilha (Excel)<input type="file" accept=".xlsx,.xls" onChange={abrir} /></label>
        {arq && Object.keys(arq.abas).length > 1 && (
          <label className="campo">Aba
            <select value={aba} onChange={(e) => trocarAba(e.target.value)}>
              {Object.keys(arq.abas).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
      </div>
      {erroArq && <p className="msg msg-erro">{erroArq}</p>}
      {!arq && <p className="dica" style={{ marginTop: 6 }}>No Google Planilhas: Arquivo → Fazer download → Microsoft Excel (.xlsx). O sistema abre a aba “Indireto” sozinho.</p>}

      {lido && plano && (
        <>
          <p className="dica" style={{ marginTop: 10 }}>
            {fmtN(lido.comNome)} linhas com parceiro · {fmtN(lido.cad.size)} parceiros com data na coluna M
            {lido.semData ? ` · ${fmtN(lido.semData)} linhas sem data na coluna M ficaram de fora do cadastro` : ''} · {fmtN(lido.eventos.length)} onboardings e treinamentos com data.
          </p>

          {/* 1. pontos focais */}
          <section className="bloco" style={{ marginTop: 12 }} aria-labelledby="lig-focal">
            <h2 id="lig-focal" style={{ marginBottom: 4 }}>1. Pontos focais da planilha</h2>
            <p className="dica" style={{ marginBottom: 8 }}>Ligue cada nome ao usuário do sistema. O sistema lembra nas próximas importações. Para “Conjunto”, escolha as duas pessoas: o treinamento conta para as duas.</p>
            <div className="tabela-wrap">
              <table>
                <thead><tr><th className="esq">Na planilha</th><th className="esq">Usuário</th><th className="esq">Em conjunto com (opcional)</th></tr></thead>
                <tbody>
                  {nomes.focais.map((x) => {
                    const v = ligFocal[x.chave] || { p1: '', p2: '' };
                    const set = (k, val) => setLigFocal((m) => ({ ...m, [x.chave]: { ...v, [k]: val } }));
                    return (
                      <tr key={x.chave}>
                        <td className="esq"><b>{x.nome}</b></td>
                        <td className="esq">
                          <select value={v.p1} onChange={(e) => set('p1', e.target.value)} aria-label={`Usuário para ${x.nome}`} className={!v.p1 ? 'campo-pendente' : ''}>
                            <option value="">Escolha…</option>
                            <option value="-">Ninguém (deixar sem)</option>
                            {focais.map((f) => <option key={f.id} value={f.id}>{f.nome || f.usuario}</option>)}
                          </select>
                        </td>
                        <td className="esq">
                          <select value={v.p2} onChange={(e) => set('p2', e.target.value)} disabled={!v.p1 || v.p1 === '-'} aria-label={`Segunda pessoa para ${x.nome}`}>
                            <option value="">—</option>
                            {focais.filter((f) => f.id !== v.p1).map((f) => <option key={f.id} value={f.id}>{f.nome || f.usuario}</option>)}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* 2. status */}
          <section className="bloco" style={{ marginTop: 12 }} aria-labelledby="lig-status">
            <h2 id="lig-status" style={{ marginBottom: 4 }}>2. Status e equipe</h2>
            <div className="campos">
              {nomes.status.map((x) => (
                <label key={x.chave} className="campo">“{x.nome}” vira
                  <select value={ligStatus[x.chave] || ''} onChange={(e) => setLigStatus((m) => ({ ...m, [x.chave]: e.target.value }))}>
                    <option value="">Escolha…</option>
                    {statusLista.filter((s) => s.ativo).map((s) => <option key={s.chave} value={s.chave}>{s.nome}</option>)}
                  </select>
                </label>
              ))}
              <label className="campo">Participante novo (não estava no controle) entra como
                <select value={statusParticipante} onChange={(e) => setStatusParticipante(e.target.value)}>
                  {statusLista.filter((s) => s.ativo).map((s) => <option key={s.chave} value={s.chave}>{s.nome}</option>)}
                </select>
              </label>
              <label className="campo">Equipe Indireto
                <select value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
                  <option value="">Escolha…</option>
                  {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              </label>
              <label className="campo">Cadastrar como colaborador da equipe
                <select value={colabModo} onChange={(e) => setColabModo(e.target.value)}>
                  <option value="ativos">Parceiros novos ativos ou que treinaram</option>
                  <option value="todos">Todos os parceiros novos</option>
                  <option value="nenhum">Ninguém</option>
                </select>
              </label>
            </div>
            <p className="dica" style={{ marginTop: 4 }}>Colaborador da equipe entra na divisão da meta do Indireto. Por isso o padrão deixa de fora quem declinou ou ainda está em contato.</p>
          </section>

          {/* 3. duplicidades */}
          {plano.conflitos.length > 0 && (
            <section className="bloco" style={{ marginTop: 12 }} aria-labelledby="dup">
              <h2 id="dup" style={{ marginBottom: 4 }}>3. Duplicidades <span className="dica">({plano.conflitos.length - plano.abertos} de {plano.conflitos.length} resolvidas)</span></h2>
              <p className="dica" style={{ marginBottom: 8 }}>A mesma pessoa aparece mais de uma vez. Escolha qual vale.</p>
              <ul className="lista-alerta">
                {plano.conflitos.map((c) => (
                  <li key={c.id} style={{ flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ flex: '1 1 220px', minWidth: 0 }}><b style={{ fontWeight: 600 }}>{c.titulo}</b></span>
                    <span role="radiogroup" aria-label={c.titulo} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {c.opcoes.map((o, i) => (
                        <button key={i} type="button" role="radio" aria-checked={c.escolhido === i}
                          className={`btn btn-peq ${c.escolhido === i ? '' : 'btn-sec'}`}
                          onClick={() => setEscolhas((m) => ({ ...m, [c.id]: i }))}>{o}</button>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 4. prévia */}
          <section className="bloco" style={{ marginTop: 12 }} aria-labelledby="previa">
            <h2 id="previa" style={{ marginBottom: 4 }}>{plano.conflitos.length ? '4' : '3'}. O que será gravado</h2>
            <p className="dica" style={{ marginBottom: 8 }}>
              <b>{fmtN(plano.novos.length)}</b> parceiros novos · <b>{fmtN(plano.atualizar.length)}</b> já cadastrados com campos vazios a completar ·{' '}
              <b>{fmtN(plano.treinos.length)}</b> treinamentos ({Object.entries(TIPO).map(([k, r]) => `${fmtN(plano.treinos.filter((t) => t.tipo === k).length)} ${r}`).join(', ')}) ·{' '}
              <b>{fmtN(plano.colaboradores.length)}</b> colaboradores na equipe.
              {plano.contagem.jaTinham ? ` ${fmtN(plano.contagem.jaTinham)} treinamentos ficam de fora porque o parceiro já tem esse tipo registrado.` : ''}
              {plano.contagem.semParceiro ? ` ${fmtN(plano.contagem.semParceiro)} onboardings de parceiros sem data na coluna M e fora do controle ficam de fora.` : ''}
            </p>
            <details className="recolhivel">
              <summary>Ver os treinamentos ({fmtN(plano.treinos.length)})</summary>
              <div className="tabela-wrap tabela-fixa" style={{ maxHeight: 360, marginTop: 6 }}>
                <table>
                  <thead><tr><th className="esq">Parceiro</th><th className="esq">Tipo</th><th>Data</th><th className="esq">Feito por</th></tr></thead>
                  <tbody>
                    {plano.treinos.map((t, i) => (
                      <tr key={i}>
                        <td className="esq">{t.nome}{!t.parceiro_id && <span className="nome-sub">novo</span>}</td>
                        <td className="esq">{TIPO[t.tipo]}</td>
                        <td>{dm(t.data)}</td>
                        <td className="esq">{t.feito_por ? nomeFocal(t.feito_por) : <span className="fraco">ponto focal do parceiro</span>}{t.feito_por_2 && ` e ${nomeFocal(t.feito_por_2)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <details className="recolhivel" style={{ marginTop: 6 }}>
              <summary>Ver os parceiros novos ({fmtN(plano.novos.length)})</summary>
              <p className="dica" style={{ marginTop: 6 }}>{plano.novos.slice(0, 200).map((n) => n.nome_fantasia).join(', ')}{plano.novos.length > 200 ? '…' : ''}</p>
            </details>
            <details className="recolhivel" style={{ marginTop: 6 }}>
              <summary>Ver os parceiros que serão completados ({fmtN(plano.atualizar.length)})</summary>
              <ul className="dica" style={{ margin: '6px 0 0 18px' }}>
                {plano.atualizar.slice(0, 200).map((a) => <li key={a.id}>{a.nome}: {Object.keys(a.campos).map((k) => ({ contato_email: 'e-mail', contato_telefone: 'telefone', observacoes: 'observações', ponto_focal_id: 'ponto focal', data_ativacao: 'data de ativação', status: 'status', cpf: 'CPF', cnpj: 'CNPJ' }[k])).filter(Boolean).join(', ')}</li>)}
              </ul>
            </details>

            {faltas.length > 0 && <p className="msg msg-erro" style={{ marginTop: 10 }}>Antes de gravar: {faltas.join(' · ')}.</p>}
            {estado.erro && <p className="msg msg-erro" role="alert" style={{ marginTop: 10 }}>{estado.erro}</p>}
            <button type="button" className="btn" style={{ marginTop: 10 }} disabled={estado.gravando || faltas.length > 0 || !(plano.novos.length + plano.atualizar.length + plano.treinos.length)} onClick={gravar}>
              {estado.gravando ? 'Gravando…' : 'Gravar importação'}
            </button>
          </section>
        </>
      )}
    </div>
  );
}
