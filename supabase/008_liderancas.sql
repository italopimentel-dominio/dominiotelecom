-- =====================================================================
-- Atualização: cargos de liderança para o organograma
-- (Diretor > Gerentes > Coordenadores/Supervisores > equipes)
-- Não muda a estrutura de metas: só desenha quem lidera quem.
-- Rodar UMA vez no SQL Editor.
-- =====================================================================
create table if not exists public.liderancas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cargo text not null,
  superior_id uuid references public.liderancas(id) on delete set null,
  data_admissao date,
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Equipes (grupos) que cada líder comanda diretamente: os colaboradores delas aparecem abaixo dele
create table if not exists public.lideranca_grupos (
  lideranca_id uuid not null references public.liderancas(id) on delete cascade,
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  primary key (lideranca_id, grupo_id)
);

do $$
declare t text;
begin
  foreach t in array array['liderancas','lideranca_grupos'] loop
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

grant select, insert, update, delete on public.liderancas, public.lideranca_grupos to authenticated;
grant all on public.liderancas, public.lideranca_grupos to service_role;
