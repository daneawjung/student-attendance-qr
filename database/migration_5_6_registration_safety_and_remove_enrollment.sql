-- 5.6: ป้องกันการสร้างนักเรียนผิดจากการพิมพ์รหัสผิด และให้ครูถอนนักเรียนออกจากรายวิชาได้

-- ครู/ผู้ดูแลสามารถถอนนักเรียนออกจากรายวิชาในภาคเรียนของ Session
-- และลบ attendance record ของ Session นั้นด้วย เพื่อไม่ให้รายงานคาบมีข้อมูลของรายการที่ถอนผิด
create or replace function public.remove_student_from_session(
  p_session_id uuid,
  p_student_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_term_id uuid;
  v_subject_id uuid;
  v_class_name text;
  v_deleted_records integer := 0;
  v_deleted_enrollments integer := 0;
begin
  select s.term_id, s.class_name, sub.id
    into v_term_id, v_class_name, v_subject_id
  from attendance_sessions s
  join attendance_subjects sub on sub.subject_code = s.subject_code
  where s.id = p_session_id;

  if v_term_id is null or v_subject_id is null then
    raise exception 'ไม่พบ Session หรือรายวิชา/ภาคเรียนของ Session นี้';
  end if;

  delete from attendance_records
  where session_id = p_session_id
    and student_id = p_student_id;
  get diagnostics v_deleted_records = row_count;

  delete from attendance_subject_enrollments
  where term_id = v_term_id
    and subject_id = v_subject_id
    and student_id = p_student_id
    and class_name = v_class_name;
  get diagnostics v_deleted_enrollments = row_count;

  return jsonb_build_object(
    'deleted_records', v_deleted_records,
    'deleted_enrollments', v_deleted_enrollments
  );
end;
$$;

grant execute on function public.remove_student_from_session(uuid, uuid) to anon, authenticated;
