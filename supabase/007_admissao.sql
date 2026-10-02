-- =====================================================================
-- Atualização: data de admissão dos colaboradores
-- Rodar UMA vez no SQL Editor.
-- =====================================================================
alter table public.colaboradores add column if not exists data_admissao date;
