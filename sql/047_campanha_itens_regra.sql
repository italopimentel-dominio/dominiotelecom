-- =====================================================================
-- 047 · Campanhas: itens com regra automática
--   campanha_itens.regra (jsonb): null = resultado lançado à mão;
--   preenchida = resultado calculado pelas linhas das planilhas (pedidos_linhas), pela data de entrada.
--   Também desfaz a permissão "gravar" que o 045 criou a mais na tabela campanhas
--   (as permissões originais "inserir", "alterar", "excluir" e "ler" continuam).
-- Rodar depois do 046 e ANTES de subir o código. Pode rodar de novo sem problema.
-- =====================================================================
alter table public.campanha_itens add column if not exists regra jsonb;
drop policy if exists gravar on public.campanhas;
