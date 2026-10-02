-- =====================================================================
-- Atualização: produto "soma de produtos" (ex.: Total de produtos do Televendas)
-- A meta é lançada nele (ex.: 200) e o realizado é a soma automática
-- dos produtos que o compõem (ex.: Alta Móvel + Alta Fibra + Reno Móvel...).
-- Rodar UMA vez no SQL Editor.
-- =====================================================================
alter table public.produtos add column if not exists tipo text not null default 'simples'
  check (tipo in ('simples','composto'));

create table if not exists public.produto_componentes (
  produto_id uuid not null references public.produtos(id) on delete cascade,     -- o produto soma
  componente_id uuid not null references public.produtos(id) on delete cascade,  -- o que entra na soma
  peso numeric not null default 1 check (peso > 0),                              -- quanto cada venda vale (1 = uma)
  primary key (produto_id, componente_id),
  check (produto_id <> componente_id)
);

alter table public.produto_componentes enable row level security;
drop policy if exists ler on public.produto_componentes;
drop policy if exists inserir on public.produto_componentes;
drop policy if exists alterar on public.produto_componentes;
drop policy if exists excluir on public.produto_componentes;
create policy ler on public.produto_componentes for select to authenticated using (public.usuario_ativo());
create policy inserir on public.produto_componentes for insert to authenticated with check (public.pode_editar());
create policy alterar on public.produto_componentes for update to authenticated using (public.pode_editar()) with check (public.pode_editar());
create policy excluir on public.produto_componentes for delete to authenticated using (public.pode_editar());
grant select, insert, update, delete on public.produto_componentes to authenticated;
grant all on public.produto_componentes to service_role;
