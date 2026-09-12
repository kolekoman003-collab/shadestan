-- KoleGame reward fix for an EXISTING Supabase database.
-- Safe to run more than once. Does not delete users, profiles, or coins.

create or replace function public.change_kolecoins(p_amount bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new bigint;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_amount is null or p_amount = 0 or abs(p_amount) > 1000000 then
    raise exception 'invalid amount';
  end if;

  update public.profiles
     set coins = coins + p_amount
   where id = auth.uid()
     and coins + p_amount >= 0
   returning coins into v_new;

  if v_new is null then
    raise exception 'not enough coins or profile not found';
  end if;

  return v_new;
end;
$$;

revoke all on function public.change_kolecoins(bigint) from public;
grant execute on function public.change_kolecoins(bigint) to authenticated;
