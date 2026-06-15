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

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'study_programs_study_level_check'
  ) then
    alter table public.study_programs
      add constraint study_programs_study_level_check
      check (study_level is null or study_level in ('bachelor', 'master'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'study_programs_semester_ects_default_positive'
  ) then
    alter table public.study_programs
      add constraint study_programs_semester_ects_default_positive
      check (semester_ects_default > 0);
  end if;
end $$;
