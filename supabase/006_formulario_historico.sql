-- =====================================================================
-- Atualização: CPF, data de ativação, histórico de alterações e
-- integração com o Formulário Google de treinamento.
-- Rodar UMA vez no SQL Editor (depois do 005).
-- =====================================================================

alter table public.parceiros
  add column if not exists cpf text,                              -- só números (parceiro pessoa física)
  add column if not exists data_ativacao date,
  add column if not exists validacao_automatica boolean not null default false,
  add column if not exists form_respondido_em timestamptz;
create unique index if not exists parceiros_cpf_unico on public.parceiros (cpf) where cpf is not null and cpf <> '';

-- Papel de quem fez a requisição (authenticated, service_role...). Sem token = acesso direto ao banco (SQL Editor).
create or replace function public.papel_requisicao() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', 'sem_token');
$$;

-- ---------- Validação: aceita a validação automática feita pelo formulário ----------
create or replace function public.parceiro_validacao() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  automatica boolean := coalesce(current_setting('app.validacao_automatica', true), '') = 'on';
  pode boolean := public.pode_validar_indireto() or automatica or public.papel_requisicao() in ('service_role', 'sem_token');
begin
  if tg_op = 'INSERT' then
    if not pode then
      new.validacao := 'pendente';
      new.validado_por := null;
      new.validado_em := null;
      new.validacao_motivo := null;
      new.validacao_automatica := false;
    end if;
    return new;
  end if;

  if new.validacao is distinct from old.validacao then
    if not pode then
      raise exception 'Somente o gerente pode validar parceiros.';
    end if;
    new.validado_em := now();
    if automatica then
      new.validado_por := null;
      new.validacao_automatica := true;
    else
      new.validado_por := auth.uid();
      new.validacao_automatica := false;
    end if;
  elsif not pode and old.validacao <> 'pendente' then
    new.validacao := 'pendente';
    new.validado_por := null;
    new.validado_em := null;
    new.validacao_automatica := false;
  end if;
  return new;
end $$;

-- ---------- Histórico de alterações ----------
create table if not exists public.parceiro_historico (
  id bigserial primary key,
  parceiro_id uuid not null references public.parceiros(id) on delete cascade,
  usuario_id uuid references public.profiles(id) on delete set null,
  origem text not null default 'usuario',   -- usuario | formulario | sistema
  acao text not null,                        -- criado | alterado
  campo text,
  antes text,
  depois text,
  em timestamptz not null default now()
);
create index if not exists historico_parceiro on public.parceiro_historico (parceiro_id, em desc);

create or replace function public.registrar_historico_parceiro() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  k text;
  o jsonb;
  n jsonb;
  ignorar text[] := array['atualizado_em','atualizado_por','criado_em','validado_em','validado_por','validacao_automatica'];
  quem uuid := auth.uid();
  origem text := case
    when coalesce(current_setting('app.validacao_automatica', true), '') = 'on' then 'formulario'
    when auth.uid() is null then 'sistema'
    else 'usuario' end;
begin
  if tg_op = 'INSERT' then
    insert into parceiro_historico (parceiro_id, usuario_id, origem, acao) values (new.id, quem, origem, 'criado');
    return new;
  end if;
  o := to_jsonb(old) - ignorar;
  n := to_jsonb(new) - ignorar;
  for k in select jsonb_object_keys(n) loop
    if o->k is distinct from n->k then
      insert into parceiro_historico (parceiro_id, usuario_id, origem, acao, campo, antes, depois)
      values (new.id, quem, origem, 'alterado', k, o->>k, n->>k);
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists historico_parceiros on public.parceiros;
create trigger historico_parceiros after insert or update on public.parceiros
for each row execute function public.registrar_historico_parceiro();

-- ---------- Respostas do Formulário Google ----------
create table if not exists public.parceiro_respostas_form (
  id uuid primary key default gen_random_uuid(),
  resposta_id text not null unique,          -- id da resposta no Google Forms (evita duplicar)
  formulario text,
  tipo_treinamento text not null default 'onboarding' check (tipo_treinamento in ('onboarding','telecom','servicos')),
  respondido_em timestamptz not null default now(),
  documento text,                            -- CPF ou CNPJ encontrado nas respostas (só números)
  email text,
  nome text,
  respostas jsonb not null default '{}'::jsonb,
  parceiro_id uuid references public.parceiros(id) on delete set null,
  ignorada boolean not null default false,
  recebido_em timestamptz not null default now()
);
create index if not exists respostas_parceiro on public.parceiro_respostas_form (parceiro_id);

-- Aplica uma resposta já vinculada: marca o formulário como respondido, registra o
-- treinamento como realizado e valida o parceiro automaticamente.
create or replace function public.aplicar_resposta_form(p_resposta uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r parceiro_respostas_form%rowtype;
  nome_tipo text;
begin
  if not (public.papel_requisicao() in ('service_role', 'sem_token') or public.pode_editar_indireto()) then
    raise exception 'Sem permissão.';
  end if;
  select * into r from parceiro_respostas_form where id = p_resposta;
  if r.id is null or r.parceiro_id is null then return; end if;
  nome_tipo := case r.tipo_treinamento when 'telecom' then 'telecom' when 'servicos' then 'serviços' else 'onboarding' end;

  perform set_config('app.validacao_automatica', 'on', true);
  update parceiros set
    form_respondido_em = greatest(coalesce(form_respondido_em, r.respondido_em), r.respondido_em),
    validacao = 'aprovado',
    validacao_motivo = case when validacao = 'aprovado' then validacao_motivo
                            else 'Validado automaticamente: respondeu o formulário de ' || nome_tipo || '.' end
  where id = r.parceiro_id;
  perform set_config('app.validacao_automatica', 'off', true);

  if not exists (select 1 from parceiro_treinamentos
                 where parceiro_id = r.parceiro_id and tipo = r.tipo_treinamento and status = 'realizado') then
    insert into parceiro_treinamentos (parceiro_id, tipo, data, status, observacao, registrado_por)
    values (r.parceiro_id, r.tipo_treinamento, (r.respondido_em at time zone 'America/Sao_Paulo')::date, 'realizado',
            'Confirmado pela resposta do formulário', null);
  end if;

  insert into parceiro_apontamentos (parceiro_id, texto, autor_id)
  values (r.parceiro_id,
          'Respondeu o formulário de treinamento de ' || nome_tipo || ' em ' ||
          to_char(r.respondido_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || '.',
          null);
end $$;
grant execute on function public.aplicar_resposta_form(uuid) to authenticated, service_role;

-- ---------- Segurança ----------
alter table public.parceiro_historico enable row level security;
drop policy if exists ler on public.parceiro_historico;
create policy ler on public.parceiro_historico for select to authenticated using (public.pode_ver_indireto());

alter table public.parceiro_respostas_form enable row level security;
drop policy if exists ler on public.parceiro_respostas_form;
drop policy if exists alterar on public.parceiro_respostas_form;
create policy ler on public.parceiro_respostas_form for select to authenticated using (public.pode_ver_indireto());
create policy alterar on public.parceiro_respostas_form for update to authenticated
  using (public.pode_editar_indireto()) with check (public.pode_editar_indireto());

grant select on public.parceiro_historico to authenticated;
grant select, update on public.parceiro_respostas_form to authenticated;
grant all on public.parceiro_historico, public.parceiro_respostas_form to service_role;
grant usage, select on sequence public.parceiro_historico_id_seq to authenticated, service_role;
