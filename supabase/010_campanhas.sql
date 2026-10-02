-- =====================================================================
-- Atualização: campanhas comerciais
-- (o headcount não precisa de tabela nova: usa admissão e desligamento)
-- Rodar UMA vez no SQL Editor.
-- =====================================================================
create table if not exists public.campanhas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  regras text,
  premio text,
  data_inicio date not null,
  data_fim date not null,
  tema text not null default 'corrida' check (tema in ('corrida','foguete','podio','termometro')),
  participacao text not null default 'colaborador' check (participacao in ('colaborador','equipe')),
  modo text not null default 'individual' check (modo in ('individual','coletiva')),
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  check (data_fim >= data_inicio)
);

-- O que precisa ser vendido na campanha (texto livre: "Móveis", "Fibras", "Combo"...)
create table if not exists public.campanha_itens (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.campanhas(id) on delete cascade,
  nome text not null,
  alvo numeric not null check (alvo > 0),
  unidade text not null default 'qtd' check (unidade in ('qtd','brl')),
  ordem int not null default 0
);

create table if not exists public.campanha_participantes (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.campanhas(id) on delete cascade,
  colaborador_id uuid references public.colaboradores(id) on delete cascade,
  grupo_id uuid references public.grupos(id) on delete cascade,
  check ((colaborador_id is null) <> (grupo_id is null)),
  unique (campanha_id, colaborador_id),
  unique (campanha_id, grupo_id)
);

-- Resultado lançado manualmente (as regras da campanha são diferentes das metas)
create table if not exists public.campanha_resultados (
  participante_id uuid not null references public.campanha_participantes(id) on delete cascade,
  item_id uuid not null references public.campanha_itens(id) on delete cascade,
  valor numeric not null default 0,
  atualizado_em timestamptz not null default now(),
  primary key (participante_id, item_id)
);

do $$
declare t text;
begin
  foreach t in array array['campanhas','campanha_itens','campanha_participantes','campanha_resultados'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists ler on public.%I', t);
    execute format('drop policy if exists inserir on public.%I', t);
    execute format('drop policy if exists alterar on public.%I', t);
    execute format('drop policy if exists excluir on public.%I', t);
    execute format('create policy ler on public.%I for select to authenticated using (public.usuario_ativo())', t);
    execute format('create policy inserir on public.%I for insert to authenticated with check (public.pode_editar())', t);
    execute format('create policy alterar on public.%I for update to authenticated using (public.pode_editar()) with check (public.pode_editar())', t);
    execute format('create policy excluir on public.%I for delete to authenticated using (public.pode_editar())', t);
  end loop;
end $$;

grant select, insert, update, delete on public.campanhas, public.campanha_itens, public.campanha_participantes, public.campanha_resultados to authenticated;
grant all on public.campanhas, public.campanha_itens, public.campanha_participantes, public.campanha_resultados to service_role;
