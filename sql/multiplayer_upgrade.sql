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
