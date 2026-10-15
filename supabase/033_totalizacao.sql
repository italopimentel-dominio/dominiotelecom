-- =====================================================================
-- Atualização: Totalização (vendas com "TOTALIZAÇÃO SIM")
-- Cria o indicador "Totalização" (sem meta), logo depois de Alta Móvel no painel.
-- É uma soma de dois produtos internos (escondidos das abas), um por fonte,
-- porque cada fonte grava no seu próprio produto:
--   - Totalização – móvel      ← fonte móvel  (coluna TOTALIZADO)
--   - Totalização – Vivo Total ← fonte fibra  (coluna VIVO TOTAL)
-- E já liga esses produtos às fontes de móvel e de fibra.
-- A venda continua contando onde já contava; a Totalização é só "a mais".
-- Rodar UMA vez no SQL Editor (depois do 032). Pode rodar de novo sem problema.
-- =====================================================================
do $$
declare
  ref record;
  id_tot uuid; id_movel uuid; id_vt uuid;
begin
  -- referência: o produto Alta Móvel (ciclo e posição no painel)
  select * into ref from produtos where lower(nome) in ('alta móvel', 'alta movel') order by ativo desc limit 1;

  select id into id_movel from produtos where nome = 'Totalização – móvel';
  if id_movel is null then
    insert into produtos (nome, unidade, medidas, ciclo, ordem, ativo, tipo)
    values ('Totalização – móvel', 'qtd', 'qtd', coalesce(ref.ciclo, 'GERAL'), coalesce(ref.ordem, 0), false, 'simples')
    returning id into id_movel;
  end if;

  select id into id_vt from produtos where nome = 'Totalização – Vivo Total';
  if id_vt is null then
    insert into produtos (nome, unidade, medidas, ciclo, ordem, ativo, tipo)
    values ('Totalização – Vivo Total', 'qtd', 'qtd', coalesce(ref.ciclo, 'GERAL'), coalesce(ref.ordem, 0), false, 'simples')
    returning id into id_vt;
  end if;

  select id into id_tot from produtos where nome = 'Totalização';
  if id_tot is null then
    insert into produtos (nome, unidade, medidas, ciclo, ordem, ativo, tipo)
    values ('Totalização', 'qtd', 'qtd', coalesce(ref.ciclo, 'GERAL'), coalesce(ref.ordem, 0), true, 'composto')
    returning id into id_tot;
  end if;

  insert into produto_componentes (produto_id, componente_id, peso) values (id_tot, id_movel, 1), (id_tot, id_vt, 1)
  on conflict (produto_id, componente_id) do nothing;

  -- liga às fontes (destino "tot" de cada modelo)
  update fontes_dados set config = coalesce(config, '{}'::jsonb) || jsonb_build_object('tot', id_movel::text) where modelo = 'pedidos_movel';
  update fontes_dados set config = coalesce(config, '{}'::jsonb) || jsonb_build_object('tot', id_vt::text) where modelo = 'pedidos_fibra';
end $$;

select p.nome, p.tipo, p.ativo from produtos p where p.nome like 'Totalização%' order by p.nome;
