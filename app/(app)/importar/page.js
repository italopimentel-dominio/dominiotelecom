import { exigirSessao, podeEditar } from '@/lib/auth';
import { listarPeriodos, escolherPeriodo, carregarEstrutura } from '@/lib/dados';
import Importador from '@/components/Importador';
import SemPeriodo from '@/components/SemPeriodo';
import { importarRealizados, importarLotes } from '@/app/actions/importacao';
import ImportadorRelatorio from '@/components/ImportadorRelatorio';
import Link from 'next/link';
import { listaMedidas } from '@/lib/medida';

export default async function Importar({ searchParams }) {
  const sp = await searchParams;
  const { supabase, perfil } = await exigirSessao();
  if (!podeEditar(perfil)) {
    return <div className="vazio"><h2>Importação disponível para editores</h2><p>Peça a um administrador para mudar sua permissão para Editor.</p></div>;
  }
  const periodos = await listarPeriodos(supabase);
  const periodo = escolherPeriodo(periodos, sp.p);
  if (!periodo) return <SemPeriodo podeEditar />;
  const [est, { data: apelidos }, { data: lids }, { data: vinc }] = await Promise.all([
    carregarEstrutura(supabase),
    supabase.from('colaborador_apelidos').select('apelido, colaborador_id'),
    supabase.from('liderancas').select('id, nome, ativo'),
    supabase.from('lideranca_grupos').select('*'),
  ]);
  // nome do líder de cada equipe (ajuda a reconhecer "EQUIPE FULANO" no relatório)
  const liderDe = new Map();
  (vinc || []).forEach((v) => { const l = (lids || []).find((x) => x.id === v.lideranca_id && x.ativo); if (l) liderDe.set(v.grupo_id, l.nome); });
  const nomeGrupo = (id) => est.caminho(id).map((g) => g.nome).join(' / ');
  const grupos = est.achatar(null, 0, true).map((g) => ({ id: g.id, nome: nomeGrupo(g.id), lider: liderDe.get(g.id) || null }));
  const colaboradores = est.colaboradores.map((c) => ({ id: c.id, nome: c.nome, ativo: c.ativo, grupoNome: nomeGrupo(c.grupo_id) }));

  return (
    <>
      <div className="topo">
        <div>
          <h1>Importar resultados</h1>
          <p className="sub">O resultado entra no colaborador e soma na equipe, no canal e no Resumo da empresa.</p>
        </div>
        <div className="alternar-visao">
          <Link href="/importar?tipo=relatorio" className={sp.tipo === 'relatorio' ? 'ativo' : ''}>Relatório da operadora</Link>
          <Link href="/importar" className={sp.tipo !== 'relatorio' ? 'ativo' : ''}>Planilha simples</Link>
        </div>
      </div>
      {sp.tipo === 'relatorio' ? (
        <ImportadorRelatorio
          periodos={periodos}
          periodoInicial={periodo.id}
          produtos={est.produtos.filter((p) => p.ativo && p.tipo !== 'composto').map((p) => ({ id: p.id, nome: p.nome }))}
          colaboradores={colaboradores}
          grupos={grupos}
          apelidos={apelidos || []}
          acao={importarLotes}
        />
      ) : (
      <Importador
        periodos={periodos}
        periodoInicial={periodo.id}
        produtos={est.produtos.filter((p) => p.ativo && p.tipo !== 'composto').flatMap((p) => {
          const ms = listaMedidas(p);
          return ms.map((m) => ({ id: `${p.id}|${m}`, nome: p.nome, unidade: m, ambos: ms.length > 1 }));
        })}
        colaboradores={colaboradores}
        grupos={grupos}
        apelidos={apelidos || []}
        acao={importarRealizados}
      />
      )}
    </>
  );
}
