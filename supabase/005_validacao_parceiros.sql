-- =====================================================================
-- Atualização: validação de parceiros pelo gerente
-- Rodar UMA vez no SQL Editor (depois do 004).
-- Permissões do Controle Indireto passam a ser:
--   nenhum  = não vê o menu
--   ver     = só consulta
--   editar  = ponto focal: cadastra parceiros, treinamentos e apontamentos
--   validar = gerente: tudo do ponto focal + aprova ou reprova cadastros
-- =====================================================================
alter table public.profiles drop constraint if exists profiles_perm_indireto_check;
alter table public.profiles add constraint profiles_perm_indireto_check
  check (perm_indireto in ('nenhum','ver','editar','validar'));

create or replace function public.pode_ver_indireto() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and ativo
                 and (papel = 'admin' or perm_indireto in ('ver','editar','validar')));
$$;
create or replace function public.pode_editar_indireto() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and ativo
                 and (papel = 'admin' or perm_indireto in ('editar','validar')));
$$;
create or replace function public.pode_validar_indireto() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and ativo
                 and (papel = 'admin' or perm_indireto = 'validar'));
$$;
grant execute on function public.pode_validar_indireto() to authenticated;

alter table public.parceiros
  add column if not exists validacao text not null default 'pendente' check (validacao in ('pendente','aprovado','reprovado')),
  add column if not exists validado_por uuid references public.profiles(id) on delete set null,
  add column if not exists validado_em timestamptz,
  add column if not exists validacao_motivo text;

-- Regras garantidas no banco:
-- 1) só gerente/administrador muda a validação;
-- 2) se o ponto focal altera um cadastro já aprovado ou reprovado, ele volta para "pendente".
create or replace function public.parceiro_validacao() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  pode boolean := public.pode_validar_indireto();
begin
  if tg_op = 'INSERT' then
    if not pode then
      new.validacao := 'pendente';
      new.validado_por := null;
      new.validado_em := null;
      new.validacao_motivo := null;
    end if;
    return new;
  end if;

  if new.validacao is distinct from old.validacao then
    if not pode then
      raise exception 'Somente o gerente pode validar parceiros.';
    end if;
    new.validado_por := auth.uid();
    new.validado_em := now();
  elsif not pode and old.validacao <> 'pendente' then
    new.validacao := 'pendente';
    new.validado_por := null;
    new.validado_em := null;
  end if;
  return new;
end $$;

drop trigger if exists validacao_parceiros on public.parceiros;
create trigger validacao_parceiros before insert or update on public.parceiros
for each row execute function public.parceiro_validacao();
