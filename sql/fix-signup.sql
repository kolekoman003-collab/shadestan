-- ============================================
-- فقط همین فایل کوچیک رو اجرا کن — نیازی به اجرای دوباره schema.sql نیست.
-- این، باگ «ثبت‌نام کار نمی‌کنه» رو حل می‌کنه.
-- برو Supabase > SQL Editor > New query > این رو پیست کن > Run
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
