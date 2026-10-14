-- =====================================================================
-- Atualização: assiduidade (P = presente, F = falta, A = atestado)
-- Quem lança: administrador, ou o líder da equipe no organograma (supervisor, coordenador ou acima).
-- Para isso, cada cargo de liderança pode ser ligado ao usuário do sistema dele.
-- Rodar UMA vez no SQL Editor (depois do 031). Pode rodar de novo sem problema.
-- =====================================================================

-- cargo de liderança -> usuário do sistema
alter table public.liderancas add column if not exists profile_id uuid references public.profiles(id) on delete set null;
create unique index if not exists liderancas_profile_unico on public.liderancas (profile_id) where profile_id is not null;

create table if not exists public.assiduidade (
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  data date not null,
  status text not null check (status in ('P', 'F', 'A')),
  grupo_id uuid references public.grupos(id) on delete set null,   -- equipe em que a pessoa estava no dia
  origem text not null default 'manual' check (origem in ('manual', 'ponto', 'planilha')),
  atualizado_por uuid references public.profiles(id) on delete set null default auth.uid(),
  atualizado_em timestamptz not null default now(),
  primary key (colaborador_id, data)
);
create index if not exists assiduidade_data on public.assiduidade (data);
create index if not exists assiduidade_grupo_data on public.assiduidade (grupo_id, data);

-- Equipes que o usuário logado pode lançar: as do cargo dele, as dos cargos abaixo dele e as subequipes
create or replace function public.grupos_lancaveis() returns setof uuid
language sql stable security definer set search_path = public as $$
  with recursive meus as (
    select id from liderancas where profile_id = auth.uid() and ativo
    union
    select l.id from liderancas l join meus m on l.superior_id = m.id where l.ativo
  ), diretos as (
    select grupo_id from lideranca_grupos where lideranca_id in (select id from meus)
  ), arvore as (
    select grupo_id as id from diretos
    union
    select g.id from grupos g join arvore a on g.parent_id = a.id
  )
  select id from arvore;
$$;

create or replace function public.pode_lancar_assiduidade(p_grupo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.eh_admin()
      or public.papel_requisicao() in ('service_role', 'sem_token')
      or (public.usuario_ativo() and p_grupo in (select public.grupos_lancaveis()));
$$;
grant execute on function public.grupos_lancaveis() to authenticated;
grant execute on function public.pode_lancar_assiduidade(uuid) to authenticated;

alter table public.assiduidade enable row level security;
drop policy if exists ler on public.assiduidade;
drop policy if exists inserir on public.assiduidade;
drop policy if exists alterar on public.assiduidade;
drop policy if exists apagar on public.assiduidade;
create policy ler on public.assiduidade for select to authenticated using (public.usuario_ativo());
create policy inserir on public.assiduidade for insert to authenticated with check (public.pode_lancar_assiduidade(grupo_id));
create policy alterar on public.assiduidade for update to authenticated
  using (public.pode_lancar_assiduidade(grupo_id)) with check (public.pode_lancar_assiduidade(grupo_id));
create policy apagar on public.assiduidade for delete to authenticated using (public.pode_lancar_assiduidade(grupo_id));
grant select, insert, update, delete on public.assiduidade to authenticated;
grant all on public.assiduidade to service_role;
