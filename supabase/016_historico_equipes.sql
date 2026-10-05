-- =====================================================================
-- Atualização: histórico de equipe dos colaboradores (troca de equipe por mês)
-- Cada linha diz: "a partir deste mês, a pessoa é da equipe X".
-- Os meses anteriores continuam contando para a equipe antiga.
-- Rodar UMA vez no SQL Editor.
-- =====================================================================
create table if not exists public.colaborador_equipes (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  desde date not null,                    -- primeiro dia do mês em que passa a valer
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  unique (colaborador_id, desde)
);
create index if not exists colab_equipes_colab on public.colaborador_equipes (colaborador_id, desde);

alter table public.colaborador_equipes enable row level security;
drop policy if exists ler on public.colaborador_equipes;
drop policy if exists inserir on public.colaborador_equipes;
drop policy if exists alterar on public.colaborador_equipes;
drop policy if exists excluir on public.colaborador_equipes;
create policy ler on public.colaborador_equipes for select to authenticated using (public.usuario_ativo());
create policy inserir on public.colaborador_equipes for insert to authenticated with check (public.pode_editar());
create policy alterar on public.colaborador_equipes for update to authenticated using (public.pode_editar()) with check (public.pode_editar());
create policy excluir on public.colaborador_equipes for delete to authenticated using (public.pode_editar());
grant select, insert, update, delete on public.colaborador_equipes to authenticated;
grant all on public.colaborador_equipes to service_role;
