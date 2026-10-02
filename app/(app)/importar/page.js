import { exigirSessao, podeEditar } from '@/lib/auth';
import { listarPeriodos, escolherPeriodo, carregarEstrutura } from '@/lib/dados';
import Importador from '@/components/Importador';
import SemPeriodo from '@/components/SemPeriodo';
import { importarRealizados } from '@/app/actions/importacao';

export default async function Importar({ searchParams }) {
  const sp = await searchParams;
  const { supabase, perfil } = await exigirSessao();
  if (!podeEditar(perfil)) {
    return <div className="vazio"><h2>Importação disponível para editores</h2><p>Peça a um administrador para mudar sua permissão para Editor.</p></div>;
  }
  const periodos = await listarPeriodos(supabase);
  const periodo = escolherPeriodo(periodos, sp.p);
  if (!periodo) return <SemPeriodo podeEditar />;
  const [est, { data: apelidos }] = await Promise.all([
    carregarEstrutura(supabase),
    supabase.from('colaborador_apelidos').select('apelido, colaborador_id'),
  ]);
  const nomeGrupo = (id) => est.caminho(id).map((g) => g.nome).join(' / ');
  const grupos = est.achatar(null, 0, true).map((g) => ({ id: g.id, nome: nomeGrupo(g.id) }));
  const colaboradores = est.colaboradores.map((c) => ({ id: c.id, nome: c.nome, ativo: c.ativo, grupoNome: nomeGrupo(c.grupo_id) }));

  return (
    <>
      <div className="topo">
        <div>
          <h1>Importar resultados</h1>
          <p className="sub">Suba a planilha com o nome dos colaboradores e os números de cada produto. O resultado entra no colaborador e soma na equipe.</p>
        </div>
      </div>
      <Importador
        periodos={periodos}
        periodoInicial={periodo.id}
        produtos={est.produtos.filter((p) => p.ativo && p.tipo !== 'composto')}
        colaboradores={colaboradores}
        grupos={grupos}
        apelidos={apelidos || []}
        acao={importarRealizados}
      />
    </>
  );
}
