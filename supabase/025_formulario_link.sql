-- =====================================================================
-- Atualização: formulário de treinamento dentro do sistema, por link individual
-- O ponto focal gera um link para o parceiro; o parceiro responde sem login;
-- a resposta marca o treinamento como realizado e valida o parceiro (mesma regra do Google Forms).
-- Rodar UMA vez no SQL Editor (depois do 024). Pode rodar de novo sem problema.
-- =====================================================================

-- Perguntas de cada tipo de formulário (o gerente edita)
create table if not exists public.form_perguntas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('onboarding','telecom','servicos')),
  ordem int not null default 0,
  texto text not null,
  tipo_resposta text not null default 'texto' check (tipo_resposta in ('texto','escolha','sim_nao','nota')),
  opcoes text[],                 -- para 'escolha'
  correta text,                  -- resposta certa (opcional): entra na pontuação
  obrigatoria boolean not null default true,
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);
create index if not exists form_perguntas_tipo on public.form_perguntas (tipo, ordem);

-- Links individuais (um por parceiro e tipo; vale uma resposta)
create table if not exists public.form_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  parceiro_id uuid not null references public.parceiros(id) on delete cascade,
  tipo text not null check (tipo in ('onboarding','telecom','servicos')),
  criado_por uuid references public.profiles(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '30 days',
  respondido_em timestamptz,
  resposta_id uuid references public.parceiro_respostas_form(id) on delete set null
);
create index if not exists form_links_parceiro on public.form_links (parceiro_id);

-- pontuação das respostas (quando as perguntas têm resposta certa)
alter table public.parceiro_respostas_form
  add column if not exists acertos int,
  add column if not exists total_pontuavel int;

-- ---------- Segurança ----------
alter table public.form_perguntas enable row level security;
drop policy if exists ler on public.form_perguntas;
drop policy if exists escrever on public.form_perguntas;
create policy ler on public.form_perguntas for select to authenticated using (public.pode_ver_indireto());
create policy escrever on public.form_perguntas for all to authenticated
  using (public.pode_validar_indireto()) with check (public.pode_validar_indireto());

alter table public.form_links enable row level security;
drop policy if exists ler on public.form_links;
drop policy if exists criar on public.form_links;
drop policy if exists apagar on public.form_links;
create policy ler on public.form_links for select to authenticated using (public.pode_ver_indireto());
create policy criar on public.form_links for insert to authenticated with check (public.pode_editar_indireto());
create policy apagar on public.form_links for delete to authenticated using (public.pode_editar_indireto() and respondido_em is null);

grant select, insert, update, delete on public.form_perguntas to authenticated;
grant select, insert, delete on public.form_links to authenticated;
grant all on public.form_perguntas, public.form_links to service_role;
