-- =====================================================================
-- Atualização: atualização automática das fontes de dados
-- Guarda o resultado da última rodada (para o aviso no sistema) e os nomes ignorados de cada fonte.
-- Rodar UMA vez no SQL Editor (depois do 028). Pode rodar de novo sem problema.
-- O agendamento em si fica no arquivo 029b_agendar_fontes.sql (precisa do endereço e do segredo).
-- =====================================================================
alter table public.fontes_dados
  add column if not exists auto_em timestamptz,          -- última rodada automática
  add column if not exists auto_status text,             -- ok | pendente | erro
  add column if not exists auto_msg text,
  add column if not exists auto_pendentes jsonb not null default '[]'::jsonb,  -- nomes que não entraram
  add column if not exists auto_hash text;                -- assinatura da última leitura gravada

-- nomes marcados como "ignorar" em cada fonte (o automático não avisa mais deles)
create table if not exists public.nomes_ignorados (
  fonte_id uuid not null references public.fontes_dados(id) on delete cascade,
  apelido text not null,
  criado_em timestamptz not null default now(),
  primary key (fonte_id, apelido)
);
alter table public.nomes_ignorados enable row level security;
drop policy if exists ler on public.nomes_ignorados;
drop policy if exists escrever on public.nomes_ignorados;
create policy ler on public.nomes_ignorados for select to authenticated using (public.usuario_ativo());
create policy escrever on public.nomes_ignorados for all to authenticated using (public.pode_editar()) with check (public.pode_editar());
grant select, insert, update, delete on public.nomes_ignorados to authenticated;
grant all on public.nomes_ignorados to service_role;
