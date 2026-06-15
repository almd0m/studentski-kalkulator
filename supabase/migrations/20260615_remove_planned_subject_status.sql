-- Remove legacy planned subject status from constraints without deleting data.
-- This migration is intentionally non-destructive:
-- it stops if legacy rows still need a manual product decision.

do $$
begin
  if exists (
    select 1
    from public.subjects
    where status = 'planned' or grade is null
  ) then
    raise exception
      'Cannot remove planned subject status while subjects.status = planned or subjects.grade is null exists. Update or review legacy rows first.';
  end if;
end $$;

alter table public.subjects
  drop constraint if exists passed_subject_grade;

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.subjects'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%planned%'
  loop
    execute format('alter table public.subjects drop constraint %I', constraint_record.conname);
  end loop;
end $$;

alter table public.subjects
  alter column grade set not null;

alter table public.subjects
  add constraint subjects_status_check
  check (status in ('passed', 'failed'));

alter table public.subjects
  add constraint passed_subject_grade
  check (
    (status = 'passed' and grade between 6 and 10)
    or (status = 'failed' and grade = 5)
  );
