-- Production cleanup 5.8
-- ใช้ครั้งเดียวก่อนเปิดระบบใช้งานจริง
--
-- สิ่งที่จะลบ:
--   1) attendance_records       = ประวัติการเช็กชื่อทดสอบ
--   2) attendance_sessions      = คาบเรียน/Session ทดสอบ
--   3) attendance_subject_enrollments = รายชื่อนักเรียนที่ลงทะเบียนทดสอบ
--
-- สิ่งที่จะเก็บไว้:
--   attendance_students          = ทะเบียนนักเรียนหลัก
--   attendance_subjects          = รายวิชาหลัก
--   attendance_weekly_schedules  = ตารางเรียน
--   academic_terms               = ภาคเรียน
--   RPC / policy / index ต่าง ๆ
--
-- หมายเหตุ: ก่อนรันให้ตรวจสอบว่าข้อมูลใน 3 ตารางที่จะลบเป็นข้อมูลทดสอบทั้งหมดแล้ว

begin;

-- 1. ลบประวัติการเช็กชื่อก่อน เพราะอ้างอิง Session
truncate table public.attendance_records;

-- 2. ลบ Session/คาบเรียนที่สร้างไว้เพื่อทดสอบ
truncate table public.attendance_sessions;

-- 3. ลบรายชื่อลงทะเบียนรายวิชาที่สร้างไว้เพื่อทดสอบ
truncate table public.attendance_subject_enrollments;

-- 4. ปิดการเปิดรับสมัครจากหน้า Student Check-in
--    ระบบ production ใช้ครูเป็นผู้ลงทะเบียนผ่านหน้า "ลงทะเบียนเรียน"
update public.attendance_subjects
set registration_open = false
where registration_open = true;

-- 5. ลบ RPC เก่าสำหรับ self-registration จากหน้า Student Check-in
--    Frontend รุ่น production ไม่เรียกใช้ function นี้แล้ว

drop function if exists public.register_student_for_session(uuid, text, text, text, text);

commit;

-- ==============================
-- ตรวจสอบหลัง Cleanup
-- ==============================
select
  (select count(*) from public.attendance_records) as attendance_records,
  (select count(*) from public.attendance_sessions) as attendance_sessions,
  (select count(*) from public.attendance_subject_enrollments) as subject_enrollments,
  (select count(*) from public.attendance_students) as master_students,
  (select count(*) from public.attendance_subjects) as subjects,
  (select count(*) from public.attendance_weekly_schedules) as weekly_schedules,
  (select count(*) from public.academic_terms) as academic_terms;

-- ค่าที่คาดหวังหลังล้างระบบ:
-- attendance_records       = 0
-- attendance_sessions      = 0
-- attendance_subject_enrollments = 0
-- master_students          > 0 (ถ้ามีข้อมูลนักเรียน)
-- subjects                 > 0 (ถ้ามีข้อมูลรายวิชา)
-- weekly_schedules         > 0 (ถ้ามีตารางเรียน)
-- academic_terms           > 0