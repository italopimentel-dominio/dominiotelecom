-- =====================================================================
-- Metas da Equipe: estrutura do banco (rodar UMA vez no SQL Editor do Supabase)
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- Usuários do sistema ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  usuario text not null unique,
  nome text not null default '',
  email text,
  papel text not null default 'viewer' check (papel in ('admin','editor','viewer')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Funções de permissão (usadas nas regras de segurança)
create or replace function public.usuario_ativo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and ativo);
$$;
create or replace function public.pode_editar() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and ativo and papel in ('admin','editor'));
$$;
create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and ativo and papel = 'admin');
$$;

-- Ao criar um usuário no Auth, cria o perfil.
-- O primeiro usuário vira administrador. Os demais entram como Visualizador.
-- Contas criadas fora do painel de usuários (cadastro público) entram INATIVAS.
create or replace function public.criar_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  existe_admin boolean;
  pelo_painel boolean;
begin
  select exists (select 1 from profiles where papel = 'admin') into existe_admin;
  pelo_painel := coalesce(new.raw_app_meta_data->>'criado_pelo_painel', 'false') = 'true';
  insert into profiles (id, usuario, nome, email, papel, ativo)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data->>'usuario', split_part(new.email, '@', 1))),
    coalesce(new.raw_user_meta_data->>'nome', ''),
    new.email,
    case when existe_admin then 'viewer' else 'admin' end,
    (not existe_admin) or pelo_painel
  );
  return new;
end $$;

create trigger ao_criar_usuario after insert on auth.users
for each row execute function public.criar_perfil();

-- Login por nome de usuário: devolve o e-mail interno do usuário ativo
create or replace function public.email_do_usuario(p_usuario text) returns text
language sql stable security definer set search_path = public as $$
  select email from profiles where lower(usuario) = lower(trim(p_usuario)) and ativo limit 1;
$$;
grant execute on function public.email_do_usuario(text) to anon, authenticated;

-- ---------- Configuração do calendário ----------
create table public.config (
  id int primary key default 1 check (id = 1),
  sabado_util boolean not null default false,
  feriado_carnaval boolean not null default true,
  feriado_corpus_christi boolean not null default true
);
insert into public.config (id) values (1);

-- ---------- Cadastros ----------
create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  unidade text not null default 'qtd' check (unidade in ('qtd','brl')),
  ciclo text not null default 'GERAL',   -- qual fechamento o produto segue (ex.: GERAL ou FIBRA)
  ordem int not null default 0,
  ativo boolean not null default true
);

-- Árvore: Canal > Regional > Equipe (quantos níveis precisar)
create table public.grupos (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.grupos(id) on delete restrict,
  nome text not null,
  ordem int not null default 0,
  ativo boolean not null default true
);

create table public.colaboradores (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id) on delete restrict,
  nome text not null,
  peso numeric not null default 1 check (peso >= 0),  -- 1 = cota cheia, 0.5 = meia cota
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ---------- Períodos e ciclos de fechamento ----------
create table public.periodos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  referencia date not null unique,          -- primeiro dia do mês
  fator_bruto numeric not null default 1.30, -- necessidade bruta = líquida x fator
  criado_em timestamptz not null default now()
);

create table public.ciclos (
  id uuid primary key default gen_random_uuid(),
  periodo_id uuid not null references public.periodos(id) on delete cascade,
  codigo text not null,
  nome text not null,
  data_inicio date not null,
  data_fim date not null,
  unique (periodo_id, codigo),
  check (data_fim >= data_inicio)
);

-- ---------- Metas e realizado ----------
create table public.metas (
  periodo_id uuid not null references public.periodos(id) on delete cascade,
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  valor numeric not null default 0,
  atualizado_em timestamptz default now(),
  atualizado_por uuid,
  primary key (periodo_id, grupo_id, produto_id)
);

-- Meta fixa de um colaborador (opcional). Sem registro aqui = divisão automática.
create table public.metas_individuais (
  periodo_id uuid not null references public.periodos(id) on delete cascade,
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  valor numeric not null,
  atualizado_em timestamptz default now(),
  atualizado_por uuid,
  primary key (periodo_id, colaborador_id, produto_id)
);

create table public.realizados (
  periodo_id uuid not null references public.periodos(id) on delete cascade,
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  valor numeric not null default 0,
  atualizado_em timestamptz default now(),
  atualizado_por uuid,
  primary key (periodo_id, colaborador_id, produto_id)
);

-- Realizado lançado direto no grupo (para grupos sem colaboradores, ex.: Indireto)
create table public.realizados_grupo (
  periodo_id uuid not null references public.periodos(id) on delete cascade,
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  valor numeric not null default 0,
  atualizado_em timestamptz default now(),
  atualizado_por uuid,
  primary key (periodo_id, grupo_id, produto_id)
);

-- Feriados cadastrados (os nacionais são calculados automaticamente pelo sistema)
-- tipo 'feriado' = não é dia útil | tipo 'dia_util' = conta como dia útil (ex.: sábado trabalhado)
create table public.feriados (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  nome text not null,
  tipo text not null default 'feriado' check (tipo in ('feriado','dia_util')),
  grupo_id uuid references public.grupos(id) on delete cascade  -- vazio = vale para todos
);

-- Registra quem alterou e quando
create or replace function public.auditar() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end $$;
create trigger aud_metas before insert or update on public.metas for each row execute function public.auditar();
create trigger aud_ind before insert or update on public.metas_individuais for each row execute function public.auditar();
create trigger aud_real before insert or update on public.realizados for each row execute function public.auditar();
create trigger aud_realg before insert or update on public.realizados_grupo for each row execute function public.auditar();

-- ---------- Segurança (RLS) ----------
-- Ler: qualquer usuário ativo. Gravar: só Editor e Administrador.
alter table public.profiles enable row level security;
create policy perfis_ler on public.profiles for select to authenticated
  using (id = auth.uid() or public.usuario_ativo());
-- perfis só são alterados pelo servidor (chave secreta), por isso não há policy de escrita

do $$
declare t text;
begin
  foreach t in array array['config','produtos','grupos','colaboradores','periodos','ciclos',
                           'metas','metas_individuais','realizados','realizados_grupo','feriados']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy ler on public.%I for select to authenticated using (public.usuario_ativo())', t);
    execute format('create policy inserir on public.%I for insert to authenticated with check (public.pode_editar())', t);
    execute format('create policy alterar on public.%I for update to authenticated using (public.pode_editar()) with check (public.pode_editar())', t);
    execute format('create policy excluir on public.%I for delete to authenticated using (public.pode_editar())', t);
  end loop;
end $$;

-- ---------- Dados iniciais ----------
insert into public.produtos (nome, unidade, ciclo, ordem) values
  ('Alta Móvel', 'qtd', 'GERAL', 1),
  ('Alta Fibra', 'qtd', 'FIBRA', 2),
  ('Alta VADA', 'brl', 'GERAL', 3),
  ('Reno Móvel', 'qtd', 'GERAL', 4),
  ('Reno Fibra', 'qtd', 'FIBRA', 5),
  ('Vivo Tech', 'brl', 'GERAL', 6),
  ('Aparelhos', 'qtd', 'GERAL', 7),
  ('TI', 'brl', 'GERAL', 8);

do $$
declare cons uuid; tele uuid; ind uuid; tsp uuid; tcp uuid;
begin
  insert into grupos (nome, ordem) values ('Consultivo', 1) returning id into cons;
  insert into grupos (nome, ordem) values ('Televendas', 2) returning id into tele;
  insert into grupos (nome, ordem) values ('Indireto', 3) returning id into ind;
  insert into grupos (parent_id, nome, ordem) values
    (cons, 'São Paulo', 1), (cons, 'Campinas', 2), (cons, 'Especialista', 3);
  insert into grupos (parent_id, nome, ordem) values (tele, 'São Paulo', 1) returning id into tsp;
  insert into grupos (parent_id, nome, ordem) values (tele, 'Campinas', 2) returning id into tcp;
  insert into grupos (parent_id, nome, ordem) values (tele, 'Inbound', 3);
  insert into grupos (parent_id, nome, ordem) values
    (tsp, 'Paloma SP', 1), (tsp, 'Lucas', 2), (tsp, 'Vitória', 3),
    (tcp, 'Vitor CPS', 1), (tcp, 'Ester', 2), (tcp, 'Arielle', 3);
end $$;

-- ---------- Acesso do site às tabelas ----------
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
