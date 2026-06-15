create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists full_name text;

create table if not exists public.study_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  degree_type text not null default 'bachelor',
  start_academic_year text not null default '2025/2026',
  total_ects integer not null default 180,
  total_semesters integer not null default 6,
  created_at timestamptz not null default now()
);

alter table public.study_programs
  add column if not exists university_name text,
  add column if not exists faculty_name text,
  add column if not exists program_name text,
  add column if not exists study_level text,
  add column if not exists semester_ects_default numeric(6,2) not null default 30;

update public.study_programs
set study_level = coalesce(study_level, degree_type)
where study_level is null
  and degree_type is not null;

create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.study_programs(id) on delete cascade,
  name text not null,
  year_number integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.semesters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  academic_year text,
  created_at timestamptz not null default now()
);

alter table public.semesters
  add column if not exists program_id uuid references public.study_programs(id) on delete cascade,
  add column if not exists academic_year_id uuid references public.academic_years(id) on delete cascade,
  add column if not exists semester_number integer,
  add column if not exists target_ects numeric(6,2) not null default 30;

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete cascade,
  name text not null,
  ects numeric(6,2) not null,
  grade integer,
  status text not null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'study_programs_degree_type_check') then
    alter table public.study_programs
      add constraint study_programs_degree_type_check
      check (degree_type in ('bachelor', 'master'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'study_programs_study_level_check') then
    alter table public.study_programs
      add constraint study_programs_study_level_check
      check (study_level is null or study_level in ('bachelor', 'master'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'study_programs_total_ects_check') then
    alter table public.study_programs
      add constraint study_programs_total_ects_check
      check (total_ects in (60, 120, 180, 240));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'study_programs_total_semesters_check') then
    alter table public.study_programs
      add constraint study_programs_total_semesters_check
      check (total_semesters > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'study_programs_semester_ects_default_positive') then
    alter table public.study_programs
      add constraint study_programs_semester_ects_default_positive
      check (semester_ects_default > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'academic_years_year_number_check') then
    alter table public.academic_years
      add constraint academic_years_year_number_check
      check (year_number > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'academic_years_program_year_number_key') then
    alter table public.academic_years
      add constraint academic_years_program_year_number_key
      unique (program_id, year_number);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'academic_years_program_name_key') then
    alter table public.academic_years
      add constraint academic_years_program_name_key
      unique (program_id, name);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'semesters_semester_number_positive') then
    alter table public.semesters
      add constraint semesters_semester_number_positive
      check (semester_number is null or semester_number > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'semesters_target_ects_positive') then
    alter table public.semesters
      add constraint semesters_target_ects_positive
      check (target_ects > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'semesters_program_semester_number_unique') then
    alter table public.semesters
      add constraint semesters_program_semester_number_unique
      unique (program_id, semester_number);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'subjects_ects_check') then
    alter table public.subjects
      add constraint subjects_ects_check
      check (ects > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'subjects_grade_check') then
    alter table public.subjects
      add constraint subjects_grade_check
      check (grade between 5 and 10);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'subjects_status_check') then
    alter table public.subjects
      add constraint subjects_status_check
      check (status in ('passed', 'failed', 'planned'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'passed_subject_grade') then
    alter table public.subjects
      add constraint passed_subject_grade
      check (
        (status = 'passed' and grade between 6 and 10)
        or (status = 'failed' and (grade is null or grade = 5))
        or (status = 'planned' and grade is null)
      );
  end if;
end $$;

alter table public.profiles enable row level security;
alter table public.study_programs enable row level security;
alter table public.academic_years enable row level security;
alter table public.semesters enable row level security;
alter table public.subjects enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

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
  insert into public.profiles (id, email, full_name, onboarding_completed)
  values (new.id, new.email, null, false)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
