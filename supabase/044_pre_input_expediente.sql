-- =====================================================================
-- 044 · Pré-Input: expediente por dia da semana (sexta até as 17h)
-- 0 = domingo, 1 = segunda … 6 = sábado. Dia fora da lista = sem expediente.
-- Rodar depois do 043. Pode rodar de novo sem problema (não sobrescreve o que você já editou).
-- =====================================================================
alter table public.preinput_config
  add column if not exists horarios jsonb not null
  default '{"1":["08:00","18:00"],"2":["08:00","18:00"],"3":["08:00","18:00"],"4":["08:00","18:00"],"5":["08:00","17:00"]}'::jsonb;
