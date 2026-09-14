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
