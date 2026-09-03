-- Production migration 4.11
-- Student self-registration with per-subject capacity.
-- Run once in Supabase SQL Editor.

alter table attendance_subjects
  add column if not exists max_students integer,
  add column if not exists registration_open boolean not null default false;

alter table attendance_subjects
  drop constraint if exists attendance_subjects_max_students_check;
alter table attendance_subjects
  add constraint attendance_subjects_max_students_check
  check (max_students is null or max_students > 0);

create table if not exists attendance_subject_enrollments (
  id bigint generated always as identity primary key,
  subject_id bigint not null references attendance_subjects(id) on delete cascade,
  student_id bigint not null references attendance_students(id) on delete cascade,
  class_name text not null,
  status text not null default 'active' check (status in ('active','inactive')),
  registered_at timestamptz not null default now(),
  unique(subject_id, student_id)
);

create index if not exists idx_subject_enrollments_subject
  on attendance_subject_enrollments(subject_id, status);
create index if not exists idx_subject_enrollments_student
  on attendance_subject_enrollments(student_id, status);

-- Atomic registration entry point used by the QR check-in page.
-- It creates the student when no roster exists, enrolls them in the subject,
-- and enforces the subject capacity inside one database transaction.
create or replace function register_student_for_session(
  p_session_id bigint,
  p_student_id text,
  p_prefix text,
  p_first_name text,
  p_last_name text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session attendance_sessions%rowtype;
  v_subject attendance_subjects%rowtype;
  v_student attendance_students%rowtype;
  v_enrolled boolean;
  v_count integer;
begin
  select * into v_session from attendance_sessions where id = p_session_id for update;
  if not found then raise exception 'ไม่พบคาบเรียน'; end if;
  if v_session.status <> 'open' then raise exception 'คาบเรียนนี้ปิดการเช็กชื่อแล้ว'; end if;

  select * into v_subject from attendance_subjects
  where subject_code = v_session.subject_code and active = true;
  if not found then raise exception 'ไม่พบรายวิชา'; end if;
  if not coalesce(v_subject.registration_open,false) then raise exception 'รายวิชานี้ปิดรับลงทะเบียน'; end if;

  select * into v_student from attendance_students where student_id = trim(p_student_id) for update;
  if found then
    if v_student.status <> 'active' then raise exception 'นักเรียนไม่ได้อยู่ในสถานะ active'; end if;
    if v_student.class_name <> v_session.class_name then
      raise exception 'ห้องของนักเรียนไม่ตรงกับคาบเรียน';
    end if;
  else
    insert into attendance_students(student_id,prefix,first_name,last_name,class_name,status)
    values(trim(p_student_id),nullif(trim(p_prefix),''),trim(p_first_name),trim(p_last_name),v_session.class_name,'active')
    returning * into v_student;
  end if;

  select exists(select 1 from attendance_subject_enrollments
    where subject_id=v_subject.id and student_id=v_student.id and status='active') into v_enrolled;
  if not v_enrolled then
    select count(*) into v_count from attendance_subject_enrollments
      where subject_id=v_subject.id and status='active';
    if v_subject.max_students is not null and v_count >= v_subject.max_students then
      raise exception 'รายวิชานี้มีผู้ลงทะเบียนครบ % คนแล้ว', v_subject.max_students;
    end if;
    insert into attendance_subject_enrollments(subject_id,student_id,class_name,status)
      values(v_subject.id,v_student.id,v_session.class_name,'active');
  end if;

  return json_build_object(
    'student_id', v_student.id,
    'student_code', v_student.student_id,
    'prefix', v_student.prefix,
    'first_name', v_student.first_name,
    'last_name', v_student.last_name,
    'class_name', v_student.class_name,
    'enrolled', true
  );
end;
$$;

revoke all on function register_student_for_session(bigint,text,text,text,text) from public;
grant execute on function register_student_for_session(bigint,text,text,text,text) to anon, authenticated;
