-- =====================================================================
-- Atualização: Controle Indireto (parceiros, treinamentos e apontamentos)
-- Rodar UMA vez no SQL Editor (depois do 001 e do 003).
-- =====================================================================

-- Permissão própria do módulo, independente da permissão de metas:
-- 'nenhum' = não vê o menu | 'ver' = só consulta | 'editar' = ponto focal (cadastra e aponta)
alter table public.profiles add column if not exists perm_indireto text not null default 'ver'
  check (perm_indireto in ('nenhum','ver','editar'));

create or replace function public.pode_ver_indireto() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and ativo
                 and (papel = 'admin' or perm_indireto in ('ver','editar')));
$$;
create or replace function public.pode_editar_indireto() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and ativo
                 and (papel = 'admin' or perm_indireto = 'editar'));
$$;

-- ---------- Parceiros ----------
create table if not exists public.parceiros (
  id uuid primary key default gen_random_uuid(),
  nome_fantasia text not null,
  razao_social text,
  cnpj text,                       -- só números
  codigo text,                     -- código do parceiro / PDV, se houver
  status text not null default 'onboarding' check (status in ('prospeccao','onboarding','ativo','inativo')),
  cidade text,
  uf text,
  endereco text,
  contato_nome text,
  contato_telefone text,
  contato_email text,
  ponto_focal_id uuid references public.profiles(id) on delete set null,
  data_inicio date,                -- data de credenciamento / início da parceria
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);
create unique index if not exists parceiros_cnpj_unico on public.parceiros (cnpj) where cnpj is not null and cnpj <> '';

-- ---------- Treinamentos ----------
create table if not exists public.parceiro_treinamentos (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros(id) on delete cascade,
  tipo text not null check (tipo in ('onboarding','telecom','servicos')),
  data date not null,
  status text not null default 'agendado' check (status in ('agendado','realizado','cancelado')),
  instrutor text,
  observacao text,
  registrado_por uuid references public.profiles(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now()
);
create index if not exists treinamentos_parceiro on public.parceiro_treinamentos (parceiro_id);

-- ---------- Apontamentos (histórico de anotações) ----------
create table if not exists public.parceiro_apontamentos (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros(id) on delete cascade,
  texto text not null,
  autor_id uuid references public.profiles(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now()
);
create index if not exists apontamentos_parceiro on public.parceiro_apontamentos (parceiro_id, criado_em desc);

create or replace function public.parceiro_atualizado() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end $$;
drop trigger if exists aud_parceiros on public.parceiros;
create trigger aud_parceiros before update on public.parceiros for each row execute function public.parceiro_atualizado();

-- ---------- Segurança ----------
do $$
declare t text;
begin
  foreach t in array array['parceiros','parceiro_treinamentos','parceiro_apontamentos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists ler on public.%I', t);
    execute format('drop policy if exists inserir on public.%I', t);
    execute format('drop policy if exists alterar on public.%I', t);
    execute format('drop policy if exists excluir on public.%I', t);
    execute format('create policy ler on public.%I for select to authenticated using (public.pode_ver_indireto())', t);
    execute format('create policy inserir on public.%I for insert to authenticated with check (public.pode_editar_indireto())', t);
  end loop;
end $$;
create policy alterar on public.parceiros for update to authenticated using (public.pode_editar_indireto()) with check (public.pode_editar_indireto());
create policy excluir on public.parceiros for delete to authenticated using (public.eh_admin());
create policy alterar on public.parceiro_treinamentos for update to authenticated using (public.pode_editar_indireto()) with check (public.pode_editar_indireto());
create policy excluir on public.parceiro_treinamentos for delete to authenticated using (public.pode_editar_indireto());
-- apontamento: só quem escreveu (ou um administrador) pode apagar; ninguém altera o texto depois
create policy excluir on public.parceiro_apontamentos for delete to authenticated
  using (public.pode_editar_indireto() and (autor_id = auth.uid() or public.eh_admin()));

grant select, insert, update, delete on public.parceiros, public.parceiro_treinamentos, public.parceiro_apontamentos to authenticated;
grant all on public.parceiros, public.parceiro_treinamentos, public.parceiro_apontamentos to service_role;
grant execute on function public.pode_ver_indireto(), public.pode_editar_indireto() to authenticated;
