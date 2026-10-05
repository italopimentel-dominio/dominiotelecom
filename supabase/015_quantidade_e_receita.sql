-- =====================================================================
-- Atualização: metas e resultados em QUANTIDADE e em RECEITA (R$)
-- Cada produto pode ter uma das medidas ou as duas. As metas, resultados,
-- metas fixas e metas da empresa ganham a coluna "medida".
-- Os dados que já existem ficam na medida que o produto tinha (nada se perde).
-- Rodar UMA vez no SQL Editor.
-- =====================================================================

-- 1) Produtos: quais medidas cada um usa
alter table public.produtos add column if not exists medidas text;
update public.produtos set medidas = coalesce(medidas, unidade);
alter table public.produtos alter column medidas set default 'qtd';
alter table public.produtos alter column medidas set not null;
alter table public.produtos drop constraint if exists produtos_medidas_check;
alter table public.produtos add constraint produtos_medidas_check check (medidas in ('qtd','brl','ambos'));

-- 2) Coluna "medida" nas tabelas de valores, preenchida com a medida atual do produto
do $$
declare
  t text;
  chave text;
begin
  foreach t in array array['metas','metas_individuais','realizados','realizados_grupo','metas_empresa'] loop
    execute format('alter table public.%I add column if not exists medida text', t);
    execute format('update public.%I x set medida = p.unidade from public.produtos p where p.id = x.produto_id and x.medida is null', t);
    execute format('update public.%I set medida = ''qtd'' where medida is null', t);
    execute format('alter table public.%I alter column medida set default ''qtd''', t);
    execute format('alter table public.%I alter column medida set not null', t);
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_medida_check');
    execute format('alter table public.%I add constraint %I check (medida in (''qtd'',''brl''))', t, t || '_medida_check');
    chave := case t
      when 'metas' then 'periodo_id, grupo_id, produto_id, medida'
      when 'metas_individuais' then 'periodo_id, colaborador_id, produto_id, medida'
      when 'realizados' then 'periodo_id, colaborador_id, produto_id, medida'
      when 'realizados_grupo' then 'periodo_id, grupo_id, produto_id, medida'
      else 'periodo_id, produto_id, medida' end;
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_pkey');
    execute format('alter table public.%I add primary key (%s)', t, chave);
  end loop;
end $$;
