-- =====================================================================
-- Atualização: Totalização aparece DENTRO de Alta Móvel (não é mais uma aba/meta separada)
-- - "Totalização – Vivo Total" passa a se chamar "Totalização – Fibra"
-- - "Totalização" sai das abas e do Quadro de metas e vira um detalhe de Alta Móvel
-- Rodar UMA vez no SQL Editor (depois do 034). Pode rodar de novo sem problema.
-- =====================================================================
alter table public.produtos add column if not exists detalhe_de uuid references public.produtos(id) on delete set null;

update public.produtos set nome = 'Totalização – Fibra' where nome = 'Totalização – Vivo Total';

update public.produtos set ativo = false,
  detalhe_de = (select id from public.produtos where lower(nome) in ('alta móvel', 'alta movel') order by ativo desc limit 1)
where nome = 'Totalização';

select nome, ativo, (select nome from public.produtos x where x.id = p.detalhe_de) as aparece_dentro_de
from public.produtos p where nome like 'Totalização%' order by nome;
