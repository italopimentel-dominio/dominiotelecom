-- =====================================================================
-- Atualização: nova regra de validação automática dos parceiros do Indireto
-- Valida sozinho quando:
--   1) o parceiro tem pelo menos um treinamento realizado (com data),
--   2) cada tipo de treinamento realizado tem o formulário daquele tipo respondido, e
--   3) o parceiro tem venda vinculada.
-- Fora disso, só o gerente valida. Responder formulário NÃO valida mais sozinho.
-- A regra só aprova quem está "aguardando validação" (nunca mexe em reprovado nem desfaz).
-- Rodar UMA vez no SQL Editor (depois do 025). Pode rodar de novo sem problema.
-- =====================================================================

create or replace function public.avaliar_validacao_automatica(p_parceiro uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  p parceiros%rowtype;
begin
  select * into p from parceiros where id = p_parceiro;
  if p.id is null or p.validacao <> 'pendente' or p.venda_mes is null then return false; end if;
  if not exists (select 1 from parceiro_treinamentos where parceiro_id = p.id and status = 'realizado') then return false; end if;
  if exists (
    select 1 from (select distinct tipo from parceiro_treinamentos where parceiro_id = p.id and status = 'realizado') t
    where not exists (select 1 from parceiro_respostas_form r
                      where r.parceiro_id = p.id and r.tipo_treinamento = t.tipo and not r.ignorada)
  ) then return false; end if;

  perform set_config('app.validacao_automatica', 'on', true);
  update parceiros set validacao = 'aprovado',
    validacao_motivo = 'Validado automaticamente: treinamentos com formulário respondido e venda vinculada (' ||
                       substr(p.venda_mes, 6, 2) || '/' || substr(p.venda_mes, 1, 4) || ').'
  where id = p.id;
  perform set_config('app.validacao_automatica', 'off', true);
  return true;
end $$;
grant execute on function public.avaliar_validacao_automatica(uuid) to authenticated, service_role;

-- Resposta de formulário: marca respondido, registra o treinamento e apontamento; a validação passa pela regra nova.
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

  -- o flag evita que a gravação devolva o parceiro para "aguardando validação"
  perform set_config('app.validacao_automatica', 'on', true);
  update parceiros set form_respondido_em = greatest(coalesce(form_respondido_em, r.respondido_em), r.respondido_em)
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

  perform public.avaliar_validacao_automatica(r.parceiro_id);
end $$;
grant execute on function public.aplicar_resposta_form(uuid) to authenticated, service_role;

-- Venda vinculada: depois de gravar a venda, avalia a validação de quem recebeu venda agora.
create or replace function public.registrar_vendas_parceiros(p_sinc uuid, p_vendas jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare
  ids uuid[];
  i uuid;
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
  ), feitos as (
    update parceiros p set
      venda_mes = a.mes, venda_produto = a.produto, venda_qtd = a.qtd, venda_valor = a.valor,
      venda_registrada_em = now(), venda_sincronizacao = p_sinc
    from alvo a where p.id = a.id
    returning p.id
  )
  select coalesce(array_agg(id), '{}') into ids from feitos;
  perform set_config('app.registro_sistema', 'off', true);
  foreach i in array ids loop
    perform public.avaliar_validacao_automatica(i);
  end loop;
  return coalesce(array_length(ids, 1), 0);
end $$;

-- Treinamento registrado ou alterado na mão: avalia de novo
create or replace function public.treinamento_avalia_validacao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.avaliar_validacao_automatica(new.parceiro_id);
  return new;
end $$;
drop trigger if exists avalia_validacao on public.parceiro_treinamentos;
create trigger avalia_validacao after insert or update on public.parceiro_treinamentos
for each row execute function public.treinamento_avalia_validacao();

-- Respostas vinculadas na mão (lista "sem parceiro"): avalia também
create or replace function public.resposta_avalia_validacao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.parceiro_id is not null then perform public.avaliar_validacao_automatica(new.parceiro_id); end if;
  return new;
end $$;
drop trigger if exists avalia_validacao on public.parceiro_respostas_form;
create trigger avalia_validacao after update of parceiro_id, ignorada on public.parceiro_respostas_form
for each row execute function public.resposta_avalia_validacao();

-- Aplica a regra em quem já está aguardando validação
select count(*) filter (where public.avaliar_validacao_automatica(id)) as validados_agora
from public.parceiros where validacao = 'pendente';
