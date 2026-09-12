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

create policy "profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

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

create policy "users can view their own friend list"
  on public.friends for select
  using (auth.uid() = user_id);

create policy "users can add friends"
  on public.friends for insert
  with check (auth.uid() = user_id);

create policy "users can remove their own friends"
  on public.friends for delete
  using (auth.uid() = user_id);

-- Helpful index for leaderboard sorting
create index if not exists profiles_coins_idx on public.profiles (coins desc);
