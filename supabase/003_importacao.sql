-- =====================================================================
-- Atualização: importação de resultados por Excel
-- Rodar UMA vez no SQL Editor (depois do 001).
-- Guarda os "apelidos" dos colaboradores: quando o nome na planilha é diferente
-- do cadastro (ex.: "JOAO S." -> "João Silva"), o sistema lembra na próxima importação.
-- =====================================================================
create table if not exists public.colaborador_apelidos (
  apelido text primary key,  -- nome já normalizado (minúsculo, sem acento)
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  criado_em timestamptz not null default now()
);

alter table public.colaborador_apelidos enable row level security;
drop policy if exists ler on public.colaborador_apelidos;
drop policy if exists inserir on public.colaborador_apelidos;
drop policy if exists alterar on public.colaborador_apelidos;
drop policy if exists excluir on public.colaborador_apelidos;
create policy ler on public.colaborador_apelidos for select to authenticated using (public.usuario_ativo());
create policy inserir on public.colaborador_apelidos for insert to authenticated with check (public.pode_editar());
create policy alterar on public.colaborador_apelidos for update to authenticated using (public.pode_editar()) with check (public.pode_editar());
create policy excluir on public.colaborador_apelidos for delete to authenticated using (public.pode_editar());

grant select, insert, update, delete on public.colaborador_apelidos to authenticated;
grant all on public.colaborador_apelidos to service_role;
