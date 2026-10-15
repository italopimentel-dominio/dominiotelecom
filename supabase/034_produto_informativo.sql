-- =====================================================================
-- Atualização: produto "informativo" (sem meta, só para acompanhar)
-- Aparece como aba no painel da equipe quando tem resultado, mesmo sem meta (ex.: Totalização).
-- Rodar UMA vez no SQL Editor (depois do 033). Pode rodar de novo sem problema.
-- =====================================================================
alter table public.produtos add column if not exists informativo boolean not null default false;
update public.produtos set informativo = true where nome = 'Totalização';
