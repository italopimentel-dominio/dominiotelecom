-- =====================================================================
-- Agendamento da atualização automática (de hora em hora, 8h às 19h, segunda a sexta, horário de Brasília)
-- ANTES DE RODAR: troque COLE_AQUI_O_CRON_SECRET pelo mesmo texto da variável CRON_SECRET da Vercel
-- e confira se o endereço do site está certo (o mesmo que você abre no navegador).
-- Rodar de novo atualiza o agendamento (não duplica).
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$ begin perform cron.unschedule('fontes-automaticas'); exception when others then null; end $$;

-- o horário do pg_cron é UTC: 11h–22h UTC = 8h–19h em Brasília
select cron.schedule('fontes-automaticas', '0 11-22 * * 1-5', $job$
  select net.http_get(
    url := 'https://dominiotelecom.vercel.app/api/cron/fontes?n=' || n,
    headers := jsonb_build_object('Authorization', 'Bearer COLE_AQUI_O_CRON_SECRET'),
    timeout_milliseconds := 60000
  )
  from generate_series(0, 5) as n;  -- uma chamada por fonte (até 6 fontes)
$job$);

-- para conferir: select * from cron.job;            (o agendamento)
--                select * from cron.job_run_details order by start_time desc limit 10;  (as rodadas)
