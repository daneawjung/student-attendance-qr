-- Production migration 5.5
-- Ensure the academic-term switching RPC exists with the exact signature
-- expected by the frontend.

drop function if exists set_active_academic_term(uuid);

create function set_active_academic_term(p_term_id uuid)
returns academic_terms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_term academic_terms%rowtype;
begin
  select * into v_term
  from academic_terms
  where id = p_term_id
  for update;

  if not found then
    raise exception 'ไม่พบภาคเรียนที่ต้องการเปิดใช้งาน';
  end if;

  update academic_terms
  set active = false,
      updated_at = now()
  where active = true
    and id <> p_term_id;

  update academic_terms
  set active = true,
      updated_at = now()
  where id = p_term_id
  returning * into v_term;

  return v_term;
end;
$$;

revoke all on function set_active_academic_term(uuid) from public;
grant execute on function set_active_academic_term(uuid) to anon, authenticated;
