-- Production migration 5.0
-- Academic year / semester support.
-- Existing attendance data is preserved. Run once in Supabase SQL Editor.

create table if not exists academic_terms (
  id uuid primary key default gen_random_uuid(),
  academic_year integer not null,
  semester integer not null check (semester in (1,2,3)),
  name text not null,
  active boolean not null default false,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(academic_year, semester)
);

create unique index if not exists uq_academic_terms_one_active
on academic_terms(active) where active = true;

alter table attendance_weekly_schedules
  add column if not exists term_id uuid references academic_terms(id) on delete restrict;

alter table attendance_sessions
  add column if not exists term_id uuid references academic_terms(id) on delete restrict;

alter table attendance_subject_enrollments
  add column if not exists term_id uuid references academic_terms(id) on delete restrict;

create index if not exists idx_weekly_schedules_term
on attendance_weekly_schedules(term_id, day_of_week, start_time);

create index if not exists idx_attendance_sessions_term
on attendance_sessions(term_id, session_date, start_time);

create index if not exists idx_subject_enrollments_term
on attendance_subject_enrollments(term_id, subject_id, status);

-- The old global weekly-slot index prevents the same timetable from existing in two semesters.
-- Replace it with a term-aware unique index.
drop index if exists uq_weekly_schedule_slot;
create unique index if not exists uq_weekly_schedule_slot_by_term
on attendance_weekly_schedules(term_id, day_of_week, start_time, subject_id, class_name);

-- Keep the currently used semester as the initial active term when no term exists yet.
insert into academic_terms(academic_year, semester, name, active)
select 2569, 1, '2569/1', true
where not exists (select 1 from academic_terms);

-- Preserve all existing data by assigning rows without a term to the current active term.
do $$
declare
  v_term uuid;
begin
  select id into v_term from academic_terms where active = true limit 1;
  if v_term is not null then
    update attendance_weekly_schedules set term_id = v_term where term_id is null;
    update attendance_sessions set term_id = v_term where term_id is null;
    update attendance_subject_enrollments set term_id = v_term where term_id is null;
  end if;
end $$;

create or replace function set_active_academic_term(p_term_id uuid)
returns academic_terms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_term academic_terms%rowtype;
begin
  select * into v_term from academic_terms where id = p_term_id for update;
  if not found then raise exception 'ไม่พบภาคเรียนที่ต้องการเปิดใช้งาน'; end if;

  update academic_terms set active = false, updated_at = now() where active = true;
  update academic_terms set active = true, updated_at = now() where id = p_term_id
    returning * into v_term;

  return v_term;
end;
$$;

revoke all on function set_active_academic_term(uuid) from public;
grant execute on function set_active_academic_term(uuid) to anon, authenticated;

create or replace function create_next_academic_term(
  p_academic_year integer,
  p_semester integer,
  p_start_date date default null,
  p_end_date date default null,
  p_copy_schedule_from_active boolean default true
)
returns academic_terms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new academic_terms%rowtype;
  v_source uuid;
begin
  if p_semester not in (1,2,3) then raise exception 'ภาคเรียนต้องเป็น 1, 2 หรือ 3'; end if;
  if exists(select 1 from academic_terms where academic_year=p_academic_year and semester=p_semester) then
    raise exception 'มีภาคเรียน %/% อยู่แล้ว', p_academic_year, p_semester;
  end if;

  select id into v_source from academic_terms where active = true limit 1;

  insert into academic_terms(academic_year, semester, name, active, start_date, end_date)
  values(p_academic_year, p_semester, p_academic_year||'/'||p_semester, false, p_start_date, p_end_date)
  returning * into v_new;

  if p_copy_schedule_from_active and v_source is not null then
    insert into attendance_weekly_schedules(
      day_of_week,start_time,end_time,subject_id,subject_code,subject_name,
      class_name,room,teacher_name,active,term_id
    )
    select day_of_week,start_time,end_time,subject_id,subject_code,subject_name,
      class_name,room,teacher_name,true,v_new.id
    from attendance_weekly_schedules
    where term_id=v_source and active=true;
  end if;

  return v_new;
end;
$$;

revoke all on function create_next_academic_term(integer,integer,date,date,boolean) from public;
grant execute on function create_next_academic_term(integer,integer,date,date,boolean) to anon, authenticated;
