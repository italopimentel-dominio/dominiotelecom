-- =====================================================================
-- Atualização: personalização das campanhas e fotos dos colaboradores
-- Rodar UMA vez no SQL Editor.
-- =====================================================================
alter table public.campanhas
  add column if not exists capa_url text,          -- imagem de capa (banner)
  add column if not exists premio_url text,        -- foto do prêmio (vira a linha de chegada)
  add column if not exists cor text,               -- cor principal da campanha (#rrggbb)
  add column if not exists personagem text,        -- conjunto de personagens ou um emoji próprio
  add column if not exists frase text;             -- frase de motivação

alter table public.colaboradores add column if not exists foto_url text;

-- Pasta pública de imagens (os envios são feitos pelo servidor, que confere a permissão)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('midia', 'midia', true, 5242880, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set public = true;
