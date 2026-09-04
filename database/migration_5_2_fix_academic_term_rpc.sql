-- Production migration 5.2
-- Fix the academic-term creation RPC parameter names/signature.
-- Run once in Supabase SQL Editor after migration 5.0 and 5.1.

-- PostgreSQL does not allow CREATE OR REPLACE FUNCTION to rename input
-- parameters of an existing function. Drop the old overload first.
drop function if exists create_next_academic_term(integer, integer, date, date, boolean);

create function create_next_academic_term(
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
  if p_semester not in (1,2,3) then
    raise exception 'ภาคเรียนต้องเป็น 1, 2 หรือ 3';
  end if;

  if exists(
    select 1 from academic_terms
    where academic_year = p_academic_year
      and semester = p_semester
  ) then
    raise exception 'มีภาคเรียน %/% อยู่แล้ว', p_academic_year, p_semester;
  end if;

  select id into v_source
  from academic_terms
  where active = true
  limit 1;

  insert into academic_terms(
    academic_year, semester, name, active, start_date, end_date
  )
  values(
    p_academic_year,
    p_semester,
    p_academic_year || '/' || p_semester,
    false,
    p_start_date,
    p_end_date
  )
  returning * into v_new;

  if p_copy_schedule_from_active and v_source is not null then
    insert into attendance_weekly_schedules(
      day_of_week,
      start_time,
      end_time,
      subject_id,
      subject_code,
      subject_name,
      class_name,
      room,
      teacher_name,
      active,
      term_id
    )
    select
      day_of_week,
      start_time,
      end_time,
      subject_id,
      subject_code,
      subject_name,
      class_name,
      room,
      teacher_name,
      true,
      v_new.id
    from attendance_weekly_schedules
    where term_id = v_source
      and active = true;
  end if;

  return v_new;
end;
$$;

revoke all on function create_next_academic_term(integer, integer, date, date, boolean) from public;
grant execute on function create_next_academic_term(integer, integer, date, date, boolean) to anon, authenticated;
