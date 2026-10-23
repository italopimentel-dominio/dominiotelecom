-- =====================================================================
-- 048 · Campanhas: fechar e reabrir
--   fechada_em        : quando a campanha foi fechada (null = aberta)
--   resultado_fechado : foto dos itens automáticos no fechamento
--                       { valores: { item_id: { participante_id: valor } }, automatico: {...}, periodo, gravado_em }
-- Campanha fechada não lê mais as planilhas e não aceita lançamentos; reabrir apaga a foto.
-- Rodar ANTES de subir o código. Pode rodar de novo sem problema.
-- =====================================================================
alter table public.campanhas add column if not exists fechada_em timestamptz;
alter table public.campanhas add column if not exists resultado_fechado jsonb;
