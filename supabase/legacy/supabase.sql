create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.semesters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  academic_year text not null check (length(trim(academic_year)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  ects numeric(6,2) not null check (ects > 0),
  grade integer check (grade between 5 and 10),
  status text not null check (status in ('passed', 'failed', 'planned')),
  created_at timestamptz not null default now(),
  constraint passed_subject_grade check (
    (status = 'passed' and grade between 6 and 10)
    or (status = 'failed' and (grade is null or grade = 5))
    or (status = 'planned' and grade is null)
  )
);

alter table public.profiles enable row level security;
alter table public.semesters enable row level security;
alter table public.subjects enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can manage own semesters"
  on public.semesters for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own subjects"
  on public.subjects for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.semesters
      where semesters.id = subjects.semester_id
        and semesters.user_id = auth.uid()
    )
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
