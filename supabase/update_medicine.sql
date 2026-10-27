-- Medicines: edit an existing medicine. Run once in Supabase SQL Editor (after create_medicine.sql).
-- SECURITY INVOKER: RLS decides who may update (owner / branch_manager / store_keeper, own company only).
-- Same rules as create_medicine (GST 0/5/12/18, schedule, MRP > 0, reorder >= 0, no duplicate name).
--
-- NOTE: this changes the medicine MASTER only.
--   * Old bills keep the GST rate they were made with (it is stored on each bill item).
--   * New bills use the new GST rate.
--   * Batch MRP lives on each stock batch (set by the purchase), so changing the master MRP does
--     not change the MRP of batches already in stock.

create or replace function update_medicine(
  p_id            uuid,
  p_name          text,
  p_generic_name  text,
  p_manufacturer  text,
  p_hsn_code      text,
  p_gst_rate      numeric,
  p_schedule      text,
  p_mrp           numeric,
  p_reorder_level int
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company uuid;
  v_name    text := btrim(coalesce(p_name, ''));
begin
  if v_name = '' then raise exception 'INVALID_NAME'; end if;
  if p_gst_rate is null or p_gst_rate not in (0, 5, 12, 18) then raise exception 'INVALID_GST'; end if;
  if p_schedule is null or p_schedule not in ('OTC', 'H', 'H1', 'X') then raise exception 'INVALID_SCHEDULE'; end if;
  if p_mrp is null or p_mrp <= 0 then raise exception 'INVALID_MRP'; end if;
  if p_reorder_level is null or p_reorder_level < 0 then raise exception 'INVALID_REORDER'; end if;

  select company_id into v_company from medicines where id = p_id and deleted_at is null;
  if v_company is null then raise exception 'MEDICINE_NOT_FOUND'; end if;

  if exists (
    select 1 from medicines m
     where m.company_id = v_company and m.id <> p_id and m.deleted_at is null
       and lower(btrim(m.name)) = lower(v_name)
  ) then
    raise exception 'DUPLICATE_NAME';
  end if;

  update medicines
     set name         = v_name,
         generic_name = nullif(btrim(coalesce(p_generic_name, '')), ''),
         manufacturer = nullif(btrim(coalesce(p_manufacturer, '')), ''),
         hsn_code     = nullif(btrim(coalesce(p_hsn_code, '')), ''),
         gst_rate     = p_gst_rate,
         schedule     = p_schedule::drug_schedule,
         mrp          = round(p_mrp, 2),
         reorder_level = p_reorder_level
   where id = p_id;

  -- RLS can silently hide the row from UPDATE; treat that as "not allowed"
  if not found then raise exception 'NOT_ALLOWED'; end if;
end $$;

revoke execute on function update_medicine(uuid, text, text, text, text, numeric, text, numeric, int) from public, anon;
grant  execute on function update_medicine(uuid, text, text, text, text, numeric, text, numeric, int) to authenticated;
