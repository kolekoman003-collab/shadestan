-- ================================================================
-- KOLEGAME — FINAL UNIFIED SUPABASE SQL
-- Safe/idempotent setup. DO NOT DROP/TRUNCATE existing player data.
-- Run this entire file once in Supabase SQL Editor.
-- ================================================================

-- ============================================
-- Shadestan (شادستان) — Supabase schema
-- Run this whole file once in Supabase: SQL Editor > New query > Paste > Run
-- ============================================

-- Profiles: one row per player
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  coins bigint not null default 100,
  bank_balance bigint not null default 0,
  last_daily_claim timestamptz,
  last_bank_interest timestamptz default now(),
  jail_until timestamptz,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are viewable by everyone" on public.profiles;

create policy "profiles are viewable by everyone"
  on public.profiles for select
  using (true);

drop policy if exists "users can insert their own profile" on public.profiles;

create policy "users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "users can update their own profile" on public.profiles;

create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Friends: simple one-way "added" list (no request/accept flow)
create table if not exists public.friends (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  friend_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, friend_id)
);

alter table public.friends enable row level security;

drop policy if exists "users can view their own friend list" on public.friends;

create policy "users can view their own friend list"
  on public.friends for select
  using (auth.uid() = user_id);

drop policy if exists "users can add friends" on public.friends;

create policy "users can add friends"
  on public.friends for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can remove their own friends" on public.friends;

create policy "users can remove their own friends"
  on public.friends for delete
  using (auth.uid() = user_id);

-- Helpful index for leaderboard sorting
create index if not exists profiles_coins_idx on public.profiles (coins desc);

-- ============================================
-- Auto-create a profile row the moment someone signs up.
-- This runs on the server with elevated rights, so it works even before
-- the user's session/RLS is fully active — this is what was breaking signup.
-- ============================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'player_' || substr(new.id::text, 1, 6))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ===== PROFILE / REWARD REPAIR =====
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

-- ===== ECONOMY / BANK / LOTTERY / TRANSFERS =====
-- KoleGame upgrade — safe additive migration for the existing database.
-- Run AFTER schema.sql. It does not delete or rename existing data.

alter table public.profiles add column if not exists xp bigint not null default 0;
alter table public.profiles add column if not exists level integer not null default 1;
alter table public.profiles add column if not exists streak integer not null default 0;
alter table public.profiles add column if not exists last_streak_claim timestamptz;
alter table public.profiles add column if not exists last_wheel_spin timestamptz;

create table if not exists public.kg_transfers (
  id bigint generated always as identity primary key,
  from_user uuid references public.profiles(id) on delete cascade not null,
  to_user uuid references public.profiles(id) on delete cascade not null,
  amount bigint not null check (amount > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.kg_lottery_entries (
  id bigint generated always as identity primary key,
  slot_start timestamptz not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  tickets bigint not null check (tickets > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.kg_lottery_draws (
  slot_start timestamptz primary key,
  winner_id uuid references public.profiles(id) on delete set null,
  winning_tickets bigint not null default 0,
  total_tickets bigint not null default 0,
  prize bigint not null default 0,
  drawn_at timestamptz not null default now()
);

alter table public.kg_transfers enable row level security;
alter table public.kg_lottery_entries enable row level security;
alter table public.kg_lottery_draws enable row level security;

drop policy if exists "users can view own transfers" on public.kg_transfers;
create policy "users can view own transfers" on public.kg_transfers for select using (auth.uid() = from_user or auth.uid() = to_user);

drop policy if exists "users can view lottery entries" on public.kg_lottery_entries;
create policy "users can view lottery entries" on public.kg_lottery_entries for select using (auth.uid() = user_id);

drop policy if exists "lottery draws public read" on public.kg_lottery_draws;
create policy "lottery draws public read" on public.kg_lottery_draws for select using (true);

create or replace function public.award_xp(p_amount bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_xp bigint; v_level integer; v_new_level integer; begin
  if auth.uid() is null or p_amount <= 0 then raise exception 'invalid request'; end if;
  select xp, level into v_xp, v_level from profiles where id=auth.uid() for update;
  if not found then raise exception 'profile not found'; end if;
  v_xp := v_xp + least(p_amount, 1000);
  v_new_level := greatest(1, floor(v_xp / 250)::int + 1);
  update profiles set xp=v_xp, level=v_new_level where id=auth.uid();
  return jsonb_build_object('xp',v_xp,'level',v_new_level,'leveled_up',v_new_level>v_level);
end $$;

grant execute on function public.award_xp(bigint) to authenticated;

create or replace function public.transfer_kolecoins(p_to_username text, p_amount bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_to uuid; v_from_balance bigint; v_to_balance bigint; begin
  if auth.uid() is null or p_amount <= 0 or p_amount > 1000000000 then raise exception 'invalid amount'; end if;
  select id into v_to from profiles where lower(username)=lower(trim(p_to_username)) limit 1;
  if v_to is null then raise exception 'user not found'; end if;
  if v_to = auth.uid() then raise exception 'cannot transfer to yourself'; end if;
  select coins into v_from_balance from profiles where id=auth.uid() for update;
  select coins into v_to_balance from profiles where id=v_to for update;
  if v_from_balance < p_amount then raise exception 'not enough coins'; end if;
  update profiles set coins=coins-p_amount where id=auth.uid();
  update profiles set coins=coins+p_amount where id=v_to;
  insert into kg_transfers(from_user,to_user,amount) values(auth.uid(),v_to,p_amount);
  return jsonb_build_object('ok',true,'amount',p_amount,'receiver',v_to);
end $$;
grant execute on function public.transfer_kolecoins(text,bigint) to authenticated;

create or replace function public.spin_wheel()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_last timestamptz; v_roll numeric; v_reward bigint; v_label text; v_now timestamptz:=now(); begin
  select last_wheel_spin into v_last from profiles where id=auth.uid() for update;
  if v_last is not null and v_last > v_now - interval '6 hours' then raise exception 'wheel_cooldown'; end if;
  v_roll:=random();
  if v_roll < .45 then v_reward:=25; v_label:='25 KoleCoin';
  elsif v_roll < .72 then v_reward:=60; v_label:='60 KoleCoin';
  elsif v_roll < .88 then v_reward:=120; v_label:='120 KoleCoin';
  elsif v_roll < .97 then v_reward:=300; v_label:='300 KoleCoin';
  else v_reward:=1000; v_label:='JACKPOT 1000'; end if;
  update profiles set coins=coins+v_reward,last_wheel_spin=v_now where id=auth.uid();
  return jsonb_build_object('reward',v_reward,'label',v_label,'next_at',v_now+interval '6 hours');
end $$;
grant execute on function public.spin_wheel() to authenticated;

create or replace function public.buy_lottery_tickets(p_tickets bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_cost bigint; v_slot timestamptz; begin
  if auth.uid() is null or p_tickets < 1 or p_tickets > 100 then raise exception 'invalid tickets'; end if;
  v_cost:=p_tickets*50;
  v_slot:=to_timestamp(floor(extract(epoch from now())/21600)*21600);
  perform 1 from profiles where id=auth.uid() and coins>=v_cost for update;
  if not found then raise exception 'not enough coins'; end if;
  update profiles set coins=coins-v_cost where id=auth.uid();
  insert into kg_lottery_entries(slot_start,user_id,tickets) values(v_slot,auth.uid(),p_tickets);
  return jsonb_build_object('slot_start',v_slot,'tickets',p_tickets,'cost',v_cost);
end $$;
grant execute on function public.buy_lottery_tickets(bigint) to authenticated;

create or replace function public.get_lottery_state()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_slot timestamptz; v_total bigint; v_mine bigint; v_draw kg_lottery_draws; begin
  v_slot:=to_timestamp(floor(extract(epoch from now())/21600)*21600);
  select coalesce(sum(tickets),0) into v_total from kg_lottery_entries where slot_start=v_slot;
  select coalesce(sum(tickets),0) into v_mine from kg_lottery_entries where slot_start=v_slot and user_id=auth.uid();
  select * into v_draw from kg_lottery_draws where slot_start=v_slot;
  return jsonb_build_object('slot_start',v_slot,'next_draw',v_slot+interval '6 hours','total_tickets',v_total,'my_tickets',v_mine,'draw',case when v_draw.slot_start is null then null else jsonb_build_object('winner_id',v_draw.winner_id,'prize',v_draw.prize) end);
end $$;
grant execute on function public.get_lottery_state() to authenticated;

create or replace function public.draw_lottery_if_needed()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_prev timestamptz; v_total bigint; v_pick bigint; v_cursor bigint:=0; r record; v_winner uuid; v_prize bigint; v_drawn boolean:=false; begin
  v_prev:=to_timestamp(floor(extract(epoch from now())/21600)*21600) - interval '6 hours';
  if exists(select 1 from kg_lottery_draws where slot_start=v_prev) then
    return jsonb_build_object('drawn',false,'already',true,'slot_start',v_prev);
  end if;
  select coalesce(sum(tickets),0) into v_total from kg_lottery_entries where slot_start=v_prev;
  if v_total=0 then
    insert into kg_lottery_draws(slot_start,total_tickets,prize) values(v_prev,0,0) on conflict do nothing;
    return jsonb_build_object('drawn',false,'empty',true,'slot_start',v_prev);
  end if;
  v_pick:=1+floor(random()*v_total)::bigint;
  for r in select user_id,tickets from kg_lottery_entries where slot_start=v_prev order by id loop
    v_cursor:=v_cursor+r.tickets;
    if v_pick<=v_cursor then v_winner:=r.user_id; exit; end if;
  end loop;
  v_prize:=v_total*45;
  update profiles set coins=coins+v_prize where id=v_winner;
  insert into kg_lottery_draws(slot_start,winner_id,winning_tickets,total_tickets,prize) select v_prev,v_winner,coalesce((select sum(tickets) from kg_lottery_entries where slot_start=v_prev and user_id=v_winner),0),v_total,v_prize on conflict do nothing;
  return jsonb_build_object('drawn',true,'winner_id',v_winner,'prize',v_prize,'total_tickets',v_total,'slot_start',v_prev);
end $$;
grant execute on function public.draw_lottery_if_needed() to authenticated;

create or replace function public.casino_bet(p_game text, p_bet bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_win boolean; v_mult numeric; v_net bigint; v_result text; begin
  if auth.uid() is null or p_bet < 1 or p_bet > 100000 then raise exception 'invalid bet'; end if;
  if not exists(select 1 from profiles where id=auth.uid() and coins>=p_bet) then raise exception 'not enough coins'; end if;
  if p_game='coinflip' then v_win:=random()<.5; v_mult:=case when v_win then 2 else 0 end;
  elsif p_game='dice' then v_win:=random()<.1667; v_mult:=case when v_win then 5 else 0 end;
  elsif p_game='slots' then
    if random()<.04 then v_mult:=10; elsif random()<.16 then v_mult:=4; elsif random()<.36 then v_mult:=2; else v_mult:=0; end if; v_win:=v_mult>0;
  else raise exception 'unknown casino game'; end if;
  v_net:=round(p_bet*v_mult)-p_bet;
  update profiles set coins=coins+v_net where id=auth.uid();
  v_result:=case when v_win then 'win' else 'lose' end;
  return jsonb_build_object('result',v_result,'multiplier',v_mult,'net',v_net);
end $$;
grant execute on function public.casino_bet(text,bigint) to authenticated;

create or replace function public.bank_move(p_direction text, p_amount bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_cash bigint; v_bank bigint; begin
  if auth.uid() is null or p_amount<1 then raise exception 'invalid amount'; end if;
  select coins,bank_balance into v_cash,v_bank from profiles where id=auth.uid() for update;
  if p_direction='deposit' then
    if v_cash<p_amount then raise exception 'not enough cash'; end if;
    v_cash:=v_cash-p_amount; v_bank:=v_bank+p_amount;
  elsif p_direction='withdraw' then
    if v_bank<p_amount then raise exception 'not enough bank balance'; end if;
    v_cash:=v_cash+p_amount; v_bank:=v_bank-p_amount;
  else raise exception 'invalid direction'; end if;
  update profiles set coins=v_cash,bank_balance=v_bank where id=auth.uid();
  return jsonb_build_object('coins',v_cash,'bank_balance',v_bank);
end $$;
grant execute on function public.bank_move(text,bigint) to authenticated;

create or replace function public.claim_bank_interest()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_last timestamptz; v_interest bigint; v_bank bigint; v_now timestamptz:=now(); begin
  select last_bank_interest,bank_balance into v_last,v_bank from profiles where id=auth.uid() for update;
  if v_last is not null and v_last > v_now-interval '24 hours' then raise exception 'interest_cooldown'; end if;
  if v_bank<=0 then raise exception 'empty_bank'; end if;
  v_interest:=floor(v_bank*.05);
  update profiles set bank_balance=bank_balance+v_interest,last_bank_interest=v_now where id=auth.uid();
  return jsonb_build_object('interest',v_interest,'bank_balance',v_bank+v_interest);
end $$;
grant execute on function public.claim_bank_interest() to authenticated;

create or replace function public.change_kolecoins(p_amount bigint)
returns bigint language plpgsql security definer set search_path=public as $$
declare v_new bigint; begin
  if auth.uid() is null or p_amount=0 or abs(p_amount)>1000000 then raise exception 'invalid amount'; end if;
  update profiles set coins=coins+p_amount where id=auth.uid() and coins+p_amount>=0 returning coins into v_new;
  if v_new is null then raise exception 'not enough coins'; end if;
  return v_new;
end $$;
grant execute on function public.change_kolecoins(bigint) to authenticated;

create or replace function public.claim_daily_bonus()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_last timestamptz; v_streak int; v_reward bigint; v_now timestamptz:=now(); begin
  select last_daily_claim,streak into v_last,v_streak from profiles where id=auth.uid() for update;
  if v_last is not null and v_last > v_now-interval '24 hours' then raise exception 'daily_cooldown'; end if;
  if v_last is null or v_last < v_now-interval '48 hours' then v_streak:=1; else v_streak:=v_streak+1; end if;
  v_reward:=50+least(v_streak,10)*10;
  update profiles set coins=coins+v_reward,last_daily_claim=v_now,streak=v_streak,xp=xp+50,level=floor((xp+50)/250)::int+1 where id=auth.uid();
  return jsonb_build_object('reward',v_reward,'streak',v_streak);
end $$;
grant execute on function public.claim_daily_bonus() to authenticated;

-- ===== SHOP / PETS / UPGRADES =====
-- ============================================================
-- KoleGame v2: Shop, upgrades, pets, and secure passive income
-- Run AFTER schema.sql + existing upgrade/reward migrations.
-- Safe to run more than once.
-- ============================================================

create table if not exists public.kg_player_upgrades (
  user_id uuid references public.profiles(id) on delete cascade not null,
  upgrade_key text not null,
  level integer not null default 0 check (level >= 0 and level <= 30),
  updated_at timestamptz not null default now(),
  primary key (user_id, upgrade_key)
);

create table if not exists public.kg_player_pets (
  user_id uuid references public.profiles(id) on delete cascade not null,
  pet_key text not null,
  level integer not null default 1 check (level >= 1 and level <= 10),
  acquired_at timestamptz not null default now(),
  last_claim_at timestamptz not null default now(),
  primary key (user_id, pet_key)
);

alter table public.kg_player_upgrades enable row level security;
alter table public.kg_player_pets enable row level security;

drop policy if exists "players can view own upgrades" on public.kg_player_upgrades;
create policy "players can view own upgrades" on public.kg_player_upgrades
  for select using (auth.uid() = user_id);

drop policy if exists "players can view own pets" on public.kg_player_pets;
create policy "players can view own pets" on public.kg_player_pets
  for select using (auth.uid() = user_id);

create index if not exists kg_player_pets_claim_idx
  on public.kg_player_pets (user_id, last_claim_at);

-- Catalog lives in the server function so prices/effects cannot be altered by the client.
create or replace function public.kg_upgrade_catalog()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_array(
    jsonb_build_object('key','reward','name','موتور درآمد','icon','🪙','description','پاداش بازی‌ها را در هر لول ۵٪ بیشتر می‌کند.','base_cost',500,'max_level',30),
    jsonb_build_object('key','xp','name','هسته XP','icon','⚡','description','XP بازی‌ها را در هر لول ۸٪ بیشتر می‌کند.','base_cost',700,'max_level',20),
    jsonb_build_object('key','luck','name','طلسم شانس','icon','🍀','description','شانس جایزه‌های تصادفی را کمی بهتر می‌کند.','base_cost',1200,'max_level',15),
    jsonb_build_object('key','bank','name','محافظ بانک','icon','🏦','description','سود بانک را در هر لول ۱٪ بیشتر می‌کند.','base_cost',1800,'max_level',15),
    jsonb_build_object('key','petcare','name','Pet Care','icon','🐾','description','درآمد همه پت‌ها را در هر لول ۱۰٪ بیشتر می‌کند.','base_cost',2200,'max_level',15),
    jsonb_build_object('key','combo','name','دستکش کمبو','icon','🥊','description','پاداش بازی‌های سریع را ۳٪ در هر لول تقویت می‌کند.','base_cost',1500,'max_level',20)
  );
$$;

create or replace function public.kg_pet_catalog()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_array(
    jsonb_build_object('key','chick','name','جوجه طلایی','icon','pet','rarity','معمولی','base_cost',1000,'income',3,'unlock_level',1),
    jsonb_build_object('key','bunny','name','خرگوش زمردی','icon','pet','rarity','معمولی','base_cost',1800,'income',5,'unlock_level',1),
    jsonb_build_object('key','slime','name','اسلایم زمردی','icon','pet','rarity','معمولی','base_cost',2600,'income',7,'unlock_level',2),
    jsonb_build_object('key','hamster','name','همستر گنج‌یاب','icon','pet','rarity','معمولی','base_cost',3500,'income',9,'unlock_level',2),
    jsonb_build_object('key','cat','name','گربه پول‌ساز','icon','pet','rarity','غیرمعمول','base_cost',4500,'income',8,'unlock_level',3),
    jsonb_build_object('key','panda','name','پاندای ثروتمند','icon','pet','rarity','غیرمعمول','base_cost',7000,'income',13,'unlock_level',4),
    jsonb_build_object('key','raccoon','name','راکون دزد سکه','icon','pet','rarity','غیرمعمول','base_cost',10000,'income',17,'unlock_level',5),
    jsonb_build_object('key','owl','name','جغد دانا','icon','pet','rarity','غیرمعمول','base_cost',18000,'income',28,'unlock_level',6),
    jsonb_build_object('key','fox','name','روباه نقره‌ای','icon','pet','rarity','کمیاب','base_cost',12000,'income',18,'unlock_level',5),
    jsonb_build_object('key','penguin','name','پنگوئن سرمایه‌دار','icon','pet','rarity','کمیاب','base_cost',30000,'income',42,'unlock_level',8),
    jsonb_build_object('key','bee','name','زنبور طلایی','icon','pet','rarity','کمیاب','base_cost',40000,'income',55,'unlock_level',9),
    jsonb_build_object('key','shark','name','کوسه طلایی','icon','pet','rarity','کمیاب','base_cost',50000,'income',65,'unlock_level',10),
    jsonb_build_object('key','parrot','name','طوطی جواهرنشان','icon','pet','rarity','کمیاب','base_cost',75000,'income',90,'unlock_level',12),
    jsonb_build_object('key','tiger','name','ببر سلطنتی','icon','pet','rarity','کمیاب','base_cost',140000,'income',170,'unlock_level',15),
    jsonb_build_object('key','dragon','name','اژدهای زمردی','icon','pet','rarity','حماسی','base_cost',85000,'income',110,'unlock_level',12),
    jsonb_build_object('key','manta','name','پرتوی آبی','icon','pet','rarity','حماسی','base_cost',180000,'income',230,'unlock_level',17),
    jsonb_build_object('key','unicorn','name','تک‌شاخ کیهانی','icon','pet','rarity','حماسی','base_cost',220000,'income',280,'unlock_level',18),
    jsonb_build_object('key','griffin','name','گریفین باستانی','icon','pet','rarity','حماسی','base_cost',380000,'income',470,'unlock_level',22),
    jsonb_build_object('key','wolf','name','گرگ سایه‌ای','icon','pet','rarity','حماسی','base_cost',900000,'income',1050,'unlock_level',30),
    jsonb_build_object('key','phoenix','name','ققنوس سلطنتی','icon','pet','rarity','افسانه‌ای','base_cost',600000,'income',720,'unlock_level',25),
    jsonb_build_object('key','dragonfire','name','اژدهای آتشین','icon','pet','rarity','افسانه‌ای','base_cost',1200000,'income',1450,'unlock_level',33),
    jsonb_build_object('key','robot','name','ربات خزانه‌دار','icon','pet','rarity','افسانه‌ای','base_cost',1500000,'income',1800,'unlock_level',35),
    jsonb_build_object('key','mecha-dragon','name','اژدهای مکا','icon','pet','rarity','افسانه‌ای','base_cost',2800000,'income',3300,'unlock_level',42),
    jsonb_build_object('key','kraken','name','کراکن طلایی','icon','pet','rarity','اسطوره‌ای','base_cost',4000000,'income',4800,'unlock_level',50),
    jsonb_build_object('key','celestial','name','شیر آسمانی','icon','pet','rarity','اسطوره‌ای','base_cost',8500000,'income',9200,'unlock_level',58),
    jsonb_build_object('key','cosmic','name','پت کیهانی','icon','pet','rarity','اسطوره‌ای','base_cost',12000000,'income',15000,'unlock_level',70),
    jsonb_build_object('key','starwhale','name','نهنگ ستاره‌ای','icon','pet','rarity','اسطوره‌ای','base_cost',20000000,'income',23000,'unlock_level',78),
    jsonb_build_object('key','void','name','نگهبان خلأ','icon','pet','rarity','اسطوره‌ای','base_cost',30000000,'income',30000,'unlock_level',85)
  );
$$;

grant execute on function public.kg_pet_catalog() to authenticated;

create or replace function public.buy_kg_upgrade(p_key text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  u jsonb;
  v_level int;
  v_cost bigint;
  v_max int;
  v_account_level int;
  v_required_level int;
  v_balance bigint;
  v_new_balance bigint;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select x into u from jsonb_array_elements(public.kg_upgrade_catalog()) x
    where x->>'key' = lower(trim(p_key));
  if u is null then raise exception 'unknown upgrade'; end if;

  select level into v_account_level from profiles where id=auth.uid();
  v_account_level := greatest(1, coalesce(v_account_level,1));

  select coalesce(level,0) into v_level
    from kg_player_upgrades where user_id=auth.uid() and upgrade_key=lower(trim(p_key));
  v_level := coalesce(v_level,0);
  v_max := (u->>'max_level')::int;

  if v_level >= v_max then raise exception 'upgrade_maxed'; end if;

  -- Every 3 upgrade levels require another account level.
  v_required_level := greatest(1, floor(v_level / 3)::int + 1);
  if v_account_level < v_required_level then
    raise exception 'requires_level:%', v_required_level;
  end if;

  v_cost := greatest(1, round((u->>'base_cost')::numeric * power(1.72, v_level)));
  select coins into v_balance from profiles where id=auth.uid() for update;
  if coalesce(v_balance,0) < v_cost then raise exception 'not enough coins'; end if;

  v_new_balance := v_balance - v_cost;
  update profiles set coins=v_new_balance where id=auth.uid();

  insert into kg_player_upgrades(user_id,upgrade_key,level,updated_at)
  values(auth.uid(),lower(trim(p_key)),v_level+1,now())
  on conflict(user_id,upgrade_key)
  do update set level=excluded.level,updated_at=now();

  return jsonb_build_object('ok',true,'key',lower(trim(p_key)),'level',v_level+1,'cost',v_cost,'coins',v_new_balance);
end;
$$;

grant execute on function public.buy_kg_upgrade(text) to authenticated;

create or replace function public.get_kg_shop_state()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_upgrades jsonb;
  v_pets jsonb;
  v_level int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select level into v_level from profiles where id=auth.uid();

  select coalesce(jsonb_agg(jsonb_build_object('key',upgrade_key,'level',level)),'[]'::jsonb)
    into v_upgrades from kg_player_upgrades where user_id=auth.uid();

  select coalesce(jsonb_agg(jsonb_build_object(
      'key',p.pet_key,'level',p.level,'acquired_at',p.acquired_at,'last_claim_at',p.last_claim_at
    )),'[]'::jsonb)
    into v_pets from kg_player_pets p where p.user_id=auth.uid();

  return jsonb_build_object('upgrades',v_upgrades,'pets',v_pets,'level',greatest(1,coalesce(v_level,1)));
end;
$$;
grant execute on function public.get_kg_shop_state() to authenticated;

create or replace function public.buy_or_upgrade_kg_pet(p_key text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  p jsonb;
  v_level int;
  v_account_level int;
  v_cost bigint;
  v_balance bigint;
  v_petcare int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select x into p from jsonb_array_elements(public.kg_pet_catalog()) x
    where x->>'key'=lower(trim(p_key));
  if p is null then raise exception 'unknown pet'; end if;

  select level into v_account_level from profiles where id=auth.uid();
  v_account_level:=greatest(1,coalesce(v_account_level,1));
  if v_account_level < (p->>'unlock_level')::int then
    raise exception 'requires_level:%', (p->>'unlock_level')::int;
  end if;

  select level into v_level from kg_player_pets
    where user_id=auth.uid() and pet_key=lower(trim(p_key));
  if v_level is null then
    v_level:=0;
    v_cost:=(p->>'base_cost')::bigint;
  else
    if v_level>=10 then raise exception 'pet_maxed'; end if;
    v_cost:=greatest(1,round((p->>'base_cost')::numeric*power(2.25,v_level)));
  end if;

  select coins into v_balance from profiles where id=auth.uid() for update;
  if coalesce(v_balance,0)<v_cost then raise exception 'not enough coins'; end if;

  update profiles set coins=coins-v_cost where id=auth.uid();

  if v_level=0 then
    insert into kg_player_pets(user_id,pet_key,level,last_claim_at)
      values(auth.uid(),lower(trim(p_key)),1,now());
    v_level:=1;
  else
    update kg_player_pets set level=v_level+1 where user_id=auth.uid() and pet_key=lower(trim(p_key));
    v_level:=v_level+1;
  end if;

  return jsonb_build_object('ok',true,'key',lower(trim(p_key)),'level',v_level,'cost',v_cost);
end;
$$;
grant execute on function public.buy_or_upgrade_kg_pet(text) to authenticated;

create or replace function public.claim_kg_pet_income()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  r record;
  v_now timestamptz:=now();
  v_seconds bigint;
  v_ticks bigint;
  v_base_income bigint;
  v_total bigint:=0;
  v_petcare int;
  v_multiplier numeric;
  v_payout bigint;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select coalesce(level,0) into v_petcare
    from kg_player_upgrades where user_id=auth.uid() and upgrade_key='petcare';
  v_multiplier:=1+(coalesce(v_petcare,0)*0.10);

  for r in
    select p.pet_key,p.level,p.last_claim_at,c->>'income' as income
    from kg_player_pets p
    cross join lateral jsonb_array_elements(public.kg_pet_catalog()) c
    where p.user_id=auth.uid() and c->>'key'=p.pet_key
    for update
  loop
    v_seconds:=greatest(0,extract(epoch from (v_now-r.last_claim_at))::bigint);
    v_ticks:=floor(v_seconds/60.0)::bigint;
    if v_ticks>0 then
      v_base_income:=(r.income)::bigint;
      v_payout:=floor(v_ticks*v_base_income*r.level*v_multiplier);
      v_total:=v_total+v_payout;
      update kg_player_pets set last_claim_at=r.last_claim_at+(v_ticks*interval '60 seconds')
        where user_id=auth.uid() and pet_key=r.pet_key;
    end if;
  end loop;

  if v_total>0 then
    update profiles set coins=coins+v_total where id=auth.uid();
  end if;

  return jsonb_build_object('ok',true,'payout',v_total,'coins',(select coins from profiles where id=auth.uid()));
end;
$$;
grant execute on function public.claim_kg_pet_income() to authenticated;

-- Make normal game rewards respect the shop.
create or replace function public.award_game_reward(p_amount bigint, p_game text default 'game')
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_old bigint; v_new bigint; v_xp bigint; v_level integer; v_new_level integer;
  v_reward_lvl int; v_xp_lvl int; v_combo_lvl int;
  v_reward numeric; v_xp_gain bigint;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_amount is null or p_amount<=0 or p_amount>1000000 then raise exception 'invalid reward'; end if;

  select coins,xp,level into v_old,v_xp,v_level from profiles where id=v_user for update;
  if not found then raise exception 'profile not found'; end if;

  select coalesce(max(level) filter(where upgrade_key='reward'),0),
         coalesce(max(level) filter(where upgrade_key='xp'),0),
         coalesce(max(level) filter(where upgrade_key='combo'),0)
    into v_reward_lvl,v_xp_lvl,v_combo_lvl
    from kg_player_upgrades where user_id=v_user;

  v_reward:=1+(v_reward_lvl*.05)+(case when lower(coalesce(p_game,'')) in ('reaction','starcatch','whackamole','aim','clicker','goldhit') then v_combo_lvl*.03 else 0 end);
  v_new:=v_old+floor(p_amount*v_reward);
  v_xp_gain:=least(120,ceil(least(p_amount,120)*(1+(v_xp_lvl*.08))));
  v_xp:=coalesce(v_xp,0)+v_xp_gain;
  v_level:=greatest(1,coalesce(v_level,1));
  v_new_level:=greatest(1,floor(v_xp/250)::int+1);

  update profiles set coins=v_new,xp=v_xp,level=v_new_level where id=v_user;
  return jsonb_build_object('ok',true,'game',left(coalesce(p_game,'game'),40),
    'coins',v_new,'reward',floor(p_amount*v_reward),'xp',v_xp,'level',v_new_level,
    'leveled_up',v_new_level>v_level);
end;
$$;
grant execute on function public.award_game_reward(bigint,text) to authenticated;

-- Bank upgrade effect: replace the existing interest function.
create or replace function public.claim_bank_interest()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_last timestamptz; v_interest bigint; v_bank bigint; v_now timestamptz:=now(); v_bonus int;
begin
  select last_bank_interest,bank_balance into v_last,v_bank from profiles where id=auth.uid() for update;
  if v_last is not null and v_last > v_now-interval '24 hours' then raise exception 'interest_cooldown'; end if;
  if v_bank<=0 then raise exception 'empty_bank'; end if;
  select coalesce(level,0) into v_bonus from kg_player_upgrades where user_id=auth.uid() and upgrade_key='bank';
  v_interest:=floor(v_bank*(0.05+coalesce(v_bonus,0)*0.01));
  update profiles set bank_balance=bank_balance+v_interest,last_bank_interest=v_now where id=auth.uid();
  return jsonb_build_object('interest',v_interest,'bank_balance',v_bank+v_interest);
end;
$$;
grant execute on function public.claim_bank_interest() to authenticated;

revoke all on function public.kg_upgrade_catalog() from public;
revoke all on function public.kg_pet_catalog() from public;
revoke all on function public.get_kg_shop_state() from public;
revoke all on function public.buy_kg_upgrade(text) from public;
revoke all on function public.buy_or_upgrade_kg_pet(text) from public;
revoke all on function public.claim_kg_pet_income() from public;
revoke all on function public.award_game_reward(bigint,text) from public;
revoke all on function public.claim_bank_interest() from public;
grant execute on function public.kg_upgrade_catalog() to authenticated;
grant execute on function public.kg_pet_catalog() to authenticated;

-- ===== FINAL PET CATALOG =====
-- KoleGame FINAL PET CATALOG v2
-- Safe for existing players. No profile/coin/pet rows are deleted or reset.
-- Run after shop_pets.sql. This only replaces the server-side catalog.

create or replace function public.kg_pet_catalog()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_array(
    jsonb_build_object('key','chick','name','جوجه طلایی','icon','pet','rarity','معمولی','base_cost',1000,'income',3,'unlock_level',1),
    jsonb_build_object('key','bunny','name','خرگوش زمردی','icon','pet','rarity','معمولی','base_cost',1800,'income',5,'unlock_level',1),
    jsonb_build_object('key','slime','name','اسلایم زمردی','icon','pet','rarity','معمولی','base_cost',2600,'income',7,'unlock_level',2),
    jsonb_build_object('key','hamster','name','همستر گنج‌یاب','icon','pet','rarity','معمولی','base_cost',3500,'income',9,'unlock_level',2),
    jsonb_build_object('key','cat','name','گربه پول‌ساز','icon','pet','rarity','غیرمعمول','base_cost',4500,'income',8,'unlock_level',3),
    jsonb_build_object('key','panda','name','پاندای ثروتمند','icon','pet','rarity','غیرمعمول','base_cost',7000,'income',13,'unlock_level',4),
    jsonb_build_object('key','raccoon','name','راکون دزد سکه','icon','pet','rarity','غیرمعمول','base_cost',10000,'income',17,'unlock_level',5),
    jsonb_build_object('key','owl','name','جغد دانا','icon','pet','rarity','غیرمعمول','base_cost',18000,'income',28,'unlock_level',6),
    jsonb_build_object('key','fox','name','روباه نقره‌ای','icon','pet','rarity','کمیاب','base_cost',12000,'income',18,'unlock_level',5),
    jsonb_build_object('key','penguin','name','پنگوئن سرمایه‌دار','icon','pet','rarity','کمیاب','base_cost',30000,'income',42,'unlock_level',8),
    jsonb_build_object('key','bee','name','زنبور طلایی','icon','pet','rarity','کمیاب','base_cost',40000,'income',55,'unlock_level',9),
    jsonb_build_object('key','shark','name','کوسه طلایی','icon','pet','rarity','کمیاب','base_cost',50000,'income',65,'unlock_level',10),
    jsonb_build_object('key','parrot','name','طوطی جواهرنشان','icon','pet','rarity','کمیاب','base_cost',75000,'income',90,'unlock_level',12),
    jsonb_build_object('key','tiger','name','ببر سلطنتی','icon','pet','rarity','کمیاب','base_cost',140000,'income',170,'unlock_level',15),
    jsonb_build_object('key','dragon','name','اژدهای زمردی','icon','pet','rarity','حماسی','base_cost',85000,'income',110,'unlock_level',12),
    jsonb_build_object('key','manta','name','پرتوی آبی','icon','pet','rarity','حماسی','base_cost',180000,'income',230,'unlock_level',17),
    jsonb_build_object('key','unicorn','name','تک‌شاخ کیهانی','icon','pet','rarity','حماسی','base_cost',220000,'income',280,'unlock_level',18),
    jsonb_build_object('key','griffin','name','گریفین باستانی','icon','pet','rarity','حماسی','base_cost',380000,'income',470,'unlock_level',22),
    jsonb_build_object('key','wolf','name','گرگ سایه‌ای','icon','pet','rarity','حماسی','base_cost',900000,'income',1050,'unlock_level',30),
    jsonb_build_object('key','phoenix','name','ققنوس سلطنتی','icon','pet','rarity','افسانه‌ای','base_cost',600000,'income',720,'unlock_level',25),
    jsonb_build_object('key','dragonfire','name','اژدهای آتشین','icon','pet','rarity','افسانه‌ای','base_cost',1200000,'income',1450,'unlock_level',33),
    jsonb_build_object('key','robot','name','ربات خزانه‌دار','icon','pet','rarity','افسانه‌ای','base_cost',1500000,'income',1800,'unlock_level',35),
    jsonb_build_object('key','mecha-dragon','name','اژدهای مکا','icon','pet','rarity','افسانه‌ای','base_cost',2800000,'income',3300,'unlock_level',42),
    jsonb_build_object('key','kraken','name','کراکن طلایی','icon','pet','rarity','اسطوره‌ای','base_cost',4000000,'income',4800,'unlock_level',50),
    jsonb_build_object('key','celestial','name','شیر آسمانی','icon','pet','rarity','اسطوره‌ای','base_cost',8500000,'income',9200,'unlock_level',58),
    jsonb_build_object('key','cosmic','name','پت کیهانی','icon','pet','rarity','اسطوره‌ای','base_cost',12000000,'income',15000,'unlock_level',70),
    jsonb_build_object('key','starwhale','name','نهنگ ستاره‌ای','icon','pet','rarity','اسطوره‌ای','base_cost',20000000,'income',23000,'unlock_level',78),
    jsonb_build_object('key','void','name','نگهبان خلأ','icon','pet','rarity','اسطوره‌ای','base_cost',30000000,'income',30000,'unlock_level',85)
  );
$$;

grant execute on function public.kg_pet_catalog() to authenticated;

-- ===== ONE-TIME PET PURCHASE =====
-- KoleGame: one-time pet purchases
-- SAFE for existing players: no tables/profiles/coins/pets are deleted or reset.
-- Existing pets remain owned. New purchases start at level 1 and cannot be purchased twice.

create or replace function public.buy_kg_pet_once(p_key text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  p jsonb;
  v_key text := lower(trim(p_key));
  v_account_level int;
  v_cost bigint;
  v_balance bigint;
  v_owned boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select x into p from jsonb_array_elements(public.kg_pet_catalog()) x
    where x->>'key'=v_key;
  if p is null then raise exception 'unknown pet'; end if;

  select greatest(1,coalesce(level,1)) into v_account_level
    from profiles where id=auth.uid();
  if v_account_level < (p->>'unlock_level')::int then
    raise exception 'requires_level:%', (p->>'unlock_level')::int;
  end if;

  select exists(select 1 from kg_player_pets where user_id=auth.uid() and pet_key=v_key)
    into v_owned;
  if v_owned then raise exception 'already_owned'; end if;

  v_cost := greatest(1,(p->>'base_cost')::bigint);

  select coins into v_balance from profiles where id=auth.uid() for update;
  if coalesce(v_balance,0) < v_cost then raise exception 'not enough coins'; end if;

  update profiles set coins=coins-v_cost where id=auth.uid();

  insert into kg_player_pets(user_id,pet_key,level,last_claim_at)
    values(auth.uid(),v_key,1,now());

  return jsonb_build_object('ok',true,'key',v_key,'level',1,'cost',v_cost);
end;
$$;

revoke all on function public.buy_kg_pet_once(text) from public;
grant execute on function public.buy_kg_pet_once(text) to authenticated;

-- ===== FRIEND REQUESTS / SOCIAL =====
-- KOLEGAME ULTIMATE SOCIAL/MULTIPLAYER ADD-ON
-- SAFE ADDITIVE MIGRATION: does not drop, truncate, reset, or rewrite existing player balances.
-- Run this AFTER your existing migrations.

create table if not exists public.kg_friend_requests (
  id bigint generated always as identity primary key,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  receiver_id uuid references public.profiles(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique(sender_id, receiver_id)
);
alter table public.kg_friend_requests enable row level security;
drop policy if exists "kg requests visible to participants" on public.kg_friend_requests;
create policy "kg requests visible to participants" on public.kg_friend_requests for select using (auth.uid()=sender_id or auth.uid()=receiver_id);
drop policy if exists "kg users send requests" on public.kg_friend_requests;
create policy "kg users send requests" on public.kg_friend_requests for insert with check (auth.uid()=sender_id and sender_id<>receiver_id);
drop policy if exists "kg receivers update requests" on public.kg_friend_requests;
create policy "kg receivers update requests" on public.kg_friend_requests for update using (auth.uid()=receiver_id) with check (auth.uid()=receiver_id);
drop policy if exists "kg participants delete requests" on public.kg_friend_requests;
create policy "kg participants delete requests" on public.kg_friend_requests for delete using (auth.uid()=sender_id or auth.uid()=receiver_id);

create index if not exists kg_friend_requests_receiver_idx on public.kg_friend_requests(receiver_id,status);
create index if not exists kg_friend_requests_sender_idx on public.kg_friend_requests(sender_id,status);

create or replace function public.kg_accept_friend_request(p_request_id bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r kg_friend_requests;
begin
  select * into r from kg_friend_requests where id=p_request_id and receiver_id=auth.uid() and status='pending' for update;
  if r.id is null then raise exception 'request_not_found'; end if;
  insert into friends(user_id,friend_id) values(r.sender_id,r.receiver_id) on conflict do nothing;
  insert into friends(user_id,friend_id) values(r.receiver_id,r.sender_id) on conflict do nothing;
  update kg_friend_requests set status='accepted',responded_at=now() where id=r.id;
  return jsonb_build_object('ok',true);
end; $$;

create or replace function public.kg_reject_friend_request(p_request_id bigint)
returns jsonb language sql security definer set search_path=public as $$
 update kg_friend_requests set status='rejected',responded_at=now()
 where id=p_request_id and receiver_id=auth.uid() and status='pending'
 returning jsonb_build_object('ok',true);
$$;

-- Enable realtime for friend requests when the project's Realtime publication supports it.
do $$ begin
  begin alter publication supabase_realtime add table public.kg_friend_requests; exception when duplicate_object then null; when undefined_object then null; end;
end $$;

-- ===== ARENA ROOMS =====
-- KoleGame Arena Rooms v1
-- SAFE / ADDITIVE: does not alter, delete, truncate, or reset profiles/coins.
-- Run this ONCE in Supabase SQL Editor before uploading the new frontend.

create table if not exists public.kg_game_rooms (
  id bigint generated by default as identity primary key,
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  game text not null,
  host_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid references auth.users(id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting','playing','finished','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kg_game_rooms_code_idx on public.kg_game_rooms(code);
create index if not exists kg_game_rooms_host_idx on public.kg_game_rooms(host_id);
create index if not exists kg_game_rooms_guest_idx on public.kg_game_rooms(guest_id);

alter table public.kg_game_rooms enable row level security;

drop policy if exists "kg rooms participants can read" on public.kg_game_rooms;
create policy "kg rooms participants can read"
on public.kg_game_rooms for select
to authenticated
using (auth.uid() = host_id or auth.uid() = guest_id);

create or replace function public.kg_create_room(p_code text, p_game text)
returns public.kg_game_rooms
language plpgsql
security definer
set search_path = public
as $$
declare r public.kg_game_rooms;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_code !~ '^[A-Z0-9]{6}$' then raise exception 'invalid room code'; end if;
  if p_game not in ('rps','tictactoe','reaction','quiz','connect4','highlow','mathduel','color') then raise exception 'invalid game'; end if;

  -- Keep only the caller's old waiting rooms closed; no player/account data is touched.
  update public.kg_game_rooms
     set status='closed', updated_at=now()
   where host_id=auth.uid() and status='waiting';

  insert into public.kg_game_rooms(code,game,host_id,status)
  values (upper(p_code),p_game,auth.uid(),'waiting')
  returning * into r;
  return r;
exception when unique_violation then
  raise exception 'room code already exists';
end;
$$;

create or replace function public.kg_join_room(p_code text)
returns public.kg_game_rooms
language plpgsql
security definer
set search_path = public
as $$
declare r public.kg_game_rooms;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into r
    from public.kg_game_rooms
   where code=upper(p_code) and status='waiting'
   for update;

  if not found then raise exception 'room not found or closed'; end if;
  if r.host_id=auth.uid() then return r; end if;
  if r.guest_id is not null then raise exception 'room is full'; end if;

  update public.kg_game_rooms
     set guest_id=auth.uid(), status='playing', updated_at=now()
   where id=r.id
   returning * into r;
  return r;
end;
$$;

create or replace function public.kg_leave_room(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare r public.kg_game_rooms;
begin
  if auth.uid() is null then return false; end if;
  update public.kg_game_rooms
     set status='closed', updated_at=now()
   where code=upper(p_code)
     and (host_id=auth.uid() or guest_id=auth.uid())
     and status in ('waiting','playing')
  returning * into r;
  return found;
end;
$$;

revoke all on function public.kg_create_room(text,text) from public;
revoke all on function public.kg_join_room(text) from public;
revoke all on function public.kg_leave_room(text) from public;
grant execute on function public.kg_create_room(text,text) to authenticated;
grant execute on function public.kg_join_room(text) to authenticated;
grant execute on function public.kg_leave_room(text) to authenticated;

-- Realtime is optional for the room table itself; the existing Presence/Broadcast channel
-- remains responsible for live gameplay. This migration only makes room creation/join atomic.

-- ===== ADMIN =====
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

-- ================================================================
-- END. Optional pg_cron lottery scheduling is intentionally not
-- included because it is optional and the draw function is user
-- scoped. The app can draw the current 6-hour slot when needed.
-- ================================================================
