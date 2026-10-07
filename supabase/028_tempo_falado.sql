-- =====================================================================
-- Atualização: relatório mensal de tempo falado (LeadsBuilder + 3C + ponto)
-- Uma linha por pessoa e mês; gravar o mês de novo substitui as linhas dele.
-- Rodar UMA vez no SQL Editor (depois do 027). Pode rodar de novo sem problema.
-- =====================================================================
create table if not exists public.tempo_falado (
  id bigint generated always as identity primary key,
  mes text not null,                         -- '2026-09'
  chave text not null,                       -- colaborador_id ou "nome:<nome normalizado>"
  colaborador_id uuid references public.colaboradores(id) on delete set null,
  nome text not null,
  empresa text,                              -- CNPJ da folha de ponto (ex.: JD, D2)
  lb_seg int not null default 0,             -- falando no LeadsBuilder (segundos)
  lb_tma int not null default 0,
  c3_seg int not null default 0,             -- falando no 3C = speaking + MTPA + manual
  c3_speaking int not null default 0,
  c3_mtpa int not null default 0,
  c3_manual int not null default 0,
  ligacoes int not null default 0,
  falando int not null default 0,
  tma int not null default 0,
  dias int not null default 0,
  media int not null default 0,              -- falando ÷ dias
  alertas text[],
  nomes_origem text[],
  atualizado_em timestamptz not null default now(),
  unique (mes, chave)
);
create index if not exists tempo_falado_mes on public.tempo_falado (mes);

alter table public.tempo_falado enable row level security;
drop policy if exists ler on public.tempo_falado;
drop policy if exists escrever on public.tempo_falado;
create policy ler on public.tempo_falado for select to authenticated using (public.usuario_ativo());
create policy escrever on public.tempo_falado for all to authenticated using (public.pode_editar()) with check (public.pode_editar());
grant select, insert, update, delete on public.tempo_falado to authenticated;
