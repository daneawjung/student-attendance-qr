-- Production migration 5.1
-- Make student subject enrollment term-aware.
-- Run after migration 5.0 academic terms has been completed.

alter table attendance_subject_enrollments
  add column if not exists term_id uuid
  references academic_terms(id)
  on delete restrict;

do $$
begin
  if exists (select 1 from attendance_subject_enrollments where term_id is null) then
    raise exception 'พบ enrollment ที่ยังไม่มี term_id กรุณากำหนดภาคเรียนก่อน';
  end if;
end $$;

create index if not exists idx_subject_enrollments_term
on attendance_subject_enrollments(term_id, subject_id, status);

alter table attendance_subject_enrollments
  drop constraint if exists attendance_subject_enrollments_subject_id_student_id_key;

create unique index if not exists uq_subject_enrollments_by_term
on attendance_subject_enrollments(term_id, subject_id, student_id);

drop function if exists register_student_for_session(uuid,text,text,text,text);

create or replace function register_student_for_session(
  p_session_id uuid,
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
  select * into v_session from attendance_sessions where id=p_session_id for update;
  if not found then raise exception 'ไม่พบคาบเรียน'; end if;
  if v_session.status <> 'open' then raise exception 'คาบเรียนนี้ปิดการเช็กชื่อแล้ว'; end if;
  if v_session.term_id is null then raise exception 'คาบเรียนนี้ยังไม่ได้กำหนดภาคเรียน'; end if;

  select * into v_subject from attendance_subjects
  where subject_code=v_session.subject_code and active=true for update;
  if not found then raise exception 'ไม่พบรายวิชา'; end if;
  if not coalesce(v_subject.registration_open,false) then raise exception 'รายวิชานี้ปิดรับลงทะเบียน'; end if;

  select * into v_student from attendance_students where student_id=trim(p_student_id) for update;
  if found then
    if v_student.status <> 'active' then raise exception 'นักเรียนไม่ได้อยู่ในสถานะ active'; end if;
    if v_student.class_name <> v_session.class_name then raise exception 'ห้องของนักเรียนไม่ตรงกับคาบเรียน'; end if;
  else
    insert into attendance_students(student_id,prefix,first_name,last_name,class_name,status)
    values(trim(p_student_id),nullif(trim(p_prefix),''),trim(p_first_name),trim(p_last_name),v_session.class_name,'active')
    returning * into v_student;
  end if;

  select exists(
    select 1 from attendance_subject_enrollments
    where term_id=v_session.term_id and subject_id=v_subject.id
      and student_id=v_student.id and status='active'
  ) into v_enrolled;

  if not v_enrolled then
    select count(*) into v_count
    from attendance_subject_enrollments
    where term_id=v_session.term_id and subject_id=v_subject.id and status='active';

    if v_subject.max_students is not null and v_count >= v_subject.max_students then
      raise exception 'รายวิชานี้มีผู้ลงทะเบียนครบ % คนแล้ว',v_subject.max_students;
    end if;

    insert into attendance_subject_enrollments(term_id,subject_id,student_id,class_name,status)
    values(v_session.term_id,v_subject.id,v_student.id,v_session.class_name,'active');
  end if;

  return json_build_object(
    'student_id',v_student.id,'student_code',v_student.student_id,
    'prefix',v_student.prefix,'first_name',v_student.first_name,
    'last_name',v_student.last_name,'class_name',v_student.class_name,
    'enrolled',true
  );
end;
$$;

revoke all on function register_student_for_session(uuid,text,text,text,text) from public;
grant execute on function register_student_for_session(uuid,text,text,text,text) to anon, authenticated;
