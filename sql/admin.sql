-- KoleGame ADMIN PANEL — additive migration only.
-- Does NOT delete or reset player data.
-- 1) Run this once after the existing schema migrations.
-- 2) Replace YOUR_AUTH_USER_UUID with your own auth.users.id.

create table if not exists public.kg_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin','superadmin')),
  created_at timestamptz not null default now()
);

alter table public.kg_admins enable row level security;

create or replace function public.kg_is_admin()
returns boolean language sql security definer set search_path=public stable as $$
  select exists(select 1 from public.kg_admins where user_id=auth.uid());
$$;
grant execute on function public.kg_is_admin() to authenticated;

-- Add yourself manually once:
-- insert into public.kg_admins(user_id, role) values ('YOUR_AUTH_USER_UUID','superadmin') on conflict do nothing;

create or replace function public.kg_admin_dashboard()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_users bigint; v_coins numeric; v_bank numeric; v_pets bigint; v_games bigint;
begin
  if not public.kg_is_admin() then raise exception 'admin_only'; end if;
  select count(*), coalesce(sum(coins),0), coalesce(sum(bank_balance),0) into v_users,v_coins,v_bank from profiles;
  select count(*) into v_pets from kg_player_pets;
  select coalesce(sum(1),0) into v_games from kg_transfers;
  return jsonb_build_object('users',v_users,'coins',v_coins,'bank',v_bank,'pets',v_pets,'transfers',v_games);
end;
$$;
grant execute on function public.kg_admin_dashboard() to authenticated;

create or replace function public.kg_admin_users(p_search text default '')
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb;
begin
  if not public.kg_is_admin() then raise exception 'admin_only'; end if;
  select coalesce(jsonb_agg(row_to_json(x) order by x.coins desc),'[]'::jsonb) into v_result
  from (
    select p.id,p.username,p.coins,p.bank_balance,p.xp,p.level,p.streak,p.created_at,p.last_daily_claim,p.last_bank_interest,p.jail_until,
      coalesce((select jsonb_agg(jsonb_build_object('key',pp.pet_key,'level',pp.level)) from kg_player_pets pp where pp.user_id=p.id),'[]'::jsonb) pets,
      coalesce((select jsonb_agg(jsonb_build_object('key',pu.upgrade_key,'level',pu.level)) from kg_player_upgrades pu where pu.user_id=p.id),'[]'::jsonb) upgrades
    from profiles p
    where p.username ilike '%' || coalesce(trim(p_search),'') || '%'
    order by p.coins desc limit 250
  ) x;
  return v_result;
end;
$$;
grant execute on function public.kg_admin_users(text) to authenticated;

create or replace function public.kg_admin_update_user(
  p_user uuid, p_coins bigint default null, p_xp bigint default null, p_level integer default null, p_jail_until timestamptz default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.kg_is_admin() then raise exception 'admin_only'; end if;
  if not exists(select 1 from profiles where id=p_user) then raise exception 'user_not_found'; end if;
  update profiles set
    coins=coalesce(p_coins,coins), xp=coalesce(p_xp,xp), level=coalesce(p_level,level), jail_until=p_jail_until
  where id=p_user;
  return jsonb_build_object('ok',true,'user_id',p_user);
end;
$$;
grant execute on function public.kg_admin_update_user(uuid,bigint,bigint,integer,timestamptz) to authenticated;

create or replace function public.kg_admin_delete_player_data(p_user uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.kg_is_admin() then raise exception 'admin_only'; end if;
  -- Intentionally only removes optional game-owned records. The profile/auth account remains intact.
  delete from kg_player_pets where user_id=p_user;
  delete from kg_player_upgrades where user_id=p_user;
  delete from kg_transfers where from_user=p_user or to_user=p_user;
  return jsonb_build_object('ok',true,'user_id',p_user);
end;
$$;
grant execute on function public.kg_admin_delete_player_data(uuid) to authenticated;
