-- =====================================================================
-- Atualização: link GERAL por formulário (Onboarding, Telecom, Serviços)
-- Um link só para todo mundo; quem responde informa o CPF/CNPJ e o sistema acha o parceiro.
-- Convive com o link individual. Respostas sem parceiro caem em "Respostas sem parceiro".
-- Rodar UMA vez no SQL Editor (depois do 026). Pode rodar de novo sem problema.
-- =====================================================================

create table if not exists public.form_links_gerais (
  tipo text primary key check (tipo in ('onboarding','telecom','servicos')),
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  criado_por uuid references public.profiles(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now()
);

alter table public.form_links_gerais enable row level security;
drop policy if exists ler on public.form_links_gerais;
drop policy if exists criar on public.form_links_gerais;
drop policy if exists trocar on public.form_links_gerais;
create policy ler on public.form_links_gerais for select to authenticated using (public.pode_ver_indireto());
create policy criar on public.form_links_gerais for insert to authenticated with check (public.pode_editar_indireto());
create policy trocar on public.form_links_gerais for update to authenticated using (public.pode_validar_indireto()) with check (public.pode_validar_indireto());
grant select, insert, update on public.form_links_gerais to authenticated;
grant all on public.form_links_gerais to service_role;

-- Ao vincular uma resposta a um parceiro sem CPF/CNPJ, completa o documento (sem mexer na validação)
create or replace function public.completar_documento_parceiro(p_parceiro uuid, p_doc text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  d text := regexp_replace(coalesce(p_doc, ''), '\D', '', 'g');
begin
  if not (public.pode_editar_indireto() or public.papel_requisicao() in ('service_role', 'sem_token')) then
    raise exception 'Sem permissão.';
  end if;
  if length(d) not in (11, 14) then return false; end if;
  if exists (select 1 from parceiros where cpf = d or cnpj = d) then return false; end if; -- já é de alguém
  perform set_config('app.validacao_automatica', 'on', true);
  update parceiros set
    cpf = case when length(d) = 11 then d else cpf end,
    cnpj = case when length(d) = 14 then d else cnpj end
  where id = p_parceiro and cpf is null and cnpj is null;
  perform set_config('app.validacao_automatica', 'off', true);
  return found;
end $$;
grant execute on function public.completar_documento_parceiro(uuid, text) to authenticated, service_role;
