-- =====================================================================
-- Atualização: pausar / ativar a atualização automática das fontes pela tela
-- Rodar UMA vez no SQL Editor (depois do 029). Pode rodar de novo sem problema.
-- =====================================================================
create table if not exists public.config_sistema (
  chave text primary key,
  valor jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.profiles(id) on delete set null default auth.uid()
);
insert into public.config_sistema (chave, valor) values ('fontes_auto', '{"ativo": true}') on conflict (chave) do nothing;

alter table public.config_sistema enable row level security;
drop policy if exists ler on public.config_sistema;
drop policy if exists escrever on public.config_sistema;
create policy ler on public.config_sistema for select to authenticated using (public.usuario_ativo());
create policy escrever on public.config_sistema for all to authenticated using (public.pode_editar()) with check (public.pode_editar());
grant select, insert, update on public.config_sistema to authenticated;
grant all on public.config_sistema to service_role;
