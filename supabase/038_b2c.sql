-- =====================================================================
-- 038 · Fonte B2C
-- 1) Cria "Alta Móvel – B2C" e coloca na soma Alta Móvel.
-- 2) Alta Fibra vira soma: "Alta Fibra – planilha" (o que a fonte de fibra grava, com o histórico copiado)
--    + "Alta Fibra – B2C". As metas continuam na Alta Fibra.
-- 3) Venda vinculada dos parceiros: se a venda registrada ficou fora do prazo de 30 dias e chega uma
--    venda dentro do prazo (de qualquer fonte), troca para ela e reavalia a validação automática.
-- Os produtos novos copiam as configurações do "Alta Móvel – planilha" (interno, oculto das abas).
-- Rodar depois do 037. Pode rodar de novo sem problema.
-- =====================================================================

do $$
declare
  v_modelo uuid;       -- Alta Móvel – planilha (modelo de produto interno)
  v_alta_movel uuid;   -- soma Alta Móvel
  v_alta_fibra uuid;   -- Alta Fibra (vira soma)
  v_movel_b2c uuid;
  v_fibra_plan uuid;
  v_fibra_b2c uuid;
  m produtos%rowtype;
  af produtos%rowtype;
begin
  select id into v_modelo from produtos where nome = 'Alta Móvel – planilha';
  select id into v_alta_movel from produtos where nome = 'Alta Móvel';
  select id into v_alta_fibra from produtos where nome = 'Alta Fibra';
  if v_modelo is null or v_alta_movel is null or v_alta_fibra is null then
    raise exception 'Não encontrei os produtos "Alta Móvel – planilha", "Alta Móvel" e "Alta Fibra" com esses nomes exatos.';
  end if;
  select * into m from produtos where id = v_modelo;
  select * into af from produtos where id = v_alta_fibra;

  -- 1) Alta Móvel – B2C
  select id into v_movel_b2c from produtos where nome = 'Alta Móvel – B2C';
  if v_movel_b2c is null then
    v_movel_b2c := gen_random_uuid();
    insert into produtos
    select (jsonb_populate_record(null::produtos, to_jsonb(m) || jsonb_build_object(
      'id', v_movel_b2c, 'nome', 'Alta Móvel – B2C', 'tipo', 'simples'))).*;
  end if;
  insert into produto_componentes (produto_id, componente_id, peso)
  select v_alta_movel, v_movel_b2c, 1
  where not exists (select 1 from produto_componentes where produto_id = v_alta_movel and componente_id = v_movel_b2c);

  -- 2) Alta Fibra – planilha e Alta Fibra – B2C (unidade, medidas e ciclo da Alta Fibra)
  select id into v_fibra_plan from produtos where nome = 'Alta Fibra – planilha';
  if v_fibra_plan is null then
    v_fibra_plan := gen_random_uuid();
    insert into produtos
    select (jsonb_populate_record(null::produtos, to_jsonb(m) || jsonb_build_object(
      'id', v_fibra_plan, 'nome', 'Alta Fibra – planilha', 'tipo', 'simples',
      'unidade', af.unidade, 'medidas', to_jsonb(af.medidas), 'ciclo', af.ciclo,
      'detalhe_de', case when m.detalhe_de = v_alta_movel then v_alta_fibra else m.detalhe_de end))).*;
  end if;
  select id into v_fibra_b2c from produtos where nome = 'Alta Fibra – B2C';
  if v_fibra_b2c is null then
    v_fibra_b2c := gen_random_uuid();
    insert into produtos
    select (jsonb_populate_record(null::produtos, to_jsonb(m) || jsonb_build_object(
      'id', v_fibra_b2c, 'nome', 'Alta Fibra – B2C', 'tipo', 'simples',
      'unidade', af.unidade, 'medidas', to_jsonb(af.medidas), 'ciclo', af.ciclo,
      'detalhe_de', case when m.detalhe_de = v_alta_movel then v_alta_fibra else m.detalhe_de end))).*;
  end if;

  -- histórico: o que estava gravado na Alta Fibra passa a valer também na "Alta Fibra – planilha"
  -- (os valores originais ficam guardados; numa soma o sistema só soma as partes)
  insert into realizados (periodo_id, colaborador_id, produto_id, medida, valor)
  select periodo_id, colaborador_id, v_fibra_plan, medida, valor from realizados where produto_id = v_alta_fibra
  on conflict do nothing;
  insert into realizados_grupo (periodo_id, grupo_id, produto_id, medida, valor)
  select periodo_id, grupo_id, v_fibra_plan, medida, valor from realizados_grupo where produto_id = v_alta_fibra
  on conflict do nothing;

  update produtos set tipo = 'composto' where id = v_alta_fibra;
  insert into produto_componentes (produto_id, componente_id, peso)
  select v_alta_fibra, c, 1 from unnest(array[v_fibra_plan, v_fibra_b2c]) c
  where not exists (select 1 from produto_componentes where produto_id = v_alta_fibra and componente_id = c);

  -- a fonte de fibra passa a gravar na "Alta Fibra – planilha"
  update fontes_dados set config = jsonb_set(config, '{alta}', to_jsonb(v_fibra_plan::text))
  where config->>'alta' = v_alta_fibra::text;
end $$;

-- 3) Venda vinculada dos parceiros
--    sem venda                                   -> grava a primeira venda encontrada
--    venda fora do prazo + venda nova no prazo   -> troca para a venda no prazo (ativação passa a ser boa)
--    venda já dentro do prazo                    -> não mexe
--    Prazo igual ao da tela: vale a venda até o mês em que terminam os 30 dias da ativação.
create or replace function public.registrar_vendas_parceiros(p_sinc uuid, p_vendas jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  ids uuid[];
  i uuid;
begin
  if not (public.pode_editar() or public.papel_requisicao() in ('service_role', 'sem_token')) then
    raise exception 'Sem permissão.';
  end if;
  perform set_config('app.registro_sistema', 'on', true);
  with v as (
    select public.nome_normalizado(x->>'nome') as nome, x->>'mes' as mes, x->>'produto' as produto,
           nullif(x->>'qtd', '')::numeric as qtd, nullif(x->>'valor', '')::numeric as valor
    from jsonb_array_elements(coalesce(p_vendas, '[]'::jsonb)) x
  ), validas as (
    select * from v where nome <> '' and coalesce(qtd, 0) > 0 and mes ~ '^\d{4}-\d{2}$'
  ), cand as (
    select p.id, p.venda_mes as atual, f.mes, f.produto, f.qtd, f.valor,
           case when p.data_ativacao is null then null else to_char(p.data_ativacao::date + 30, 'YYYY-MM') end as prazo_mes
    from parceiros p join validas f
      on f.nome = public.nome_normalizado(p.nome_fantasia) or f.nome = public.nome_normalizado(p.razao_social)
  ), alvo as (
    select distinct on (id) id, mes, produto, qtd, valor
    from cand
    where atual is null
       or (prazo_mes is not null and atual > prazo_mes and mes <= prazo_mes)
    order by id, mes, qtd desc
  ), feitos as (
    update parceiros p set
      venda_mes = a.mes, venda_produto = a.produto, venda_qtd = a.qtd, venda_valor = a.valor,
      venda_registrada_em = now(), venda_sincronizacao = p_sinc
    from alvo a where p.id = a.id
    returning p.id
  )
  select coalesce(array_agg(id), '{}') into ids from feitos;
  perform set_config('app.registro_sistema', 'off', true);
  foreach i in array ids loop
    perform public.avaliar_validacao_automatica(i);
  end loop;
  return coalesce(array_length(ids, 1), 0);
end $$;
