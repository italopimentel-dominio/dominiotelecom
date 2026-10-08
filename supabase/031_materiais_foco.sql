-- =====================================================================
-- Atualização: produto(s) foco de cada material
-- Vazio = material geral (conta venda de qualquer produto).
-- Com produtos escolhidos = só contam vendas desses produtos (ex.: só Alta Fibra, ou toda a torre Móvel).
-- Rodar UMA vez no SQL Editor (depois do 030). Pode rodar de novo sem problema.
-- =====================================================================
alter table public.materiais add column if not exists produtos_foco uuid[];

drop view if exists public.materiais_resumo;
create view public.materiais_resumo with (security_invoker = true) as
select m.*, (select count(*) from public.material_leads l where l.material_id = m.id) as leads
from public.materiais m;
grant select on public.materiais_resumo to authenticated;

-- Venda só é candidata ao material se for de um produto foco dele (ou se ele for geral)
create or replace function public.material_vendas(p_material uuid default null)
returns table (
  material_id uuid, cnpj text, mes text, consultor text, destino text,
  produto_id uuid, qtd numeric, valor numeric, mesmo_mes boolean
)
language sql stable security invoker set search_path = public as $$
  with cand as (
    select v.id as venda_id, l.material_id, m.enviado_em, v.cnpj, v.mes, v.consultor, v.destino, v.produto_id, v.qtd, v.valor
    from vendas_linhas v
    join material_leads l on l.cnpj = v.cnpj
    join materiais m on m.id = l.material_id
    where v.substituida_por is null and v.documento_valido
      and v.mes >= to_char(m.enviado_em, 'YYYY-MM')
      and v.mes <= to_char(m.enviado_em + 30, 'YYYY-MM')
      and (m.produtos_foco is null or cardinality(m.produtos_foco) = 0 or v.produto_id = any(m.produtos_foco))
  ), cred as (
    select distinct on (venda_id) * from cand order by venda_id, enviado_em desc, material_id
  )
  select material_id, cnpj, mes, consultor, destino, produto_id, qtd, valor, mes = to_char(enviado_em, 'YYYY-MM')
  from cred
  where p_material is null or material_id = p_material;
$$;
grant execute on function public.material_vendas(uuid) to authenticated;
