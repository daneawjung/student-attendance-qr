-- Production hardening 4.10
-- Run once in Supabase SQL Editor.
-- This migration is safe to run repeatedly.
-- Note: attendance_records already has the intended unique(session_id, student_id)
-- in migration_4_8_production.sql; this index makes the invariant explicit for
-- installations that may have created the table separately.

create unique index if not exists uq_attendance_records_session_student
on attendance_records(session_id, student_id);

create index if not exists idx_attendance_records_checked_at
on attendance_records(checked_at);

-- Keep RLS enabled on the attendance tables. The current application uses the
-- public/anon Supabase client for student check-in and teacher control/report.
-- Do NOT replace the existing policies with restrictive authenticated-only
-- policies until teacher authentication is implemented, otherwise the live
-- prototype will stop working. The next security phase should move privileged
-- teacher writes behind Supabase Auth/RPC and then tighten these policies.
alter table attendance_students enable row level security;
alter table attendance_subjects enable row level security;
alter table attendance_weekly_schedules enable row level security;
alter table attendance_sessions enable row level security;
alter table attendance_records enable row level security;
