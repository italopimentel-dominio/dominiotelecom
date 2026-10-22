-- =====================================================================
-- 041 · Carteira de pedidos (Painel – Projeção, versão com backlog e safra)
-- Substitui a tabela do 040 (que só guardava a safra do mês).
-- Guarda a foto atual de TODOS os pedidos de cada fonte:
--   situacao: exec = executado · tram = tramitando · canc = pendente/cancelado
--   safra: mês de entrada do pedido ('2026-10'); conclusao: mês de conclusão (só executados)
-- Cada leitura da fonte (botões e rodada automática) substitui a foto daquela fonte.
-- Rodar depois do 040. Pode rodar de novo sem problema.
-- =====================================================================

drop table if exists public.pedidos_situacao;

create table if not exists public.pedidos_carteira (
  id bigserial primary key,
  fonte_id uuid not null references public.fontes_dados(id) on delete cascade,
  colaborador_id uuid references public.colaboradores(id) on delete cascade,
  grupo_id uuid references public.grupos(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  situacao text not null check (situacao in ('exec', 'tram', 'canc')),
  safra text check (safra ~ '^\d{4}-\d{2}$'),
  conclusao text check (conclusao ~ '^\d{4}-\d{2}$'),
  qtd numeric not null default 0,
  valor numeric not null default 0,
  gravado_em timestamptz not null default now(),
  check (colaborador_id is not null or grupo_id is not null)
);
create index if not exists pedidos_carteira_fonte on public.pedidos_carteira (fonte_id);
create index if not exists pedidos_carteira_safra on public.pedidos_carteira (safra);

alter table public.pedidos_carteira enable row level security;
drop policy if exists ler on public.pedidos_carteira;
drop policy if exists gravar on public.pedidos_carteira;
create policy ler on public.pedidos_carteira for select to authenticated using (public.usuario_ativo());
create policy gravar on public.pedidos_carteira for all to authenticated
  using (public.pode_editar() or public.papel_requisicao() in ('service_role', 'sem_token'))
  with check (public.pode_editar() or public.papel_requisicao() in ('service_role', 'sem_token'));
grant select, insert, update, delete on public.pedidos_carteira to authenticated;
grant usage, select on sequence public.pedidos_carteira_id_seq to authenticated;
grant all on public.pedidos_carteira to service_role;
grant usage, select on sequence public.pedidos_carteira_id_seq to service_role;
