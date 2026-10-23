-- =====================================================================
-- 049 · Campanhas: ajuste manual em item automático
--   Para pedidos que a planilha não trouxe. Cada ajuste guarda a quantidade (ou valor, negativo para tirar),
--   os NEOs dos pedidos e o motivo. Soma por cima do resultado automático (inclusive em campanha fechada).
-- Rodar ANTES de subir o código. Pode rodar de novo sem problema.
-- =====================================================================
create table if not exists public.campanha_ajustes (
  id uuid primary key default gen_random_uuid(),
  participante_id uuid not null references public.campanha_participantes(id) on delete cascade,
  item_id uuid not null references public.campanha_itens(id) on delete cascade,
  qtd numeric not null check (qtd <> 0),
  neos text[] not null check (cardinality(neos) > 0),
  motivo text not null,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
create index if not exists campanha_ajustes_part on public.campanha_ajustes (participante_id);

alter table public.campanha_ajustes enable row level security;
drop policy if exists ler on public.campanha_ajustes;
drop policy if exists inserir on public.campanha_ajustes;
drop policy if exists excluir on public.campanha_ajustes;
create policy ler on public.campanha_ajustes for select to authenticated using (public.usuario_ativo());
create policy inserir on public.campanha_ajustes for insert to authenticated with check (public.pode_editar());
create policy excluir on public.campanha_ajustes for delete to authenticated using (public.pode_editar());
grant select, insert, delete on public.campanha_ajustes to authenticated;
grant all on public.campanha_ajustes to service_role;
