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
