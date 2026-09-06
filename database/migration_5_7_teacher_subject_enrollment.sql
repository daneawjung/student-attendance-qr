-- Production migration 5.7
-- Teacher-managed, term-specific subject enrollment.
-- Run once in Supabase SQL Editor.

create or replace function public.manage_subject_enrollments(
  p_term_id uuid,
  p_subject_id uuid,
  p_class_name text,
  p_student_ids uuid[],
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject attendance_subjects%rowtype;
  v_term academic_terms%rowtype;
  v_student attendance_students%rowtype;
  v_id uuid;
  v_enrolled integer := 0;
  v_removed integer := 0;
  v_skipped integer := 0;
  v_current integer;
begin
  if p_action not in ('enroll','remove') then
    raise exception 'การดำเนินการไม่ถูกต้อง';
  end if;
  if p_term_id is null or p_subject_id is null or nullif(trim(p_class_name),'') is null then
    raise exception 'ข้อมูลภาคเรียน รายวิชา หรือห้องไม่ครบ';
  end if;

  select * into v_term from academic_terms where id = p_term_id;
  if not found then raise exception 'ไม่พบภาคเรียน'; end if;

  select * into v_subject from attendance_subjects where id = p_subject_id for update;
  if not found then raise exception 'ไม่พบรายวิชา'; end if;
  if not v_subject.active then raise exception 'รายวิชานี้ถูกปิดใช้งาน'; end if;

  if p_action = 'enroll' then
    select count(*) into v_current
    from attendance_subject_enrollments
    where term_id=p_term_id and subject_id=p_subject_id
      and class_name=trim(p_class_name) and status='active';

    foreach v_id in array coalesce(p_student_ids, array[]::uuid[]) loop
      select * into v_student from attendance_students where id=v_id;
      if not found or v_student.status <> 'active' or v_student.class_name <> trim(p_class_name) then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      if exists(select 1 from attendance_subject_enrollments where term_id=p_term_id and subject_id=p_subject_id and student_id=v_id and class_name=trim(p_class_name) and status='active') then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      if v_subject.max_students is not null and v_current >= v_subject.max_students then
        raise exception 'รายวิชานี้มีผู้ลงทะเบียนครบ % คนแล้ว', v_subject.max_students;
      end if;

      insert into attendance_subject_enrollments(subject_id,student_id,class_name,status,term_id)
      values(p_subject_id,v_id,trim(p_class_name),'active',p_term_id);
      v_current := v_current + 1;
      v_enrolled := v_enrolled + 1;
    end loop;
  else
    foreach v_id in array coalesce(p_student_ids, array[]::uuid[]) loop
      delete from attendance_subject_enrollments
      where term_id=p_term_id and subject_id=p_subject_id
        and student_id=v_id and class_name=trim(p_class_name);
      if found then v_removed := v_removed + 1; end if;
    end loop;
  end if;

  return jsonb_build_object('enrolled',v_enrolled,'removed',v_removed,'skipped',v_skipped);
end;
$$;

revoke all on function public.manage_subject_enrollments(uuid,uuid,text,uuid[],text) from public;
grant execute on function public.manage_subject_enrollments(uuid,uuid,text,uuid[],text) to anon, authenticated;
