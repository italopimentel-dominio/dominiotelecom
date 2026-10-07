-- =====================================================================
-- Atualização: vendas linha a linha (com CNPJ) vindas das fontes de dados
-- Base para cruzar com os materiais enviados (Preparador).
-- Rodar UMA vez no SQL Editor (depois do 020). Pode rodar de novo sem problema.
-- =====================================================================

create table if not exists public.vendas_linhas (
  id bigint generated always as identity primary key,
  fonte_id uuid references public.fontes_dados(id) on delete cascade,
  sincronizacao_id uuid not null references public.sincronizacoes(id) on delete cascade,
  substituida_por uuid references public.sincronizacoes(id) on delete cascade, -- gravação mais nova do mesmo mês
  mes text not null,                  -- '2026-10'
  consultor text not null,            -- nome como vem na planilha
  cnpj text,                          -- só dígitos: 14 (CNPJ) ou 11 (CPF)
  documento_valido boolean not null default false,
  destino text not null,              -- alta, reno, aparelhos...
  produto_id uuid references public.produtos(id) on delete set null,
  qtd numeric not null default 0,
  valor numeric not null default 0,
  pedido text,                        -- NEO / número do pedido, quando houver
  classe text,
  criado_em timestamptz not null default now()
);

create index if not exists vendas_linhas_cnpj on public.vendas_linhas (cnpj) where substituida_por is null;
create index if not exists vendas_linhas_fonte_mes on public.vendas_linhas (fonte_id, mes) where substituida_por is null;
create index if not exists vendas_linhas_sinc on public.vendas_linhas (sincronizacao_id);
create index if not exists vendas_linhas_subst on public.vendas_linhas (substituida_por);

alter table public.vendas_linhas enable row level security;
drop policy if exists ler on public.vendas_linhas;
drop policy if exists inserir on public.vendas_linhas;
drop policy if exists alterar on public.vendas_linhas;
drop policy if exists apagar on public.vendas_linhas;
create policy ler on public.vendas_linhas for select to authenticated using (public.usuario_ativo());
create policy inserir on public.vendas_linhas for insert to authenticated with check (public.pode_editar());
create policy alterar on public.vendas_linhas for update to authenticated using (public.pode_editar()) with check (public.pode_editar());
create policy apagar on public.vendas_linhas for delete to authenticated using (public.pode_editar());
