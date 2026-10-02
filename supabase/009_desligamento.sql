-- =====================================================================
-- Atualização: data de desligamento dos colaboradores
-- Rodar UMA vez no SQL Editor.
-- =====================================================================
alter table public.colaboradores add column if not exists data_desligamento date;
