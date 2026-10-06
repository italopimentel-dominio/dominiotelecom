-- =====================================================================
-- Atualização: nomes de planilha que entram direto numa equipe (sem cadastrar a pessoa)
-- Ex.: vendedores do Indireto que não são cadastrados como colaboradores.
-- Rodar UMA vez no SQL Editor.
-- =====================================================================
create table if not exists public.apelidos_equipe (
  apelido text primary key,          -- nome normalizado como aparece na planilha
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  criado_em timestamptz not null default now()
);
alter table public.apelidos_equipe enable row level security;
drop policy if exists ler on public.apelidos_equipe;
drop policy if exists inserir on public.apelidos_equipe;
drop policy if exists alterar on public.apelidos_equipe;
drop policy if exists excluir on public.apelidos_equipe;
create policy ler on public.apelidos_equipe for select to authenticated using (public.usuario_ativo());
create policy inserir on public.apelidos_equipe for insert to authenticated with check (public.pode_editar());
create policy alterar on public.apelidos_equipe for update to authenticated using (public.pode_editar()) with check (public.pode_editar());
create policy excluir on public.apelidos_equipe for delete to authenticated using (public.pode_editar());
grant select, insert, update, delete on public.apelidos_equipe to authenticated;
grant all on public.apelidos_equipe to service_role;
