-- =====================================================================
-- Atualização: conversão dos materiais enviados (cruzamento por CNPJ)
-- Regra: a venda conta para o material se o CNPJ estava nele e a venda é do mês do envio
-- até o mês em que terminam os 30 dias. Se o CNPJ está em mais de um material, o crédito
-- vai para o envio mais recente. Qualquer vendedor conta (a tela mostra quem vendeu).
-- Rodar UMA vez no SQL Editor (depois do 023). Pode rodar de novo sem problema.
-- =====================================================================

create index if not exists vendas_linhas_cnpj_mes on public.vendas_linhas (cnpj, mes) where substituida_por is null;

-- Vendas creditadas a cada material (uma linha por venda). p_material = null traz de todos.
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
  ), cred as (
    select distinct on (venda_id) * from cand order by venda_id, enviado_em desc, material_id
  )
  select material_id, cnpj, mes, consultor, destino, produto_id, qtd, valor, mes = to_char(enviado_em, 'YYYY-MM')
  from cred
  where p_material is null or material_id = p_material;
$$;

grant execute on function public.material_vendas(uuid) to authenticated;
