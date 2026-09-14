-- OPTIONAL: exact automatic 6-hour lottery draw.
-- Run only if your Supabase project has pg_cron enabled.
-- The app already draws the previous slot on first visit, so this is optional.

create extension if not exists pg_cron with schema extensions;
select cron.schedule(
  'kolegame-lottery-every-6-hours',
  '0 */6 * * *',
  $$select public.draw_lottery_if_needed();$$
)
where not exists (select 1 from cron.job where jobname='kolegame-lottery-every-6-hours');
