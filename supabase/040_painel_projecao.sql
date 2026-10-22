-- =====================================================================
-- 040 · Painel – Projeção
-- Todos os pedidos de cada mês (pelo mês de ENTRADA do pedido), por situação:
--   exec = executado · tram = tramitando · canc = pendente/cancelado (inclui status vazio e "não contabiliza")
-- Gravado pela fonte de dados a cada leitura (botões e rodada automática). Não muda o Painel – Executado.
-- Rodar depois do 039. Pode rodar de novo sem problema.
-- =====================================================================

create table if not exists public.pedidos_situacao (
  id bigserial primary key,
  fonte_id uuid not null references public.fontes_dados(id) on delete cascade,
  periodo_id uuid not null references public.periodos(id) on delete cascade,
  colaborador_id uuid references public.colaboradores(id) on delete cascade,
  grupo_id uuid references public.grupos(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  situacao text not null check (situacao in ('exec', 'tram', 'canc')),
  qtd numeric not null default 0,
  valor numeric not null default 0,
  gravado_em timestamptz not null default now(),
  check (colaborador_id is not null or grupo_id is not null)
);
create index if not exists pedidos_situacao_periodo on public.pedidos_situacao (periodo_id, produto_id);
create index if not exists pedidos_situacao_fonte on public.pedidos_situacao (fonte_id, periodo_id);

alter table public.pedidos_situacao enable row level security;
drop policy if exists ler on public.pedidos_situacao;
drop policy if exists gravar on public.pedidos_situacao;
create policy ler on public.pedidos_situacao for select to authenticated using (public.usuario_ativo());
create policy gravar on public.pedidos_situacao for all to authenticated
  using (public.pode_editar() or public.papel_requisicao() in ('service_role', 'sem_token'))
  with check (public.pode_editar() or public.papel_requisicao() in ('service_role', 'sem_token'));
grant select, insert, update, delete on public.pedidos_situacao to authenticated;
grant usage, select on sequence public.pedidos_situacao_id_seq to authenticated;
grant all on public.pedidos_situacao to service_role;
grant usage, select on sequence public.pedidos_situacao_id_seq to service_role;
