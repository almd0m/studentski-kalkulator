alter table public.study_programs
  add column if not exists study_type text,
  add column if not exists program_ects integer not null default 180,
  add column if not exists previous_ects integer not null default 0,
  add column if not exists total_cycle_ects integer not null default 180,
  add column if not exists years_count integer not null default 3,
  add column if not exists default_semester_ects numeric(6,2) not null default 30;

update public.study_programs
set
  study_type = coalesce(
    study_type,
    case
      when coalesce(study_level, degree_type) = 'master' and coalesce(total_ects, 180) <= 60 then 'master_1_year'
      when coalesce(study_level, degree_type) = 'master' then 'master_2_year'
      else 'bachelor_3_year'
    end
  );

update public.study_programs
set
  program_ects = case
    when study_type = 'master_1_year' then 60
    when study_type = 'master_2_year' then 120
    else 180
  end,
  previous_ects = case
    when study_type in ('master_1_year', 'master_2_year') then 180
    else 0
  end,
  total_cycle_ects = case
    when study_type = 'master_1_year' then 240
    when study_type = 'master_2_year' then 300
    else 180
  end,
  years_count = case
    when study_type = 'master_1_year' then 1
    when study_type = 'master_2_year' then 2
    else 3
  end,
  default_semester_ects = coalesce(semester_ects_default, default_semester_ects, 30);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'study_programs_study_type_check') then
    alter table public.study_programs
      add constraint study_programs_study_type_check
      check (study_type in ('bachelor_3_year', 'master_1_year', 'master_2_year'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'study_programs_program_ects_check') then
    alter table public.study_programs
      add constraint study_programs_program_ects_check
      check (program_ects in (60, 120, 180));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'study_programs_previous_ects_check') then
    alter table public.study_programs
      add constraint study_programs_previous_ects_check
      check (previous_ects in (0, 180));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'study_programs_total_cycle_ects_check') then
    alter table public.study_programs
      add constraint study_programs_total_cycle_ects_check
      check (total_cycle_ects in (180, 240, 300));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'study_programs_years_count_check') then
    alter table public.study_programs
      add constraint study_programs_years_count_check
      check (years_count > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'study_programs_default_semester_ects_check') then
    alter table public.study_programs
      add constraint study_programs_default_semester_ects_check
      check (default_semester_ects > 0);
  end if;
end $$;
