-- Production migration 5.3
-- Allow the frontend to read academic terms.
-- The application uses the anon Supabase client, while term creation/switching
-- remains protected through SECURITY DEFINER RPC functions.

-- Read access is needed by academic-terms.js, weekly.js, schedule.js,
-- today.js, dashboard.js, and report.js.
grant select on academic_terms to anon, authenticated;

-- If RLS is enabled on the table, explicitly allow read-only access.
alter table academic_terms enable row level security;

drop policy if exists academic_terms_read on academic_terms;
create policy academic_terms_read
on academic_terms
for select
to anon, authenticated
using (true);
