-- =====================================================================
-- Atualização: a Totalização passa a SOMAR no realizado de Alta Móvel
-- Alta Móvel vira uma soma (as metas continuam nela) de:
--   1) Alta Móvel – planilha               ← altas da planilha móvel (o que era Alta Móvel até hoje)
--   2) Totalização – móvel (outras classes) ← "TOTALIZAÇÃO SIM" da planilha móvel que NÃO são alta
--                                              (as que já são alta já estão no item 1; não conta duas vezes)
--   3) Totalização – Fibra                  ← "TOTALIZAÇÃO SIM" (VIVO TOTAL) da planilha de fibra
-- Os resultados já gravados de Alta Móvel são copiados para "Alta Móvel – planilha".
-- Quem contém Alta Móvel numa soma (ex.: Altas, Soma Produtos) continua contendo: o sistema soma por dentro.
-- Rodar UMA vez no SQL Editor (depois do 035). Pode rodar de novo sem problema.
-- =====================================================================
do $$
declare
  am record;
  id_plan uuid; id_fora uuid; id_fibra uuid;
begin
  select * into am from produtos where lower(nome) in ('alta móvel', 'alta movel') order by (tipo = 'composto') desc, ativo desc limit 1;
  if am.id is null then raise exception 'Produto "Alta Móvel" não encontrado.'; end if;
  select id into id_fibra from produtos where nome in ('Totalização – Fibra', 'Totalização – Vivo Total') limit 1;
  if id_fibra is null then raise exception 'Rode antes o 033 e o 035 (Totalização).'; end if;

  select id into id_plan from produtos where nome = 'Alta Móvel – planilha';
  if id_plan is null then
    insert into produtos (nome, unidade, medidas, ciclo, ordem, ativo, tipo)
    values ('Alta Móvel – planilha', am.unidade, am.medidas, am.ciclo, am.ordem, false, 'simples')
    returning id into id_plan;
  end if;

  select id into id_fora from produtos where nome = 'Totalização – móvel (outras classes)';
  if id_fora is null then
    insert into produtos (nome, unidade, medidas, ciclo, ordem, ativo, tipo)
    values ('Totalização – móvel (outras classes)', 'qtd', 'qtd', am.ciclo, am.ordem, false, 'simples')
    returning id into id_fora;
  end if;

  -- só na primeira vez: copia os resultados de Alta Móvel para "Alta Móvel – planilha"
  if am.tipo <> 'composto' then
    insert into realizados (periodo_id, colaborador_id, produto_id, medida, valor, atualizado_em, atualizado_por)
    select periodo_id, colaborador_id, id_plan, medida, valor, atualizado_em, atualizado_por from realizados where produto_id = am.id
    on conflict do nothing;
    insert into realizados_grupo (periodo_id, grupo_id, produto_id, medida, valor, atualizado_em, atualizado_por)
    select periodo_id, grupo_id, id_plan, medida, valor, atualizado_em, atualizado_por from realizados_grupo where produto_id = am.id
    on conflict do nothing;
    update produtos set tipo = 'composto' where id = am.id;
  end if;

  insert into produto_componentes (produto_id, componente_id, peso)
  values (am.id, id_plan, 1), (am.id, id_fora, 1), (am.id, id_fibra, 1)
  on conflict (produto_id, componente_id) do nothing;

  -- fonte móvel: as altas vão para "Alta Móvel – planilha"; as totalizações de outras classes, para o item 2
  update fontes_dados set config = coalesce(config, '{}'::jsonb)
    || jsonb_build_object('alta', id_plan::text, 'totFora', id_fora::text)
  where modelo = 'pedidos_movel' and (config->>'alta' is null or config->>'alta' = am.id::text or config->>'alta' = id_plan::text);
end $$;

-- materiais com foco em um produto soma (ex.: Alta Móvel) também contam as vendas dos produtos dentro dela
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
      and (m.produtos_foco is null or cardinality(m.produtos_foco) = 0 or v.produto_id = any(m.produtos_foco)
           or exists (select 1 from produto_componentes pc where pc.produto_id = any(m.produtos_foco) and pc.componente_id = v.produto_id))
  ), cred as (
    select distinct on (venda_id) * from cand order by venda_id, enviado_em desc, material_id
  )
  select material_id, cnpj, mes, consultor, destino, produto_id, qtd, valor, mes = to_char(enviado_em, 'YYYY-MM')
  from cred
  where p_material is null or material_id = p_material;
$$;
grant execute on function public.material_vendas(uuid) to authenticated;

select p.nome, p.tipo, string_agg(c.nome, ' + ') as soma_de
from produtos p left join produto_componentes pc on pc.produto_id = p.id left join produtos c on c.id = pc.componente_id
where lower(p.nome) in ('alta móvel', 'alta movel') group by p.nome, p.tipo;
