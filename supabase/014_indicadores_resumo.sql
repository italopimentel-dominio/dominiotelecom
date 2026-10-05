-- =====================================================================
-- Atualização: escolher quais indicadores aparecem no Resumo da empresa
-- (vazio = automático). Rodar UMA vez no SQL Editor.
-- =====================================================================
alter table public.config add column if not exists resumo_produtos uuid[];
