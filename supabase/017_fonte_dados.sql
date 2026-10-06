-- =====================================================================
-- Atualização: fonte de dados (planilha do Google), registro das leituras
-- com cópia de segurança para desfazer, e meses fechados.
-- Rodar UMA vez no SQL Editor.
-- =====================================================================
alter table public.periodos add column if not exists fechado boolean not null default false;

create table if not exists public.fontes_dados (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  url text not null,
  modelo text not null default 'pedidos_movel',   -- regra de leitura
  config jsonb not null default '{}'::jsonb,      -- quais produtos do sistema recebem cada resultado
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Cada vez que a planilha é gravada no sistema: o que mudou e os valores de antes (para desfazer)
create table if not exists public.sincronizacoes (
  id uuid primary key default gen_random_uuid(),
  fonte_id uuid references public.fontes_dados(id) on delete set null,
  url text,
  executado_em timestamptz not null default now(),
  executado_por uuid references public.profiles(id) on delete set null default auth.uid(),
  meses text[],
  resumo jsonb,
  antes jsonb,
  depois jsonb,
  desfeita_em timestamptz,
  desfeita_por uuid references public.profiles(id) on delete set null
);
create index if not exists sinc_fonte on public.sincronizacoes (fonte_id, executado_em desc);

do $$
declare t text;
begin
  foreach t in array array['fontes_dados','sincronizacoes'] loop
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
grant select, insert, update, delete on public.fontes_dados, public.sincronizacoes to authenticated;
grant all on public.fontes_dados, public.sincronizacoes to service_role;
