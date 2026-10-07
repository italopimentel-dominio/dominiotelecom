-- =====================================================================
-- Atualização: materiais enviados (bases de leads) e seus CNPJs
-- Cada material vai para UMA equipe. Alimentado pelo Preparador, por planilha ou colando CNPJs.
-- Só administrador cadastra; quem usa o sistema pode ler (para a tela de conversão).
-- Rodar UMA vez no SQL Editor (depois do 021). Pode rodar de novo sem problema.
-- =====================================================================

create table if not exists public.materiais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  enviado_em date not null,
  grupo_id uuid references public.grupos(id) on delete set null,   -- equipe que recebeu
  origem text not null default 'planilha' check (origem in ('preparador', 'planilha', 'manual')),
  observacao text,
  criado_por uuid references public.profiles(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now()
);

create table if not exists public.material_leads (
  id bigint generated always as identity primary key,
  material_id uuid not null references public.materiais(id) on delete cascade,
  cnpj text not null,          -- só dígitos: 14 (CNPJ) ou 11 (CPF)
  destinatario text,           -- consultor ou lote que recebeu o lead, quando houver
  unique (material_id, cnpj)
);
create index if not exists material_leads_cnpj on public.material_leads (cnpj);
create index if not exists materiais_enviado on public.materiais (enviado_em);

-- total de leads por material (respeita as regras de acesso de quem consulta)
create or replace view public.materiais_resumo with (security_invoker = true) as
select m.*, (select count(*) from public.material_leads l where l.material_id = m.id) as leads
from public.materiais m;

alter table public.materiais enable row level security;
alter table public.material_leads enable row level security;

drop policy if exists ler on public.materiais;
drop policy if exists escrever on public.materiais;
create policy ler on public.materiais for select to authenticated using (public.usuario_ativo());
create policy escrever on public.materiais for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists ler on public.material_leads;
drop policy if exists escrever on public.material_leads;
create policy ler on public.material_leads for select to authenticated using (public.usuario_ativo());
create policy escrever on public.material_leads for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

grant select on public.materiais_resumo to authenticated;
