-- =====================================================================
-- Atualização: % de fechamento esperado em cada material
-- Rodar UMA vez no SQL Editor (depois do 022). Pode rodar de novo sem problema.
-- =====================================================================
alter table public.materiais add column if not exists conversao_esperada numeric
  check (conversao_esperada is null or (conversao_esperada >= 0 and conversao_esperada <= 100)); -- em %, ex.: 2.5

-- a view precisa ser recriada para trazer a coluna nova
drop view if exists public.materiais_resumo;
create view public.materiais_resumo with (security_invoker = true) as
select m.*, (select count(*) from public.material_leads l where l.material_id = m.id) as leads
from public.materiais m;
grant select on public.materiais_resumo to authenticated;
