-- Medicines: add a new medicine to the master. Run once in Supabase SQL Editor.
-- SECURITY INVOKER: the caller's RLS applies (insert allowed for owner / branch_manager / store_keeper
-- and only for the caller's own company).
-- company_id is taken from the caller's profile (auth_company_id()), never from the browser.
-- Owners have no branch, so the company comes from the profile, not from a branch.

create or replace function create_medicine(
  p_name          text,
  p_generic_name  text,
  p_manufacturer  text,
  p_hsn_code      text,
  p_gst_rate      numeric,
  p_schedule      text,
  p_mrp           numeric,
  p_reorder_level int
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company uuid;
  v_name    text := btrim(coalesce(p_name, ''));
  v_id      uuid;
begin
  v_company := auth_company_id();
  if v_company is null then
    raise exception 'NO_COMPANY';
  end if;

  if v_name = '' then
    raise exception 'INVALID_NAME';
  end if;
  if p_gst_rate is null or p_gst_rate not in (0, 5, 12, 18) then
    raise exception 'INVALID_GST';
  end if;
  if p_schedule is null or p_schedule not in ('OTC', 'H', 'H1', 'X') then
    raise exception 'INVALID_SCHEDULE';
  end if;
  if p_mrp is null or p_mrp <= 0 then
    raise exception 'INVALID_MRP';
  end if;
  if p_reorder_level is null or p_reorder_level < 0 then
    raise exception 'INVALID_REORDER';
  end if;

  -- same name (case-insensitive) in the same company
  if exists (
    select 1 from medicines m
     where m.company_id = v_company
       and m.deleted_at is null
       and lower(btrim(m.name)) = lower(v_name)
  ) then
    raise exception 'DUPLICATE_NAME';
  end if;

  insert into medicines (company_id, name, generic_name, manufacturer, hsn_code,
                         gst_rate, schedule, mrp, reorder_level)
  values (v_company, v_name,
          nullif(btrim(coalesce(p_generic_name, '')), ''),
          nullif(btrim(coalesce(p_manufacturer, '')), ''),
          nullif(btrim(coalesce(p_hsn_code, '')), ''),
          p_gst_rate, p_schedule::drug_schedule, round(p_mrp, 2), p_reorder_level)
  returning id into v_id;

  return v_id;
end $$;

revoke execute on function create_medicine(text, text, text, text, numeric, text, numeric, int) from public, anon;
grant  execute on function create_medicine(text, text, text, text, numeric, text, numeric, int) to authenticated;
