alter table public.profiles
  add column if not exists full_name text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, onboarding_completed)
  values (new.id, new.email, null, false)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
