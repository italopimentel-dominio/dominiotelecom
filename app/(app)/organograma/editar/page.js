import Link from 'next/link';
import { redirect } from 'next/navigation';
import { exigirSessao, podeEditar } from '@/lib/auth';
import { carregarEstrutura } from '@/lib/dados';
import FormAcao from '@/components/FormAcao';
import TempoCasa from '@/components/TempoCasa';
import { salvarLideranca, alternarLideranca } from '@/app/actions/liderancas';

const CARGOS = ['Diretor comercial', 'Gerente regional', 'Coordenador de televendas', 'Supervisor de televendas', 'Supervisor consultivo', 'Supervisor do indireto'];

function FormLider({ l = {}, liderancas, grupos, ocupados, botao }) {
  const proibidos = new Set(l.id ? [l.id] : []);
  if (l.id) {
    let mudou = true;
    while (mudou) {
      mudou = false;
      liderancas.forEach((x) => { if (x.superior_id && proibidos.has(x.superior_id) && !proibidos.has(x.id)) { proibidos.add(x.id); mudou = true; } });
    }
  }
  const meus = new Set(l.grupos || []);
  return (
    <FormAcao acao={salvarLideranca}>
      {l.id && <input type="hidden" name="id" value={l.id} />}
      <div className="campos">
        <label className="campo">Nome<input type="text" name="nome" defaultValue={l.nome || ''} required /></label>
        <label className="campo">Cargo<input type="text" name="cargo" list="cargos" defaultValue={l.cargo || ''} required placeholder="ex.: Gerente regional" /></label>
        <label className="campo">Responde a
          <select name="superior_id" defaultValue={l.superior_id || ''}>
            <option value="">Ninguém (topo do organograma)</option>
            {liderancas.filter((x) => x.ativo && !proibidos.has(x.id)).map((x) => <option key={x.id} value={x.id}>{x.nome} ({x.cargo})</option>)}
          </select>
        </label>
        <label className="campo">Admissão<input type="date" name="data_admissao" defaultValue={l.data_admissao || ''} /></label>
        <label className="campo">Ordem<input type="number" name="ordem" defaultValue={l.ordem ?? 0} style={{ width: 70 }} /></label>
      </div>
      <fieldset className="lider-equipes">
        <legend>Equipes que lidera diretamente (os colaboradores delas aparecem abaixo dele)</legend>
        {grupos.map((g) => (
          <label key={g.id} className="check" style={{ paddingLeft: g.nivel * 18 }}>
            <input type="checkbox" name="grupos" value={g.id} defaultChecked={meus.has(g.id)} />
            {g.nome}
            {ocupados.get(g.id) && !meus.has(g.id) && <span className="dica">(já com {ocupados.get(g.id)})</span>}
          </label>
        ))}
      </fieldset>
      <button className="btn" type="submit" style={{ marginTop: 10 }}>{botao}</button>
    </FormAcao>
  );
}

export default async function EditarOrganograma() {
  const { supabase, perfil } = await exigirSessao();
  if (!podeEditar(perfil)) redirect('/organograma');
  const [est, { data: lids = [] }, { data: vinculos = [] }] = await Promise.all([
    carregarEstrutura(supabase),
    supabase.from('liderancas').select('*').order('ordem').order('nome'),
    supabase.from('lideranca_grupos').select('*'),
  ]);
  const liderancas = (lids || []).map((l) => ({ ...l, grupos: (vinculos || []).filter((v) => v.lideranca_id === l.id).map((v) => v.grupo_id) }));
  const grupos = est.achatar(null, 0, true).map((g) => ({ ...g, nome: est.caminho(g.id).map((x) => x.nome).join(' / ') }));
  const nomeLider = new Map(liderancas.map((l) => [l.id, l.nome]));
  const ocupados = new Map();
  (vinculos || []).forEach((v) => { const l = liderancas.find((x) => x.id === v.lideranca_id); if (l?.ativo) ocupados.set(v.grupo_id, l.nome); });
  const nomeGrupo = new Map(grupos.map((g) => [g.id, g.nome]));

  // lista em ordem de hierarquia
  const filhos = (id) => liderancas.filter((l) => (l.superior_id || null) === id);
  const ordenada = [];
  const visitar = (id, nivel) => filhos(id).forEach((l) => { ordenada.push({ ...l, nivel }); visitar(l.id, nivel + 1); });
  visitar(null, 0);
  liderancas.forEach((l) => { if (!ordenada.some((o) => o.id === l.id)) ordenada.push({ ...l, nivel: 0 }); });

  return (
    <>
      <datalist id="cargos">{CARGOS.map((c) => <option key={c} value={c} />)}</datalist>
      <div className="topo">
        <div>
          <p className="dica"><Link href="/organograma">Organograma</Link></p>
          <h1 style={{ marginTop: 6 }}>Cargos de liderança</h1>
          <p className="sub">Monte quem responde a quem. Os colaboradores continuam vindo do cadastro de equipes; aqui você só diz qual líder comanda cada equipe.</p>
        </div>
      </div>

      <details className="bloco" open={!liderancas.length}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>+ Incluir cargo</summary>
        <div style={{ marginTop: 14 }}>
          <FormLider liderancas={liderancas} grupos={grupos} ocupados={ocupados} botao="Incluir no organograma" />
        </div>
      </details>

      {ordenada.length > 0 && (
        <div className="tabela-wrap" style={{ marginTop: 18 }}>
          <table>
            <thead><tr><th>Nome</th><th className="esq">Cargo</th><th className="esq">Responde a</th><th className="esq">Equipes</th><th className="esq">Tempo de casa</th><th></th></tr></thead>
            <tbody>
              {ordenada.map((l) => (
                <tr key={l.id} className={l.ativo ? '' : 'inativo'}>
                  <td style={{ paddingLeft: 12 + l.nivel * 22, verticalAlign: 'top' }}>
                    <strong>{l.nome}</strong>{!l.ativo && <span className="nome-sub">inativo</span>}
                    <details className="recolhivel" style={{ marginTop: 4 }}>
                      <summary>Editar</summary>
                      <div className="bloco" style={{ marginTop: 8, whiteSpace: 'normal', minWidth: 560 }}>
                        <FormLider l={l} liderancas={liderancas} grupos={grupos} ocupados={ocupados} botao="Salvar" />
                      </div>
                    </details>
                  </td>
                  <td className="esq" style={{ verticalAlign: 'top' }}>{l.cargo}</td>
                  <td className="esq" style={{ verticalAlign: 'top' }}>{l.superior_id ? nomeLider.get(l.superior_id) : <span className="fraco">topo</span>}</td>
                  <td className="esq" style={{ verticalAlign: 'top', whiteSpace: 'normal' }}>{l.grupos.map((g) => nomeGrupo.get(g)).filter(Boolean).join('; ') || <span className="fraco">—</span>}</td>
                  <td className="esq" style={{ verticalAlign: 'top' }}><TempoCasa admissao={l.data_admissao} /></td>
                  <td style={{ verticalAlign: 'top' }}>
                    <FormAcao acao={alternarLideranca} confirmar={l.ativo ? `Tirar ${l.nome} do organograma?` : undefined}>
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="ativar" value={l.ativo ? '0' : '1'} />
                      <button className={l.ativo ? 'btn btn-perigo btn-peq' : 'btn btn-sec btn-peq'} type="submit">{l.ativo ? 'Inativar' : 'Reativar'}</button>
                    </FormAcao>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
