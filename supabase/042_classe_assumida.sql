-- =====================================================================
-- 042 · Carteira de pedidos: marca os pedidos sem classe que foram contados como Alta
-- Rodar depois do 041. Pode rodar de novo sem problema.
-- =====================================================================
alter table public.pedidos_carteira add column if not exists classe_assumida boolean not null default false;
