-- Phase 4: Central database schema
-- Designed for Supabase/PostgreSQL

create table if not exists students (
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

create table if not exists attendance_sessions (
  id bigint generated always as identity primary key,
  session_name text not null,
  subject_code text,
  subject_name text,
  class_name text,
  starts_at timestamptz not null default now(),
  closes_at timestamptz,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);

create table if not exists attendance_records (
  id bigint generated always as identity primary key,
  session_id bigint not null references attendance_sessions(id) on delete cascade,
  student_id text not null references students(student_id) on update cascade,
  checked_at timestamptz not null default now(),
  status text not null default 'present' check (status in ('present','late','absent','excused')),
  unique(session_id, student_id)
);

create index if not exists idx_students_class_name on students(class_name);
create index if not exists idx_attendance_session on attendance_records(session_id);
create index if not exists idx_attendance_student on attendance_records(student_id);

-- QR should contain only a stable student reference such as: student:68201050001
