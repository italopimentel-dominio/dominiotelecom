-- =====================================================================
-- 039 · Importação da planilha de acompanhamento do Indireto
-- 1) Treinamento feito em conjunto: "feito_por_2" (segundo ponto focal). Conta para os dois no Acompanhamento.
-- 2) Apelidos dos pontos focais da planilha ("Tayná", "Elias", "Conjunto") ligados aos usuários,
--    para o sistema lembrar nas próximas importações. "Conjunto" liga a dois usuários.
-- Rodar depois do 038. Pode rodar de novo sem problema.
-- =====================================================================

alter table public.parceiro_treinamentos
  add column if not exists feito_por_2 uuid references public.profiles(id) on delete set null;

create table if not exists public.indireto_focal_apelidos (
  apelido text primary key,            -- nome como vem na planilha, normalizado (sem acento, minúsculo)
  profile_id uuid references public.profiles(id) on delete cascade,
  profile_id_2 uuid references public.profiles(id) on delete set null,  -- só para "em conjunto"
  atualizado_em timestamptz not null default now()
);

alter table public.indireto_focal_apelidos enable row level security;
drop policy if exists ler on public.indireto_focal_apelidos;
drop policy if exists gravar on public.indireto_focal_apelidos;
create policy ler on public.indireto_focal_apelidos for select to authenticated using (public.usuario_ativo());
-- a gravação só acontece pela importação, que confere se é gerente ou administrador
create policy gravar on public.indireto_focal_apelidos for all to authenticated
  using (public.usuario_ativo()) with check (public.usuario_ativo());
grant select, insert, update, delete on public.indireto_focal_apelidos to authenticated;
grant all on public.indireto_focal_apelidos to service_role;
