create extension if not exists "pgcrypto";

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

create table if not exists public.study_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  university_name text,
  faculty_name text,
  program_name text,
  study_level text check (study_level in ('bachelor', 'master')),
  degree_type text not null check (degree_type in ('bachelor', 'master')),
  start_academic_year text not null check (start_academic_year ~ '^[0-9]{4}/[0-9]{4}$'),
  total_ects integer not null check (total_ects in (60, 120, 180, 240)),
  total_semesters integer not null check (total_semesters > 0),
  semester_ects_default numeric(6,2) not null default 30 check (semester_ects_default > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.study_programs(id) on delete cascade,
  name text not null check (name ~ '^[0-9]{4}/[0-9]{4}$'),
  year_number integer not null check (year_number > 0),
  created_at timestamptz not null default now(),
  unique (program_id, year_number),
  unique (program_id, name)
);

alter table public.semesters
  add column if not exists program_id uuid references public.study_programs(id) on delete cascade,
  add column if not exists academic_year_id uuid references public.academic_years(id) on delete cascade,
  add column if not exists semester_number integer,
  add column if not exists target_ects numeric(6,2) not null default 30;

alter table public.semesters
  alter column academic_year drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'semesters_semester_number_positive'
  ) then
    alter table public.semesters
      add constraint semesters_semester_number_positive
      check (semester_number is null or semester_number > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'semesters_target_ects_positive'
  ) then
    alter table public.semesters
      add constraint semesters_target_ects_positive
      check (target_ects > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'semesters_program_semester_number_unique'
  ) then
    alter table public.semesters
      add constraint semesters_program_semester_number_unique
      unique (program_id, semester_number);
  end if;
end $$;

alter table public.study_programs enable row level security;
alter table public.academic_years enable row level security;

drop policy if exists "Users can manage own study programs" on public.study_programs;
create policy "Users can manage own study programs"
  on public.study_programs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage own academic years" on public.academic_years;
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

drop policy if exists "Users can manage own semesters" on public.semesters;
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

drop policy if exists "Users can manage own subjects" on public.subjects;
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
  insert into public.profiles (id, email, onboarding_completed)
  values (new.id, new.email, false)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
