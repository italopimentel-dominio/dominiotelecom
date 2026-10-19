-- =====================================================================
-- Atualização: ponto focal travado e "feito por" nos treinamentos
-- 1) Depois que o parceiro tem ponto focal, só o gerente (validar) ou administrador troca.
-- 2) Cada treinamento guarda QUEM FEZ (pode ser outro ponto focal que não o do parceiro).
--    Sem informar, assume o ponto focal do parceiro.
-- Rodar UMA vez no SQL Editor (depois do 036). Pode rodar de novo sem problema.
-- =====================================================================

-- 1) trava do ponto focal
create or replace function public.parceiro_trava_focal() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.ponto_focal_id is not null and new.ponto_focal_id is distinct from old.ponto_focal_id
     and not (public.pode_validar_indireto() or public.papel_requisicao() in ('service_role', 'sem_token')) then
    raise exception 'Ponto focal travado: depois de definido, só o gerente ou um administrador pode trocar.';
  end if;
  return new;
end $$;
drop trigger if exists trava_focal_parceiros on public.parceiros;
create trigger trava_focal_parceiros before update on public.parceiros
for each row execute function public.parceiro_trava_focal();

-- 2) quem fez o treinamento
alter table public.parceiro_treinamentos add column if not exists feito_por uuid references public.profiles(id) on delete set null;
update public.parceiro_treinamentos t set feito_por = p.ponto_focal_id
from public.parceiros p where p.id = t.parceiro_id and t.feito_por is null;

create or replace function public.treinamento_feito_por_padrao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.feito_por is null then
    select ponto_focal_id into new.feito_por from parceiros where id = new.parceiro_id;
  end if;
  return new;
end $$;
drop trigger if exists feito_por_padrao on public.parceiro_treinamentos;
create trigger feito_por_padrao before insert on public.parceiro_treinamentos
for each row execute function public.treinamento_feito_por_padrao();
create index if not exists parceiro_treinamentos_feito_por on public.parceiro_treinamentos (feito_por);
