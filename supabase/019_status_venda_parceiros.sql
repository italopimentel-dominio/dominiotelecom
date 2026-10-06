-- =====================================================================
-- Atualização: Controle Indireto
--  1) Lista de status dos parceiros editável pelo gerente
--  2) Venda vinculada ao parceiro (primeira venda encontrada nas fontes de dados, fixa)
--  3) Data de ativação travada depois da validação ou depois de 30 dias da ativação
--     (só gerente ou administrador altera)
-- Rodar UMA vez no SQL Editor (depois do 018). Pode rodar de novo sem problema.
-- =====================================================================

-- ---------- Nome comparável (sem acento, minúsculo, só letras e números) ----------
create or replace function public.nome_normalizado(t text) returns text
language sql immutable as $$
  select btrim(regexp_replace(regexp_replace(lower(translate(coalesce(t, ''),
    'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')), '[^a-z0-9 ]+', ' ', 'g'), '\s+', ' ', 'g'));
$$;

-- ---------- 1) Status editáveis ----------
create table if not exists public.parceiro_status (
  chave text primary key,
  nome text not null,
  ordem int not null default 0,
  cor text not null default 'neutro' check (cor in ('neutro','ok','acento','atencao','risco')),
  oculto boolean not null default false,   -- some da lista por padrão (ex.: Declinou)
  ativo boolean not null default true,     -- desativado = não aparece para escolher
  criado_em timestamptz not null default now()
);

insert into public.parceiro_status (chave, nome, ordem, cor, oculto) values
  ('aguardando_interacao', 'Aguardando interação', 1, 'neutro', false),
  ('em_contato', 'Em contato', 2, 'acento', false),
  ('declinou', 'Declinou', 3, 'risco', true),
  ('ativo', 'Ativo', 4, 'ok', false),
  ('contato_desatualizado', 'Contato desatualizado', 5, 'atencao', false),
  ('base', 'Base', 6, 'neutro', false)
on conflict (chave) do nothing;

alter table public.parceiro_status enable row level security;
drop policy if exists ler on public.parceiro_status;
drop policy if exists inserir on public.parceiro_status;
drop policy if exists alterar on public.parceiro_status;
create policy ler on public.parceiro_status for select to authenticated using (public.usuario_ativo());
create policy inserir on public.parceiro_status for insert to authenticated with check (public.pode_validar_indireto());
create policy alterar on public.parceiro_status for update to authenticated using (public.pode_validar_indireto()) with check (public.pode_validar_indireto());

-- status antigos -> novos
alter table public.parceiros drop constraint if exists parceiros_status_check;
update public.parceiros set status = case status
  when 'prospeccao' then 'aguardando_interacao'
  when 'onboarding' then 'em_contato'
  when 'inativo' then 'declinou'
  else status end
where status in ('prospeccao', 'onboarding', 'inativo');
alter table public.parceiros alter column status set default 'aguardando_interacao';
alter table public.parceiros drop constraint if exists parceiros_status_fkey;
alter table public.parceiros add constraint parceiros_status_fkey
  foreign key (status) references public.parceiro_status(chave) on update cascade;

-- ---------- 2) Venda vinculada ----------
alter table public.parceiros
  add column if not exists venda_mes text,                 -- '2026-09' (mês de conclusão da venda)
  add column if not exists venda_produto text,
  add column if not exists venda_qtd numeric,
  add column if not exists venda_valor numeric,
  add column if not exists venda_registrada_em timestamptz,
  add column if not exists venda_sincronizacao uuid references public.sincronizacoes(id) on delete set null;

-- ---------- Validação e histórico: aceitam registros do sistema (venda vinculada) ----------
create or replace function public.parceiro_validacao() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  automatica boolean := coalesce(current_setting('app.validacao_automatica', true), '') = 'on';
  sistema boolean := coalesce(current_setting('app.registro_sistema', true), '') = 'on';
  pode boolean := public.pode_validar_indireto() or automatica or sistema or public.papel_requisicao() in ('service_role', 'sem_token');
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
    if not pode or sistema then
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

create or replace function public.registrar_historico_parceiro() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  k text;
  o jsonb;
  n jsonb;
  ignorar text[] := array['atualizado_em','atualizado_por','criado_em','validado_em','validado_por','validacao_automatica',
                          'venda_registrada_em','venda_sincronizacao','ativacao_travada_em'];
  quem uuid := auth.uid();
  origem text := case
    when coalesce(current_setting('app.validacao_automatica', true), '') = 'on' then 'formulario'
    when coalesce(current_setting('app.registro_sistema', true), '') = 'on' then 'sistema'
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
      values (new.id, case when origem = 'sistema' then null else quem end, origem, 'alterado', k, o->>k, n->>k);
    end if;
  end loop;
  return new;
end $$;

-- Grava a primeira venda de cada parceiro (pelo nome). Quem já tem venda vinculada não muda.
-- p_vendas: [{ "nome": "...", "mes": "2026-09", "produto": "Alta Fibra", "qtd": 1, "valor": 99.9 }, ...]
create or replace function public.registrar_vendas_parceiros(p_sinc uuid, p_vendas jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
begin
  if not (public.pode_editar() or public.papel_requisicao() in ('service_role', 'sem_token')) then
    raise exception 'Sem permissão.';
  end if;
  perform set_config('app.registro_sistema', 'on', true);
  with v as (
    select public.nome_normalizado(x->>'nome') as nome, x->>'mes' as mes, x->>'produto' as produto,
           nullif(x->>'qtd', '')::numeric as qtd, nullif(x->>'valor', '')::numeric as valor
    from jsonb_array_elements(coalesce(p_vendas, '[]'::jsonb)) x
  ), primeira as (
    select distinct on (nome) nome, mes, produto, qtd, valor
    from v where nome <> '' and coalesce(qtd, 0) > 0 and mes ~ '^\d{4}-\d{2}$'
    order by nome, mes, qtd desc
  ), alvo as (
    select distinct on (p.id) p.id, f.*
    from parceiros p join primeira f
      on f.nome = public.nome_normalizado(p.nome_fantasia) or f.nome = public.nome_normalizado(p.razao_social)
    where p.venda_mes is null
    order by p.id, f.mes
  )
  update parceiros p set
    venda_mes = a.mes, venda_produto = a.produto, venda_qtd = a.qtd, venda_valor = a.valor,
    venda_registrada_em = now(), venda_sincronizacao = p_sinc
  from alvo a where p.id = a.id;
  get diagnostics n = row_count;
  perform set_config('app.registro_sistema', 'off', true);
  return n;
end $$;

-- Ao desfazer uma gravação, solta as vendas que ela vinculou
create or replace function public.desfazer_vendas_parceiros(p_sinc uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
begin
  if not (public.pode_editar() or public.papel_requisicao() in ('service_role', 'sem_token')) then
    raise exception 'Sem permissão.';
  end if;
  perform set_config('app.registro_sistema', 'on', true);
  update parceiros set venda_mes = null, venda_produto = null, venda_qtd = null, venda_valor = null,
    venda_registrada_em = null, venda_sincronizacao = null
  where venda_sincronizacao = p_sinc;
  get diagnostics n = row_count;
  perform set_config('app.registro_sistema', 'off', true);
  return n;
end $$;

grant execute on function public.registrar_vendas_parceiros(uuid, jsonb) to authenticated;
grant execute on function public.desfazer_vendas_parceiros(uuid) to authenticated;

-- ---------- 3) Trava da data de ativação ----------
-- Depois que o cadastro é validado (uma vez que seja), ou depois de 30 dias da ativação,
-- só gerente/administrador muda a data.
alter table public.parceiros add column if not exists ativacao_travada_em timestamptz;
update public.parceiros set ativacao_travada_em = coalesce(validado_em, now())
where validacao = 'aprovado' and ativacao_travada_em is null;

create or replace function public.parceiro_trava_ativacao() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  pode boolean := public.pode_validar_indireto() or public.papel_requisicao() in ('service_role', 'sem_token');
begin
  -- validou: a data fica travada de vez (mesmo que o cadastro volte para pendente depois)
  if new.validacao = 'aprovado' and old.validacao is distinct from 'aprovado' and new.ativacao_travada_em is null then
    new.ativacao_travada_em := now();
  end if;
  if new.ativacao_travada_em is distinct from old.ativacao_travada_em and not pode
     and not (old.ativacao_travada_em is null and new.validacao = 'aprovado') then
    new.ativacao_travada_em := old.ativacao_travada_em;
  end if;
  if new.data_ativacao is distinct from old.data_ativacao and not pode
     and (old.ativacao_travada_em is not null
          or (old.data_ativacao is not null and old.data_ativacao + 30 < (now() at time zone 'America/Sao_Paulo')::date)) then
    raise exception 'Data de ativação travada: o cadastro já foi validado ou o prazo de 30 dias terminou. Só o gerente ou um administrador pode alterar.';
  end if;
  return new;
end $$;

drop trigger if exists trava_ativacao_parceiros on public.parceiros;
create trigger trava_ativacao_parceiros before update on public.parceiros
for each row execute function public.parceiro_trava_ativacao();
