-- =====================================================================
-- 043 · Pré-Input
-- Movimentações e produtos importados das exportações do CRM, e os parâmetros (expediente, SLA e filas).
-- Já vem preenchido com a planilha de parâmetros. Rodar depois do 042. Pode rodar de novo sem problema
-- (não sobrescreve parâmetros que você já editou na tela).
-- =====================================================================

create table if not exists public.preinput_movimentos (
  neo text not null,
  data_hora timestamp not null,        -- hora local (São Paulo), como vem na exportação
  fila text not null,                  -- texto depois de "Movimentado para"
  usuario text,
  importado_em timestamptz not null default now(),
  primary key (neo, data_hora, fila)
);
create index if not exists preinput_movimentos_fila on public.preinput_movimentos (fila, data_hora);

create table if not exists public.preinput_itens (
  neo text not null,
  item text not null default '',
  grupo text not null,
  produto text not null default '',
  qtd numeric not null default 1,
  importado_em timestamptz not null default now(),
  primary key (neo, item, grupo, produto)
);

create table if not exists public.preinput_config (
  id int primary key default 1 check (id = 1),
  inicio time not null default '08:00',
  fim time not null default '18:00',
  sla_padrao numeric not null default 6
);
insert into public.preinput_config (id) values (1) on conflict do nothing;

create table if not exists public.preinput_sla (
  grupo text primary key,              -- GRUPO do arquivo de produção
  horas numeric not null
);

create table if not exists public.preinput_filas (
  fila text primary key,               -- texto depois de "Movimentado para"
  tipo text not null check (tipo in ('entrada', 'destino')),
  grupo text                           -- grupo de entrada ou de destino (vazio = "Sem grupo definido")
);

create table if not exists public.preinput_grupos (
  nome text primary key,               -- grupos de destino, na ordem do dashboard
  ordem int not null default 0
);

-- valores da planilha de parâmetros
insert into public.preinput_sla (grupo, horas) values
  ('Móvel Altas Totais', 3),
  ('Móvel - Migração', 6),
  ('Móvel Altas - Novo', 3),
  ('Móvel Altas - Portabilidade', 3),
  ('Fixa Básica Ativação Total - Voz | Dados | SVA', 6),
  ('Fixa Básica Ativação - Somente Banda Larga', 3),
  ('Fixa Básica Renovação Total - Voz | Dados | SVA', 6),
  ('Fixa Básica Renovação - Somente Banda Larga', 6),
  ('Móvel - Migração PP', 6),
  ('Fixa Avançada Ativação', 6),
  ('Fixa Avançada Renovação', 6),
  ('Energia', 6),
  ('Móvel - SVA', 6),
  ('Fixa Básica PF Ativação Total - Voz | Dados | SVA', 6),
  ('Móvel Altas - Modem', 3),
  ('Fixa Básica PF Ativação - Somente Banda Larga', 6),
  ('Móvel - Trocas', 6),
  ('Móvel - Aparelhos', 3),
  ('TI', 6),
  ('Móvel - TT', 6),
  ('Fixa Básica PF Renovação Total - Voz | Dados | SVA', 6),
  ('Microsoft Office 365', 6),
  ('Fixa Básica TT', 6),
  ('Fixa Básica PF Renovação - Somente Banda Larga', 6),
  ('Móvel - Migração + TT', 6),
  ('Móvel - M2M', 6)
on conflict do nothing;

insert into public.preinput_filas (fila, tipo, grupo) values
  ('LINK ACEITO / TERMOS ASSINADOS', 'entrada', 'LINK ACEITO'),
  ('ENVIADO PARA PRÉ INPUT (MÓVEL)', 'entrada', 'PRÉ-INPUT MÓVEL'),
  ('ENVIADO PARA PRÉ INPUT (FIXA)', 'entrada', 'PRÉ-INPUT FIXA'),
  ('ENVIADO PARA PRÉ INPUT (VADA)', 'entrada', 'PRÉ-INPUT VADA'),
  ('PEDIDO TRATADO - PRÉ INPUT', 'entrada', 'TRATADOS PRÉ-INPUT'),
  ('INPUT CRIVO MOVEL', 'destino', 'INPUT'),
  ('INPUT CRIVO FIXA', 'destino', 'INPUT'),
  ('PEDIDO TRATADO - BKO', 'destino', 'INPUT'),
  ('MESA DE FRAUDE- (SLA TRATATIVA VIVO: 48HRS)', 'destino', 'MOVIMENTAÇÃO ERRADA'),
  ('CREDITO APROVADO (ANALISE BKO)- (SLA TRATATIVA VIVO: 48HRS)', 'destino', 'MOVIMENTAÇÃO ERRADA'),
  ('INSTALAÇÃO AGENDADA', 'destino', 'MOVIMENTAÇÃO ERRADA'),
  ('ANALISE MANUAL DE CREDITO- (SLA TRATATIVA VIVO: 48HRS)', 'destino', 'MOVIMENTAÇÃO ERRADA'),
  ('ENVIAR LINK CPF', 'destino', 'MOVIMENTAÇÃO ERRADA'),
  ('LINK ACEITO CPF', 'destino', 'MOVIMENTAÇÃO ERRADA'),
  ('FINALIZADO (APTO PARA PAGAMENTO)', 'destino', 'MOVIMENTAÇÃO ERRADA'),
  ('AGUARDANDO INTERACAO', 'destino', 'MOVIMENTAÇÃO ERRADA'),
  ('AG ACEITE/ASSINATURA 75%', 'destino', 'MOVIMENTAÇÃO ERRADA'),
  ('INSTALADO', 'destino', 'MOVIMENTAÇÃO ERRADA'),
  ('BKO APROVADO - (SLA TRATATIVA VIVO: 48HRS)', 'destino', 'MOVIMENTAÇÃO ERRADA'),
  ('AG. INPUT AUTOMATICO (FIXA)', 'destino', 'MOVIMENTAÇÃO ERRADA'),
  ('VALIDAÇÃO REALTA', 'destino', 'MOVIMENTAÇÃO ERRADA'),
  ('INICIO NEGOCIAÇÃO 25%', 'destino', 'MOVIMENTAÇÃO ERRADA'),
  ('AGUARDANDO ACEITE', 'destino', 'AGUARDANDO ACEITE'),
  ('AGUARDANDO ACEITE CPF', 'destino', 'AGUARDANDO ACEITE'),
  ('PRÉ INPUT - 1ª TENTATIVA SEM SUCESSO', 'destino', 'PRÉ INPUT - 1ª TENTATIVA SEM SUCESSO'),
  ('QUALITY POR E-MAIL (MOVEL)', 'destino', 'QUALITY POR E-MAIL'),
  ('QUALITY POR EMAIL (FIXA)', 'destino', 'QUALITY POR E-MAIL'),
  ('QUALITY POR EMAIL (VADA)', 'destino', 'QUALITY POR E-MAIL'),
  ('PENDENTE CONSULTOR (DOCUMENTAÇÃO/INFORMAÇÃO)', 'destino', 'PENDENTE CONSULTOR (DOCUMENTAÇÃO/INFORMAÇÃO)'),
  ('PENDENTE CONSULTOR ( SEM VIABILIDADE )', 'destino', 'PENDENTE CONSULTOR (DOCUMENTAÇÃO/INFORMAÇÃO)'),
  ('PENDENTE CONSULTOR', 'destino', 'PENDENTE CONSULTOR (DOCUMENTAÇÃO/INFORMAÇÃO)'),
  ('AGUARDANDO CASO', 'destino', 'PENDENCIA OPERADORA'),
  ('PENDENTE CHAMADO (MOVEL)', 'destino', 'PENDENCIA OPERADORA'),
  ('PENDENTE CHAMADO (VADA)', 'destino', 'PENDENCIA OPERADORA'),
  ('PENDENTE CHAMADO (FIXA)', 'destino', 'PENDENCIA OPERADORA'),
  ('CANCELADO', 'destino', 'CANCELADO'),
  ('PENDENTE CONSULTOR (RETORNO CHAMADO)', 'destino', null),
  ('CREDITO REPROVADO', 'destino', null),
  ('PENDENTE CONSULTOR (DE ACORDO TT PRE)', 'destino', null),
  ('ANALISE MANUAL DE CREDITO- REANALISE- (SLA TRATATIVA VIVO: 48HRS)', 'destino', null),
  ('SEM CONTATO', 'destino', null),
  ('MESA DE FRAUDE - REANALISE- (SLA TRATATIVA VIVO: 48HRS)', 'destino', null),
  ('REPROVADO MESA DE FRAUDE', 'destino', null),
  ('LOGISTICA CONCLUIDA', 'destino', null),
  ('EM ROTA DE ENTREGA - AGUARDANDO ENVIO AUTOMATICO 2ª FASE', 'destino', null),
  ('PORTABILIDADE CONCLUÍDA', 'destino', null),
  ('PENDENTE CONSULTOR (ACEITE EXPIRADO)', 'destino', null),
  ('PENDENTE CONSULTOR - CPF', 'destino', null),
  ('PROPOSTA ENVIADA 50%', 'destino', null),
  ('PENDENTE CONSULTOR (INADIMPLENTE)', 'destino', null),
  ('PENDENTE CONSULTOR (REALTA)', 'destino', null),
  ('INSTALAÇÃO AGENDADA - B2C', 'destino', null)
on conflict do nothing;

insert into public.preinput_grupos (nome, ordem) values
  ('INPUT', 1),
  ('MOVIMENTAÇÃO ERRADA', 2),
  ('AGUARDANDO ACEITE', 3),
  ('PRÉ INPUT - 1ª TENTATIVA SEM SUCESSO', 4),
  ('QUALITY POR E-MAIL', 5),
  ('PENDENTE CONSULTOR (DOCUMENTAÇÃO/INFORMAÇÃO)', 6),
  ('PENDENCIA OPERADORA', 7),
  ('CANCELADO', 8)
on conflict do nothing;

-- permissões: todos que entram no sistema leem; quem edita (editor/admin) importa e altera parâmetros
do $$
declare t text;
begin
  foreach t in array array['preinput_movimentos','preinput_itens','preinput_config','preinput_sla','preinput_filas','preinput_grupos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists ler on public.%I', t);
    execute format('drop policy if exists gravar on public.%I', t);
    execute format('create policy ler on public.%I for select to authenticated using (public.usuario_ativo())', t);
    execute format('create policy gravar on public.%I for all to authenticated using (public.pode_editar()) with check (public.pode_editar())', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
