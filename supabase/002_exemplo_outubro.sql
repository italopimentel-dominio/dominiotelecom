-- =====================================================================
-- OPCIONAL: cria o período Outubro/2026 com as metas da planilha.
-- Rode depois do 001_estrutura.sql. Ajuste os valores pela própria tela depois.
-- =====================================================================
do $$
declare per uuid;
begin
  insert into periodos (nome, referencia, fator_bruto) values ('Outubro 2026', '2026-10-01', 1.30) returning id into per;
  insert into ciclos (periodo_id, codigo, nome, data_inicio, data_fim) values
    (per, 'GERAL', 'Móvel, VADA, TI, Tech e Aparelhos', '2026-10-01', '2026-10-31'),
    (per, 'FIBRA', 'Fibra', '2026-10-01', '2026-10-31');

  insert into metas (periodo_id, grupo_id, produto_id, valor)
  select per, g.id, p.id, v.valor
  from (values
    ('Consultivo', null, 'Alta Móvel', 252), ('Consultivo', null, 'Alta Fibra', 126), ('Consultivo', null, 'Alta VADA', 14100),
    ('Consultivo', null, 'Reno Móvel', 1008), ('Consultivo', null, 'Reno Fibra', 168), ('Consultivo', null, 'Vivo Tech', 740),
    ('Consultivo', null, 'Aparelhos', 92), ('Consultivo', null, 'TI', 560),
    ('São Paulo', 'Consultivo', 'Alta Móvel', 144), ('São Paulo', 'Consultivo', 'Alta Fibra', 72), ('São Paulo', 'Consultivo', 'Alta VADA', 4800),
    ('São Paulo', 'Consultivo', 'Reno Móvel', 576), ('São Paulo', 'Consultivo', 'Reno Fibra', 96), ('São Paulo', 'Consultivo', 'Aparelhos', 48),
    ('Campinas', 'Consultivo', 'Alta Móvel', 108), ('Campinas', 'Consultivo', 'Alta Fibra', 54), ('Campinas', 'Consultivo', 'Alta VADA', 3600),
    ('Campinas', 'Consultivo', 'Reno Móvel', 432), ('Campinas', 'Consultivo', 'Reno Fibra', 72), ('Campinas', 'Consultivo', 'Aparelhos', 36),
    ('Especialista', 'Consultivo', 'Alta VADA', 5700), ('Especialista', 'Consultivo', 'Vivo Tech', 740),
    ('Especialista', 'Consultivo', 'Aparelhos', 8), ('Especialista', 'Consultivo', 'TI', 560),
    ('Televendas', null, 'Alta Móvel', 810), ('Televendas', null, 'Alta Fibra', 76),
    ('Televendas', null, 'Reno Móvel', 500), ('Televendas', null, 'Reno Fibra', 100),
    ('São Paulo', 'Televendas', 'Alta Móvel', 362), ('São Paulo', 'Televendas', 'Alta Fibra', 38),
    ('São Paulo', 'Televendas', 'Reno Móvel', 250), ('São Paulo', 'Televendas', 'Reno Fibra', 50),
    ('Campinas', 'Televendas', 'Alta Móvel', 448), ('Campinas', 'Televendas', 'Alta Fibra', 38),
    ('Campinas', 'Televendas', 'Reno Móvel', 250), ('Campinas', 'Televendas', 'Reno Fibra', 50),
    ('Paloma SP', 'São Paulo', 'Alta Móvel', 240), ('Paloma SP', 'São Paulo', 'Alta Fibra', 18),
    ('Lucas', 'São Paulo', 'Alta Móvel', 112), ('Lucas', 'São Paulo', 'Alta Fibra', 10),
    ('Vitória', 'São Paulo', 'Alta Móvel', 160), ('Vitória', 'São Paulo', 'Alta Fibra', 10),
    ('Vitória', 'São Paulo', 'Reno Móvel', 250), ('Vitória', 'São Paulo', 'Reno Fibra', 50),
    ('Vitor CPS', 'Campinas', 'Alta Móvel', 192), ('Vitor CPS', 'Campinas', 'Alta Fibra', 18),
    ('Ester', 'Campinas', 'Alta Móvel', 160), ('Ester', 'Campinas', 'Alta Fibra', 10),
    ('Arielle', 'Campinas', 'Alta Móvel', 96), ('Arielle', 'Campinas', 'Alta Fibra', 10),
    ('Arielle', 'Campinas', 'Reno Móvel', 250), ('Arielle', 'Campinas', 'Reno Fibra', 50),
    ('Inbound', 'Televendas', 'Reno Móvel', 100), ('Inbound', 'Televendas', 'Reno Fibra', 30),
    ('Inbound', 'Televendas', 'Aparelhos', 25),
    ('Indireto', null, 'Alta Móvel', 1145), ('Indireto', null, 'Alta Fibra', 166), ('Indireto', null, 'Alta VADA', 14000),
    ('Indireto', null, 'Reno Móvel', 1000), ('Indireto', null, 'Reno Fibra', 130), ('Indireto', null, 'Aparelhos', 76)
  ) as v(grupo, pai, produto, valor)
  join grupos g on g.nome = v.grupo
  left join grupos gp on gp.id = g.parent_id
  join produtos p on p.nome = v.produto
  where (v.pai is null and g.parent_id is null) or gp.nome = v.pai;
end $$;
