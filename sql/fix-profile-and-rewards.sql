-- KoleGame v4: repair missing profile rows and make profile creation robust.
-- Run this ONCE in Supabase SQL Editor. It is safe to run repeatedly.

-- 1) Robust profile trigger for future signups.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_fallback text;
begin
  v_username := left(coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''), ''), 32);
  v_fallback := 'player_' || substr(replace(new.id::text, '-', ''), 1, 12);

  if v_username = '' then
    v_username := v_fallback;
  end if;

  begin
    insert into public.profiles (id, username)
    values (new.id, v_username)
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.profiles (id, username)
    values (new.id, v_fallback)
    on conflict (id) do nothing;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- 2) Repair accounts created before the trigger/profile system existed.
-- A deterministic id-based username avoids collisions with normal usernames.
insert into public.profiles (id, username)
select u.id,
       'player_' || substr(replace(u.id::text, '-', ''), 1, 12)
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- 3) Atomic reward RPC: coins + XP + level in one transaction.
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
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000 then raise exception 'invalid reward'; end if;

  select coins, xp, level into v_old, v_xp, v_level
  from public.profiles where id = v_user for update;
  if not found then raise exception 'profile not found'; end if;

  v_old := coalesce(v_old, 0);
  v_xp := coalesce(v_xp, 0);
  v_level := greatest(1, coalesce(v_level, 1));
  v_new := v_old + p_amount;
  v_xp := v_xp + least(p_amount, 120);
  v_new_level := greatest(1, floor(v_xp / 250)::int + 1);

  update public.profiles
  set coins = v_new, xp = v_xp, level = v_new_level
  where id = v_user;

  return jsonb_build_object('ok', true, 'game', v_game, 'coins', v_new,
    'xp', v_xp, 'level', v_new_level,
    'leveled_up', v_new_level > v_level);
end;
$$;

revoke all on function public.award_game_reward(bigint, text) from public;
grant execute on function public.award_game_reward(bigint, text) to authenticated;

create or replace function public.change_kolecoins(p_amount bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_new bigint;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_amount is null or p_amount = 0 or abs(p_amount) > 1000000 then raise exception 'invalid amount'; end if;
  update public.profiles
  set coins = coins + p_amount
  where id = auth.uid() and coins + p_amount >= 0
  returning coins into v_new;
  if v_new is null then raise exception 'not enough coins or profile not found'; end if;
  return v_new;
end;
$$;

revoke all on function public.change_kolecoins(bigint) from public;
grant execute on function public.change_kolecoins(bigint) to authenticated;
