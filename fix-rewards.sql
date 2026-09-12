-- KoleGame reward system repair for an EXISTING Supabase database.
-- Safe to run repeatedly. Adds one atomic RPC for game rewards.

create or replace function public.award_game_reward(p_amount bigint, p_game text default 'game')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_old bigint;
  v_new bigint;
  v_xp bigint;
  v_level integer;
  v_new_level integer;
  v_game text := left(coalesce(nullif(trim(p_game), ''), 'game'), 40);
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000 then
    raise exception 'invalid reward';
  end if;

  select coins, xp, level
    into v_old, v_xp, v_level
    from public.profiles
   where id = v_user
   for update;

  if not found then
    raise exception 'profile not found';
  end if;

  v_new := v_old + p_amount;
  v_xp := coalesce(v_xp, 0) + least(p_amount, 120);
  v_new_level := greatest(1, floor(v_xp / 250)::int + 1);

  update public.profiles
     set coins = v_new,
         xp = v_xp,
         level = v_new_level
   where id = v_user;

  return jsonb_build_object(
    'ok', true,
    'game', v_game,
    'coins', v_new,
    'xp', v_xp,
    'level', v_new_level,
    'leveled_up', v_new_level > coalesce(v_level, 1)
  );
end;
$$;

revoke all on function public.award_game_reward(bigint, text) from public;
grant execute on function public.award_game_reward(bigint, text) to authenticated;

-- Keep the previous RPC available for wheel/lottery/bank compatibility.
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
