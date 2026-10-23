-- =====================================================================
-- 046 · Ajuste do 045: o sistema já tinha a tabela "campanhas" (campanhas com itens, participantes e resultados).
--   - apaga a tabela campanha_pedidos criada no 045 (vazia, não é usada; as regras automáticas vão ficar nos itens)
--   - pedidos_linhas e fontes_campos continuam (são a base das regras automáticas)
-- Pode rodar de novo sem problema.
-- =====================================================================
drop table if exists public.campanha_pedidos;
