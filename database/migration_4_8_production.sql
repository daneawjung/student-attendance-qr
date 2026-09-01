-- Production migration 4.8
-- Run once in Supabase SQL Editor if these objects are not already present.
-- This migration is additive and keeps existing attendance data.

create table if not exists attendance_students (
  id bigint generated always as identity primary key,
  student_id text not null unique,
  student_no integer,
  prefix text,
  first_name text not null,
  last_name text not null,
  class_name text not null,
  department text,
  level text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists attendance_subjects (
  id bigint generated always as identity primary key,
  subject_code text not null unique,
  subject_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists attendance_weekly_schedules (
  id bigint generated always as identity primary key,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  subject_id bigint not null references attendance_subjects(id) on delete restrict,
  subject_code text not null,
  subject_name text not null,
  class_name text not null,
  room text,
  teacher_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time)
);

create table if not exists attendance_sessions (
  id bigint generated always as identity primary key,
  session_code text not null unique,
  subject_code text,
  subject_name text not null,
  class_name text not null,
  session_date date not null default current_date,
  start_time time,
  end_time time,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);

create table if not exists attendance_records (
  id bigint generated always as identity primary key,
  session_id bigint not null references attendance_sessions(id) on delete cascade,
  student_id bigint not null references attendance_students(id) on update cascade,
  checked_at timestamptz not null default now(),
  status text not null default 'present' check (status in ('present','late','leave','absent')),
  unique(session_id, student_id)
);

-- Existing installations may have used 'excused'. Replace that check with the production statuses.
do $$
declare c record;
begin
  for c in select conname from pg_constraint where conrelid='attendance_records'::regclass and contype='c' and pg_get_constraintdef(oid) like '%status%' loop
    execute format('alter table attendance_records drop constraint %I', c.conname);
  end loop;
exception when undefined_table then null;
end $$;

alter table attendance_records add constraint attendance_records_status_check
  check (status in ('present','late','leave','absent'));

create index if not exists idx_attendance_students_class on attendance_students(class_name);
create index if not exists idx_attendance_subjects_active on attendance_subjects(active);
create index if not exists idx_weekly_schedules_day on attendance_weekly_schedules(day_of_week, start_time);
create index if not exists idx_attendance_sessions_date on attendance_sessions(session_date, start_time);
create index if not exists idx_attendance_records_session on attendance_records(session_id);
create index if not exists idx_attendance_records_student on attendance_records(student_id);

-- Prevent duplicate weekly entries for the same class/subject/time slot.
create unique index if not exists uq_weekly_schedule_slot
on attendance_weekly_schedules(day_of_week, start_time, subject_id, class_name);
