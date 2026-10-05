-- =====================================================================
-- Atualização: meta da empresa por indicador e por mês (tela Resumo da empresa)
-- A meta distribuída continua vindo do Quadro de metas; aqui fica só a meta "de cima".
-- Rodar UMA vez no SQL Editor.
-- =====================================================================
create table if not exists public.metas_empresa (
  periodo_id uuid not null references public.periodos(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  valor numeric not null,
  atualizado_em timestamptz default now(),
  atualizado_por uuid,
  primary key (periodo_id, produto_id)
);
drop trigger if exists aud_metas_empresa on public.metas_empresa;
create trigger aud_metas_empresa before insert or update on public.metas_empresa for each row execute function public.auditar();

alter table public.metas_empresa enable row level security;
drop policy if exists ler on public.metas_empresa;
drop policy if exists inserir on public.metas_empresa;
drop policy if exists alterar on public.metas_empresa;
drop policy if exists excluir on public.metas_empresa;
create policy ler on public.metas_empresa for select to authenticated using (public.usuario_ativo());
create policy inserir on public.metas_empresa for insert to authenticated with check (public.pode_editar());
create policy alterar on public.metas_empresa for update to authenticated using (public.pode_editar()) with check (public.pode_editar());
create policy excluir on public.metas_empresa for delete to authenticated using (public.pode_editar());
grant select, insert, update, delete on public.metas_empresa to authenticated;
grant all on public.metas_empresa to service_role;
