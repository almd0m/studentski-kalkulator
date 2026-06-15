create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.study_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  university_name text,
  faculty_name text,
  program_name text,
  study_type text check (study_type is null or study_type in ('bachelor_3_year', 'master_1_year', 'master_2_year')),
  study_level text check (study_level is null or study_level in ('bachelor', 'master')),
  degree_type text not null default 'bachelor' check (degree_type in ('bachelor', 'master')),
  start_academic_year text not null default '2025/2026',
  total_ects integer not null default 180 check (total_ects in (60, 120, 180, 240)),
  total_semesters integer not null default 6 check (total_semesters > 0),
  semester_ects_default numeric(6,2) not null default 30 check (semester_ects_default > 0),
  program_ects integer not null default 180 check (program_ects in (60, 120, 180)),
  previous_ects integer not null default 0 check (previous_ects in (0, 180)),
  total_cycle_ects integer not null default 180 check (total_cycle_ects in (180, 240, 300)),
  years_count integer not null default 3 check (years_count > 0),
  default_semester_ects numeric(6,2) not null default 30 check (default_semester_ects > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.study_programs(id) on delete cascade,
  name text not null,
  year_number integer not null check (year_number > 0),
  created_at timestamptz not null default now(),
  unique (program_id, year_number),
  unique (program_id, name)
);

create table if not exists public.semesters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid references public.study_programs(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete cascade,
  name text not null,
  academic_year text,
  semester_number integer check (semester_number is null or semester_number > 0),
  target_ects numeric(6,2) not null default 30 check (target_ects > 0),
  created_at timestamptz not null default now(),
  unique (program_id, semester_number)
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete cascade,
  name text not null,
  ects numeric(6,2) not null check (ects > 0),
  grade integer not null check (grade between 5 and 10),
  status text not null check (status in ('passed', 'failed')),
  created_at timestamptz not null default now(),
  constraint passed_subject_grade check (
    (status = 'passed' and grade between 6 and 10)
    or (status = 'failed' and grade = 5)
  )
);

alter table public.profiles enable row level security;
alter table public.study_programs enable row level security;
alter table public.academic_years enable row level security;
alter table public.semesters enable row level security;
alter table public.subjects enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'Users can read own profile'
  ) then
    create policy "Users can read own profile"
      on public.profiles for select
      using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'Users can insert own profile'
  ) then
    create policy "Users can insert own profile"
      on public.profiles for insert
      with check (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'Users can update own profile'
  ) then
    create policy "Users can update own profile"
      on public.profiles for update
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'study_programs' and policyname = 'Users can manage own study programs'
  ) then
    create policy "Users can manage own study programs"
      on public.study_programs for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'academic_years' and policyname = 'Users can manage own academic years'
  ) then
    create policy "Users can manage own academic years"
      on public.academic_years for all
      using (auth.uid() = user_id)
      with check (
        auth.uid() = user_id
        and exists (
          select 1
          from public.study_programs
          where study_programs.id = academic_years.program_id
            and study_programs.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'semesters' and policyname = 'Users can manage own semesters'
  ) then
    create policy "Users can manage own semesters"
      on public.semesters for all
      using (auth.uid() = user_id)
      with check (
        auth.uid() = user_id
        and (
          program_id is null
          or exists (
            select 1
            from public.study_programs
            where study_programs.id = semesters.program_id
              and study_programs.user_id = auth.uid()
          )
        )
        and (
          academic_year_id is null
          or exists (
            select 1
            from public.academic_years
            where academic_years.id = semesters.academic_year_id
              and academic_years.user_id = auth.uid()
          )
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subjects' and policyname = 'Users can manage own subjects'
  ) then
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
  end if;
end $$;

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

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created'
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $$;
