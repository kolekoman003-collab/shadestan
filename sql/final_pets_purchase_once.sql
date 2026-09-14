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
