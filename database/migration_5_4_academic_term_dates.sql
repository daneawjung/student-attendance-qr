-- Production migration 5.4
-- Allow editing academic-term start/end dates for existing terms.

create or replace function update_academic_term_dates(
  p_term_id uuid,
  p_start_date date,
  p_end_date date
)
returns academic_terms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_term academic_terms%rowtype;
begin
  if p_start_date is not null and p_end_date is not null and p_start_date > p_end_date then
    raise exception 'วันเริ่มภาคเรียนต้องไม่เกินวันสิ้นสุด';
  end if;

  update academic_terms
  set start_date = p_start_date,
      end_date = p_end_date,
      updated_at = now()
  where id = p_term_id
  returning * into v_term;

  if not found then
    raise exception 'ไม่พบภาคเรียนที่ต้องการแก้ไข';
  end if;

  return v_term;
end;
$$;

revoke all on function update_academic_term_dates(uuid,date,date) from public;
grant execute on function update_academic_term_dates(uuid,date,date) to anon, authenticated;
