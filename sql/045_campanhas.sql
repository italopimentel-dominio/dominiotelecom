-- =====================================================================
-- 045 · Campanhas
--   pedidos_linhas   : foto das linhas das planilhas (todas as colunas em "dados"), por data de entrada.
--                      Cada leitura da fonte substitui a foto daquela fonte. Guarda o mês atual + 3 anteriores
--                      (ou desde o início da campanha ativa mais antiga).
--   fontes_campos    : cabeçalhos de cada fonte com os valores encontrados (listas da tela de campanhas).
--   campanhas        : nome, período, status e regras (config).
--   campanha_pedidos : pedidos travados nas campanhas com contagem "trava" (bateu a regra uma vez, conta até o fim).
-- Rodar ANTES de subir o código. Pode rodar de novo sem problema.
-- =====================================================================

create table if not exists public.pedidos_linhas (
  id bigserial primary key,
  fonte_id uuid not null references public.fontes_dados(id) on delete cascade,
  linha int not null,                 -- número da linha na planilha
  neo text,
  consultor text not null,
  colaborador_id uuid references public.colaboradores(id) on delete set null,
  grupo_id uuid references public.grupos(id) on delete set null,
  data_entrada date not null,
  destinos text[] not null default '{}', -- produtos do sistema pela classe/tipo (alta, reno, tot...)
  dados jsonb not null default '{}',     -- { "CABEÇALHO": "valor" } (só as células preenchidas)
  gravado_em timestamptz not null default now()
);
create index if not exists pedidos_linhas_fonte_data on public.pedidos_linhas (fonte_id, data_entrada);
create index if not exists pedidos_linhas_colab on public.pedidos_linhas (colaborador_id);

create table if not exists public.fontes_campos (
  fonte_id uuid not null references public.fontes_dados(id) on delete cascade,
  coluna text not null,
  ordem int not null default 0,
  distintos int not null default 0,
  muitos boolean not null default false, -- muitos valores diferentes (ex.: NEO, CNPJ): a tela usa "contém"
  valores jsonb not null default '[]',   -- [{ v: 'INPUTADO', n: 120 }] (os mais frequentes)
  atualizado_em timestamptz not null default now(),
  primary key (fonte_id, coluna)
);

create table if not exists public.campanhas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  inicio date not null,
  fim date not null,
  status text not null default 'rascunho' check (status in ('rascunho', 'ativa', 'encerrada')),
  config jsonb not null default '{}',
  resultado_final jsonb,                 -- foto do resultado ao encerrar (não muda depois)
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (fim >= inicio)
);

create table if not exists public.campanha_pedidos (
  campanha_id uuid not null references public.campanhas(id) on delete cascade,
  fonte_id uuid not null references public.fontes_dados(id) on delete cascade,
  chave text not null,                   -- neo:<NEO> ou linha:<n>
  neo text,
  consultor text not null,
  colaborador_id uuid references public.colaboradores(id) on delete set null,
  grupo_id uuid references public.grupos(id) on delete set null,
  data_entrada date not null,
  qtd numeric not null default 1,
  dados jsonb not null default '{}',
  entrou_em timestamptz not null default now(),
  primary key (campanha_id, fonte_id, chave)
);

-- permissões: todos os usuários ativos leem; quem edita (e a rodada automática) grava
do $$
declare t text;
begin
  foreach t in array array['pedidos_linhas', 'fontes_campos', 'campanhas', 'campanha_pedidos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists ler on public.%I', t);
    execute format('drop policy if exists gravar on public.%I', t);
    execute format('create policy ler on public.%I for select to authenticated using (public.usuario_ativo())', t);
    execute format($p$create policy gravar on public.%I for all to authenticated
      using (public.pode_editar() or public.papel_requisicao() in ('service_role', 'sem_token'))
      with check (public.pode_editar() or public.papel_requisicao() in ('service_role', 'sem_token'))$p$, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
grant usage, select on sequence public.pedidos_linhas_id_seq to authenticated, service_role;
