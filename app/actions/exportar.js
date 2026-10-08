'use server';
import { sessao } from '@/lib/auth';
import { carregarBase, analisar } from '@/lib/dados';

// Dados do Excel do mês: uma linha por colaborador, com quantidade, meta e % de cada produto.
// Mesmos números do painel (só leitura; qualquer usuário logado).
export async function dadosExportacaoMes(periodoId) {
  const s = await sessao();
  if (!s?.perfil?.ativo) return { erro: 'Faça login de novo.' };
  const { data: periodo } = await s.supabase.from('periodos').select('*').eq('id', periodoId).maybeSingle();
  if (!periodo) return { erro: 'Mês não encontrado.' };
  const base = await carregarBase(s.supabase, periodo, 'qtd');
  const an = analisar(base);
  const produtos = base.produtos.filter((p) => p.ativo).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome));
  const nomeCaminho = (g) => base.caminho(g).map((x) => x.nome).join(' / ');
  const raizDe = (g) => base.caminho(g)[0];

  const porColab = new Map();
  const usados = new Set();
  for (const g of base.grupos.filter((x) => x.ativo)) {
    for (const p of produtos) {
      const { linhas } = an.individuais(g.id, p);
      for (const l of linhas) {
        if (!(l.meta > 0) && !(l.realizado > 0)) continue;
        usados.add(p.id);
        const c = l.colaborador;
        if (!porColab.has(c.id)) {
          porColab.set(c.id, { colaborador: c.nome, equipe: nomeCaminho(g.id), canal: raizDe(g.id)?.nome || '', valores: {} });
        }
        porColab.get(c.id).valores[p.id] = { qtd: l.realizado, meta: l.meta, pct: l.pct };
      }
    }
  }
  const colunas = produtos.filter((p) => usados.has(p.id)).map((p) => ({ id: p.id, nome: p.nome }));
  const linhas = [...porColab.values()].sort((a, b) => a.canal.localeCompare(b.canal) || a.equipe.localeCompare(b.equipe) || a.colaborador.localeCompare(b.colaborador));
  return { periodo: periodo.nome, colunas, linhas };
}
