import Link from 'next/link';
import { exigirSessao, podeEditar } from '@/lib/auth';
import { hojeSP } from '@/lib/datas';
import { montarCalendario } from '@/lib/calc';
import { buscarTodas } from '@/lib/buscarTodas';
import { fotoDoDia, primeiraEntrada, diaDoRelatorio, expedienteDe, chaveFila, SEM_GRUPO } from '@/lib/preInput';
import SeletorDia from '@/components/SeletorDia';
import InfoBalao from '@/components/InfoBalao';
import ImportarPreInput from '@/components/ImportarPreInput';
import ParametrosPreInput from '@/components/ParametrosPreInput';
import BaixarExcelLista from '@/components/BaixarExcelLista';
import MenuFiltro from '@/components/MenuFiltro';
import { urlCom, lista as listaParam } from '@/components/Filtros';

const SEM_PROD = '__sem';
const NOME_SEM_PROD = 'Sem produto no arquivo de Produção';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const fmtN = (n) => Number(n || 0).toLocaleString('pt-BR');
const fmtH = (h) => { if (h == null || isNaN(h)) return '—'; let hh = Math.floor(h), mm = Math.round((h - hh) * 60); if (mm === 60) { hh++; mm = 0; } return `${hh}h${String(mm).padStart(2, '0')}`; };
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const hora = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 16)}` : '—');
const dataHoraBr = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11, 16)}` : '');
const media = (l) => (l.length ? l.reduce((s, x) => s + x, 0) / l.length : null);
const linha = (t, k) => <span key={k} style={{ display: 'block' }}>{t}</span>;

// cartão de indicador: título pequeno, número grande, detalhe embaixo
function Cartao({ titulo, valor, detalhe, cor }) {
  return (
    <div className="assid-cartao" style={{ margin: 0, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="dica" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em', fontSize: 11 }}>{titulo}</span>
      <span style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1, color: cor }}>{valor}</span>
      <span className="dica">{detalhe}</span>
    </div>
  );
}

export default async function PreInput({ searchParams }) {
  const sp = await searchParams;
  const { supabase, perfil } = await exigirSessao();
  const editor = podeEditar(perfil);

  const [cfgR, slaR, filasR, gruposR, feriadosR, configR] = await Promise.all([
    supabase.from('preinput_config').select('*').eq('id', 1).maybeSingle(),
    supabase.from('preinput_sla').select('grupo, horas').order('grupo'),
    supabase.from('preinput_filas').select('fila, tipo, grupo').order('tipo').order('fila'),
    supabase.from('preinput_grupos').select('nome, ordem').order('ordem'),
    supabase.from('feriados').select('*'),
    supabase.from('config').select('*').eq('id', 1).maybeSingle(),
  ]);
  if (cfgR.error || filasR.error) {
    return <><div className="topo"><h1>Pré-Input</h1></div><p className="msg msg-erro">Rode o arquivo 043_pre_input.sql no Supabase.</p></>;
  }
  const cfg = cfgR.data || { inicio: '08:00', fim: '18:00', sla_padrao: 6 };
  const filasLista = filasR.data || [];
  const filas = new Map(filasLista.map((f) => [chaveFila(f.fila), f]));
  const entradas = filasLista.filter((f) => f.tipo === 'entrada');
  const slaPorGrupo = new Map((slaR.data || []).map((x) => [chaveFila(x.grupo), Number(x.horas)]));
  const cal = montarCalendario(configR.data, feriadosR.data || []);
  const ehUtil = (iso) => cal.ehUtil(iso);
  const exp = expedienteDe(cfg.horarios, ehUtil);

  // dias com pedidos entrando no Pré-Input
  const ent = await buscarTodas(() => supabase.from('preinput_movimentos').select('neo, data_hora, fila').in('fila', entradas.map((f) => f.fila)).order('data_hora').order('neo'));
  // cada pedido entra no relatório do dia da sua PRIMEIRA entrada (depois do expediente: próximo dia útil)
  const porDia = new Map();
  primeiraEntrada((ent.data || []).map((m) => ({ ...m, data_hora: String(m.data_hora).slice(0, 19) })), filas).forEach((m, neo) => {
    const d = diaDoRelatorio(m.data_hora, exp);
    if (!porDia.has(d)) porDia.set(d, new Set());
    porDia.get(d).add(neo);
  });
  const dias = [...porDia.entries()].map(([dia, s]) => ({ dia, n: s.size }));
  const hoje = hojeSP();
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(sp.dia || '') ? sp.dia : (dias.map((d) => d.dia).sort().pop() || hoje);

  // todas as movimentações dos pedidos do dia (o que aconteceu depois da meia-noite do dia não entra na foto)
  const neosDia = [...(porDia.get(dia) || [])];
  const movs = [], itens = [];
  for (let i = 0; i < neosDia.length; i += 300) {
    const parte = neosDia.slice(i, i + 300);
    const [m, it] = await Promise.all([
      buscarTodas(() => supabase.from('preinput_movimentos').select('neo, data_hora, fila').in('neo', parte).order('neo').order('data_hora')),
      buscarTodas(() => supabase.from('preinput_itens').select('neo, item, grupo, produto, qtd').in('neo', parte).order('neo').order('item')),
    ]);
    movs.push(...(m.data || []).map((x) => ({ ...x, data_hora: String(x.data_hora).slice(0, 19) })));
    itens.push(...(it.data || []));
  }
  const itensPorNeo = new Map();
  itens.forEach((x) => { if (!itensPorNeo.has(x.neo)) itensPorNeo.set(x.neo, []); itensPorNeo.get(x.neo).push(x); });
  const agora = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 19);
  const filasNovas = [...new Set(movs.map((m) => m.fila).filter((f) => !filas.has(chaveFila(f))))].sort();

  // foto do dia: primeira entrada de cada pedido e o que aconteceu até a meia-noite do dia
  const doDia = fotoDoDia(movs, filas, { itensPorNeo, slaPorGrupo, slaPadrao: Number(cfg.sla_padrao) || 6, exp, agora })
    .filter((p) => p.dia === dia).sort((a, b) => a.entrada.localeCompare(b.entrada));
  const gruposEntrada = [...new Set(entradas.map((f) => f.grupo || SEM_GRUPO))];
  const contaEnt = (g) => doDia.filter((p) => p.grupoEntrada === g).length;
  const sel = gruposEntrada.includes(sp.ent) ? sp.ent : '';
  const listaEnt = sel ? doDia.filter((p) => p.grupoEntrada === sel) : doDia;
  // filtro de grupo de produto (vários): o pedido entra se tiver algum dos grupos escolhidos
  const gp = listaParam(sp.gp);
  const temGrupo = (p, g) => (g === SEM_PROD ? p.semProduto : p.grupos.includes(g));
  const lista = gp.length ? listaEnt.filter((p) => gp.some((g) => temGrupo(p, g))) : listaEnt;
  // ordenação das tabelas (sempre do maior para o menor)
  const og = ['neos', 'qtd', 'evol', 'tempo', 'sla', 'pctSla'].includes(sp.og) ? sp.og : 'neos';
  const od = ['n', 'pct', 'tempo', 'pctSla'].includes(sp.od) ? sp.od : '';

  // indicadores
  const evoluidos = lista.filter((p) => p.evoluiu);
  const sem = lista.filter((p) => !p.evoluiu).sort((a, b) => b.tempo - a.tempo);
  const noSla = evoluidos.filter((p) => p.dentroSla);
  const tempoMedio = media(evoluidos.map((p) => p.tempo));
  const qtdProdutos = lista.reduce((s, p) => s + p.produtos.reduce((t, x) => t + x.qtd, 0), 0);
  const semProduto = lista.filter((p) => p.semProduto).length;

  // por grupo de produto (pedido com mais de um grupo aparece em cada um)
  const porGrupo = new Map();
  lista.forEach((p) => {
    const gs = p.grupos.length ? p.grupos : [NOME_SEM_PROD];
    gs.forEach((g) => {
      if (!porGrupo.has(g)) porGrupo.set(g, { grupo: g, neos: 0, qtd: 0, tempos: [], evol: 0, noSla: 0, sla: slaPorGrupo.get(chaveFila(g)) ?? Number(cfg.sla_padrao) });
      const e = porGrupo.get(g);
      e.neos++;
      e.qtd += p.produtos.filter((x) => x.grupo === g).reduce((s, x) => s + x.qtd, 0);
      if (p.evoluiu) { e.evol++; e.tempos.push(p.tempo); if (p.dentroSla) e.noSla++; }
    });
  });
  const valorG = (g) => ({ neos: g.neos, qtd: g.qtd, evol: g.evol, tempo: media(g.tempos) ?? -1, sla: g.sla, pctSla: g.evol ? g.noSla / g.evol : -1 }[og]);
  const grupos = [...porGrupo.values()]
    .filter((g) => !gp.length || gp.includes(g.grupo === NOME_SEM_PROD ? SEM_PROD : g.grupo))
    .sort((a, b) => valorG(b) - valorG(a) || b.neos - a.neos);
  // opções do filtro de grupo de produto (contagem sobre o grupo de entrada escolhido)
  const opcoesGrupo = (() => {
    const c = new Map();
    listaEnt.forEach((p) => (p.semProduto ? [SEM_PROD] : p.grupos).forEach((g) => c.set(g, (c.get(g) || 0) + 1)));
    return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([g, n]) => ({ param: 'gp', v: g, t: g === SEM_PROD ? NOME_SEM_PROD : g, n }));
  })();

  // para onde evoluíram (na ordem dos grupos de destino dos parâmetros)
  const ordem = new Map((gruposR.data || []).map((g) => [g.nome, g.ordem]));
  const destinos = new Map();
  evoluidos.forEach((p) => {
    if (!destinos.has(p.grupoSaida)) destinos.set(p.grupoSaida, { grupo: p.grupoSaida, n: 0, tempos: [], noSla: 0, filas: new Map() });
    const e = destinos.get(p.grupoSaida);
    e.n++; e.tempos.push(p.tempo); if (p.dentroSla) e.noSla++;
    e.filas.set(p.filaSaida, (e.filas.get(p.filaSaida) || 0) + 1);
  });
  const valorD = (d) => ({ n: d.n, pct: d.n, tempo: media(d.tempos) ?? -1, pctSla: d.n ? d.noSla / d.n : -1 }[od]);
  const listaDestinos = [...destinos.values()].sort((a, b) => (od ? valorD(b) - valorD(a) : 0) || (ordem.get(a.grupo) ?? 99) - (ordem.get(b.grupo) ?? 99) || b.n - a.n);

  const href = (extra) => urlCom('/pre-input', { dia, ent: sel, gp, og: sp.og ? og : '', od }, extra);
  // cabeçalho que ordena (clique = do maior para o menor; clique de novo volta ao padrão)
  const Th = ({ param, k, atual, padrao, children }) => (
    <th aria-sort={atual === k ? 'descending' : undefined}>
      <Link href={href({ [param]: atual === k && k !== padrao ? '' : k })} style={{ color: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap' }} title="Ordenar do maior para o menor">
        {children} <span aria-hidden="true" style={{ opacity: atual === k ? 1 : 0.3 }}>▼</span>
      </Link>
    </th>
  );
  const ativosF = gp.map((g) => ({ chave: `gp-${g}`, t: `Grupo: ${g === SEM_PROD ? NOME_SEM_PROD : g}`, href: href({ gp: gp.filter((x) => x !== g) }) }));
  // lista para Excel: pedidos sem produto no arquivo de Produção (no dia e no grupo de entrada escolhidos)
  const semProdutoExcel = listaEnt.filter((p) => p.semProduto).map((p) => ({
    neo: p.neo, grupoEntrada: p.grupoEntrada, filaEntrada: p.filaEntrada, chegou: dataHoraBr(p.entrada),
    situacao: p.evoluiu ? 'Evoluiu' : 'Sem evolução', filaAtual: p.evoluiu ? p.filaSaida : p.filaAtual, grupoDestino: p.evoluiu ? p.grupoSaida : '',
    saiu: p.saida ? dataHoraBr(p.saida) : '', tempo: Math.round(p.tempo * 100) / 100, sla: p.sla,
  }));
  const colunasSemProduto = [
    { k: 'neo', t: 'Pedido (NEO)' }, { k: 'grupoEntrada', t: 'Grupo de entrada' }, { k: 'filaEntrada', t: 'Fila de entrada' }, { k: 'chegou', t: 'Chegou' },
    { k: 'situacao', t: 'Situação' }, { k: 'filaAtual', t: 'Fila atual / de saída' }, { k: 'grupoDestino', t: 'Grupo de destino' }, { k: 'saiu', t: 'Saiu' },
    { k: 'tempo', t: 'Tempo (h úteis)' }, { k: 'sla', t: 'SLA usado (h)' },
  ];
  const nomeDia = `${dia.slice(8)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;
  const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const resumoExpediente = Object.entries(cfg.horarios || {}).filter(([, h]) => h?.[0]).map(([d, h]) => `${SEM[d]} ${h[0]}–${h[1]}`).join(', ') || 'seg–qui 08:00–18:00, sex 08:00–17:00';
  const foraHorario = lista.filter((p) => p.foraDoHorario).length;

  return (
    <>
      <div className="assid-topo">
        <div>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            Pré-Input
            <InfoBalao titulo="Como a tela conta" rotulo="Como a tela conta">
              {linha(<>Cada dia é uma <b>foto</b>: mostra os pedidos que chegaram nele e o que aconteceu com eles até a meia-noite. Subir o dia seguinte não muda o dia anterior.</>, 1)}
              {linha(<>Um pedido <b>chega</b> na primeira vez que é movimentado para uma fila de entrada. Se sair e voltar, a volta não conta.</>, 2)}
              {linha(<>Chegou <b>depois do expediente</b> (ou em fim de semana/feriado)? Entra no relatório do próximo dia útil, mostrando a hora real da chegada.</>, 3)}
              {linha(<>Ele <b>evolui</b> na primeira movimentação para uma fila que não é de entrada. Andar entre filas de entrada não conta.</>, 4)}
              {linha(<>O <b>tempo</b> conta só o expediente ({resumoExpediente}), sem feriados. Quem não andou tem o tempo parado no fim do expediente do dia.</>, 5)}
              {linha(<>O <b>SLA</b> vem do grupo de produto (arquivo de Produção). Pedido com grupos diferentes usa o menor. Sem produto: {fmtN(cfg.sla_padrao)}h.</>, 6)}
            </InfoBalao>
          </h1>
          <p className="sub" style={{ marginTop: 4 }}>Foto de {nomeDia}: pedidos que chegaram às filas iniciais, quantos evoluíram até o fim do dia, em quanto tempo e quantos dentro do SLA.{foraHorario > 0 && <> Inclui {fmtN(foraHorario)} que chegaram depois do expediente do dia útil anterior.</>}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <SeletorDia dia={dia} dias={dias} />
          {editor && <a className="btn btn-sec" href="#atualizar">Atualizar dados</a>}
        </div>
      </div>

      {!dias.length && (
        <div className="vazio" style={{ margin: '16px 0' }}>
          <h2>Ainda não há dados</h2>
          <p>Suba as exportações de Movimentação e de Produção em <a href="#atualizar">Atualizar dados</a>, no fim da página.</p>
        </div>
      )}

      <div className="abas" role="tablist" aria-label="Grupo de entrada">
        <Link href={href({ ent: '' })} className={!sel ? 'aba ativa' : 'aba'} role="tab" aria-selected={!sel}>Todos · {fmtN(doDia.length)}</Link>
        {gruposEntrada.map((g) => (
          <Link key={g} href={href({ ent: g })} className={sel === g ? 'aba ativa' : 'aba'} role="tab" aria-selected={sel === g}>{g} · {fmtN(contaEnt(g))}</Link>
        ))}
      </div>

      <section className="barra-filtros" aria-label="Filtros" style={{ marginBottom: 10 }}>
        <div className="linha-menus">
          <MenuFiltro rotulo="Grupo de produto" opcoes={opcoesGrupo} />
          <span className="dica" style={{ marginLeft: 'auto' }}>Escolha um ou mais grupos: a tela passa a contar só os pedidos deles.</span>
        </div>
        {ativosF.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <span className="dica">{fmtN(lista.length)} de {fmtN(listaEnt.length)} pedidos ·</span>
            {ativosF.map((a) => (
              <Link key={a.chave} href={a.href} className="tag tag-acento" style={{ textDecoration: 'none' }} aria-label={`Tirar filtro ${a.t}`}>{a.t} ×</Link>
            ))}
            <Link href={href({ gp: [] })} className="dica" style={{ marginLeft: 4 }}>Limpar</Link>
          </div>
        )}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, margin: '4px 0 10px' }}>
        <Cartao titulo="Chegaram" valor={fmtN(lista.length)}
          detalhe={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{fmtN(qtdProdutos)} produtos
            <InfoBalao titulo="Produtos dos pedidos" rotulo="Ver produtos por grupo">
              {grupos.map((g) => linha(<>{g.grupo}: <b>{fmtN(g.neos)}</b> pedidos · {fmtN(g.qtd)} produtos</>, g.grupo))}
            </InfoBalao></span>} />
        <Cartao titulo="Evoluíram" valor={fmtN(evoluidos.length)} cor="var(--ok)" detalhe={`${pct(evoluidos.length, lista.length)} dos que chegaram`} />
        <Cartao titulo="Tempo médio até evoluir" valor={fmtH(tempoMedio)} detalhe="em horas úteis" />
        <Cartao titulo="Sem evolução" valor={fmtN(sem.length)} cor={sem.length ? 'var(--risco)' : undefined}
          detalhe={sem.length ? (
            <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
              <span className="tag">{fmtN(sem.filter((p) => p.noPrazo).length)} no prazo</span>
              <span className="tag tag-risco">{fmtN(sem.filter((p) => p.estourado).length)} SLA estourado</span>
            </span>
          ) : 'todos evoluíram'} />
        <Cartao titulo="Dentro do SLA" valor={fmtN(noSla.length)} cor={evoluidos.length && noSla.length / evoluidos.length >= 0.8 ? 'var(--ok)' : evoluidos.length ? 'var(--risco)' : undefined}
          detalhe={`${pct(noSla.length, evoluidos.length)} dos que evoluíram`} />
      </div>
      {semProdutoExcel.length > 0 && (
        <p className="dica" style={{ margin: '4px 0 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          ⚠ {fmtN(semProdutoExcel.length)} pedidos não estão no arquivo de Produção: ficam sem produto e usam o SLA padrão de {fmtN(cfg.sla_padrao)}h. Suba a Produção do mesmo período para completar.
          <BaixarExcelLista linhas={semProdutoExcel} colunas={colunasSemProduto} arquivo={`pre-input-sem-produto-${dia}.xlsx`} aba="Sem produto" rotulo="Baixar lista em Excel" />
        </p>
      )}

      <section className="assid-cartao" style={{ marginTop: 12 }} aria-labelledby="pi-grupos">
        <h2 id="pi-grupos" style={{ marginBottom: 8 }}>Por grupo de produto</h2>
        <div className="tabela-wrap">
          <table>
            <thead><tr><th className="esq">Grupo</th>
              <Th param="og" k="neos" atual={og} padrao="neos">Pedidos</Th><Th param="og" k="qtd" atual={og} padrao="neos">Produtos</Th>
              <Th param="og" k="evol" atual={og} padrao="neos">Evoluíram</Th><Th param="og" k="tempo" atual={og} padrao="neos">Tempo médio</Th>
              <Th param="og" k="sla" atual={og} padrao="neos">SLA</Th><Th param="og" k="pctSla" atual={og} padrao="neos">Dentro do SLA</Th></tr></thead>
            <tbody>
              {grupos.map((g) => (
                <tr key={g.grupo}>
                  <td className="esq">
                    {g.grupo}
                    {g.grupo === NOME_SEM_PROD && <span style={{ marginLeft: 8 }}><BaixarExcelLista linhas={semProdutoExcel} colunas={colunasSemProduto} arquivo={`pre-input-sem-produto-${dia}.xlsx`} aba="Sem produto" rotulo="Excel" /></span>}
                  </td><td>{fmtN(g.neos)}</td><td>{fmtN(g.qtd)}</td><td>{fmtN(g.evol)}</td>
                  <td>{fmtH(media(g.tempos))}</td><td className="fraco">{fmtN(g.sla)}h</td>
                  <td><b style={{ color: g.evol && g.noSla / g.evol >= 0.8 ? 'var(--ok)' : g.evol ? 'var(--risco)' : undefined }}>{pct(g.noSla, g.evol)}</b></td>
                </tr>
              ))}
              {!grupos.length && <tr><td colSpan={7} className="fraco" style={{ textAlign: 'center', padding: 20 }}>Nenhum pedido neste dia.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="dica" style={{ marginTop: 6 }}>Pedido com produtos de grupos diferentes aparece em cada grupo. Clique no título de uma coluna para ordenar do maior para o menor.</p>
      </section>

      <section className="assid-cartao" style={{ marginTop: 16 }} aria-labelledby="pi-destinos">
        <h2 id="pi-destinos" style={{ marginBottom: 2 }}>Para onde evoluíram</h2>
        <p className="dica" style={{ marginBottom: 8 }}>% do total = sobre todos os {fmtN(lista.length)} pedidos que chegaram no período filtrado (com os que ainda não evoluíram, a soma dá 100%).</p>
        <div className="tabela-wrap">
          <table>
            <thead><tr><th className="esq">Grupo de destino</th>
              <Th param="od" k="n" atual={od}>Pedidos</Th><Th param="od" k="pct" atual={od}>% do total</Th>
              <Th param="od" k="tempo" atual={od}>Tempo médio</Th><Th param="od" k="pctSla" atual={od}>Dentro do SLA</Th></tr></thead>
            <tbody>
              {listaDestinos.map((d) => (
                <tr key={d.grupo}>
                  <td className="esq">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{d.grupo}
                      <InfoBalao titulo="Filas deste grupo" rotulo={`Filas de ${d.grupo}`}>
                        {[...d.filas.entries()].sort((a, b) => b[1] - a[1]).map(([f, n]) => linha(<>{f}: <b>{fmtN(n)}</b> ({pct(n, lista.length)} do total)</>, f))}
                      </InfoBalao>
                    </span>
                  </td>
                  <td>{fmtN(d.n)}</td>
                  <td>
                    <b>{pct(d.n, lista.length)}</b>
                    <span aria-hidden="true" style={{ display: 'block', height: 6, borderRadius: 3, background: '#ece9f3', marginTop: 3, minWidth: 80 }}>
                      <span style={{ display: 'block', height: 6, borderRadius: 3, width: `${lista.length ? (d.n / lista.length) * 100 : 0}%`, background: 'var(--ok)' }} />
                    </span>
                  </td>
                  <td>{fmtH(media(d.tempos))}</td><td>{pct(d.noSla, d.n)}</td>
                </tr>
              ))}
              {sem.length > 0 && (
                <tr className="fraco">
                  <td className="esq"><i>Ainda sem evolução (nas filas iniciais)</i></td>
                  <td>{fmtN(sem.length)}</td>
                  <td>
                    <b>{pct(sem.length, lista.length)}</b>
                    <span aria-hidden="true" style={{ display: 'block', height: 6, borderRadius: 3, background: '#ece9f3', marginTop: 3, minWidth: 80 }}>
                      <span style={{ display: 'block', height: 6, borderRadius: 3, width: `${lista.length ? (sem.length / lista.length) * 100 : 0}%`, background: 'var(--risco)' }} />
                    </span>
                  </td>
                  <td>—</td><td>—</td>
                </tr>
              )}
              {lista.length > 0 && (
                <tr><td className="esq"><b>Total de pedidos do período</b></td><td><b>{fmtN(lista.length)}</b></td><td><b>100%</b></td><td /><td /></tr>
              )}
              {!listaDestinos.length && !sem.length && <tr><td colSpan={5} className="fraco" style={{ textAlign: 'center', padding: 20 }}>Nenhum pedido neste dia.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="assid-cartao" style={{ marginTop: 16 }} aria-labelledby="pi-sem">
        <h2 id="pi-sem" style={{ marginBottom: 2 }}>Sem evolução ({fmtN(sem.length)})</h2>
        <p className="dica" style={{ marginBottom: 8 }}>Não andaram até o fim do dia. Tempo parado = horas úteis da chegada até o fim do expediente do dia (no dia de hoje, até agora). Os mais antigos primeiro.</p>
        <div className="tabela-wrap tabela-fixa" style={{ maxHeight: 420 }}>
          <table>
            <thead><tr><th className="esq">Pedido (NEO)</th><th className="esq">Fila atual</th><th>Chegou</th><th>Tempo parado</th><th>SLA</th><th className="esq">Produtos</th></tr></thead>
            <tbody>
              {sem.map((p) => (
                <tr key={p.neo}>
                  <td className="esq"><b>{p.neo}</b></td>
                  <td className="esq">{p.filaAtual}</td>
                  <td>{hora(p.entrada)}{p.foraDoHorario && <span className="nome-sub">fora do horário</span>}</td>
                  <td><b style={{ color: p.estourado ? 'var(--risco)' : undefined }}>{fmtH(p.tempo)}</b></td>
                  <td>{p.estourado ? <span className="tag tag-risco">passou de {fmtN(p.sla)}h</span> : <span className="tag">{fmtN(p.sla)}h</span>}</td>
                  <td className="esq">{p.semProduto ? <span className="fraco">sem produto</span> : p.grupos.join(', ')}</td>
                </tr>
              ))}
              {!sem.length && <tr><td colSpan={6} className="fraco" style={{ textAlign: 'center', padding: 20 }}>Todos os pedidos do dia evoluíram.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <details className="assid-cartao recolhivel" style={{ marginTop: 16 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Pedidos que evoluíram ({fmtN(evoluidos.length)})</summary>
        <div className="tabela-wrap tabela-fixa" style={{ maxHeight: 420, marginTop: 8 }}>
          <table>
            <thead><tr><th className="esq">Pedido (NEO)</th><th>Chegou</th><th>Saiu</th><th className="esq">Para</th><th>Tempo</th><th>SLA</th></tr></thead>
            <tbody>
              {[...evoluidos].sort((a, b) => b.tempo - a.tempo).map((p) => (
                <tr key={p.neo}>
                  <td className="esq"><b>{p.neo}</b><span className="nome-sub">{p.semProduto ? 'sem produto' : p.grupos.join(', ')}</span></td>
                  <td>{hora(p.entrada)}{p.foraDoHorario && <span className="nome-sub">fora do horário</span>}</td><td>{hora(p.saida)}</td>
                  <td className="esq">{p.filaSaida}<span className="nome-sub">{p.grupoSaida}</span></td>
                  <td><b>{fmtH(p.tempo)}</b></td>
                  <td>{p.dentroSla ? <span className="tag tag-ok">no SLA ({fmtN(p.sla)}h)</span> : <span className="tag tag-risco">fora ({fmtN(p.sla)}h)</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {editor && (
        <details id="atualizar" className="bloco secao recolhivel" style={{ marginTop: 20 }} open={!dias.length}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Atualizar dados (subir exportações do CRM)</summary>
          <div style={{ marginTop: 10 }}><ImportarPreInput /></div>
        </details>
      )}

      <details className="bloco secao recolhivel" style={{ marginTop: 12 }} open={filasNovas.length > 0 && editor}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Parâmetros (expediente, SLA e filas){filasNovas.length > 0 && <span className="tag tag-atencao" style={{ marginLeft: 8 }}>{filasNovas.length} filas novas</span>}</summary>
        <div style={{ marginTop: 10 }}>
          <ParametrosPreInput podeEditar={editor} config={{ ...cfg, horarios: cfg.horarios || null }} sla={(slaR.data || []).map((x) => ({ grupo: x.grupo, horas: x.horas }))}
            filas={filasLista.map((f) => ({ fila: f.fila, tipo: f.tipo, grupo: f.grupo || '' }))} filasNovas={filasNovas}
            grupos={[...new Set([...(gruposR.data || []).map((g) => g.nome), ...filasLista.map((f) => f.grupo).filter(Boolean)])]} />
        </div>
      </details>
    </>
  );
}
