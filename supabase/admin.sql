-- Admin: branches and staff status. Run once in Supabase SQL Editor.
-- SECURITY INVOKER: RLS applies; on top of that only an OWNER may use these.
-- company_id always comes from the caller's profile (auth_company_id()), never from the browser.
-- (Creating a staff LOGIN is done by the Edge Function in supabase/functions/create-staff.)

create or replace function create_branch(
  p_name            text,
  p_bill_prefix     text,
  p_gst_no          text,
  p_drug_licence_no text,
  p_address         text,
  p_phone           text
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_company uuid := auth_company_id();
  v_prefix  text := upper(btrim(coalesce(p_bill_prefix, '')));
  v_id      uuid;
begin
  if v_company is null then raise exception 'NO_COMPANY'; end if;
  if not has_role('owner') then raise exception 'NOT_ALLOWED'; end if;
  if btrim(coalesce(p_name, '')) = '' then raise exception 'INVALID_NAME'; end if;
  if v_prefix !~ '^[A-Z0-9]{1,8}$' then raise exception 'INVALID_PREFIX'; end if;
  if exists (select 1 from branches b where b.company_id = v_company and b.bill_prefix = v_prefix) then
    raise exception 'PREFIX_EXISTS';
  end if;

  insert into branches (company_id, name, gst_no, drug_licence_no, address, phone, bill_prefix)
  values (v_company, btrim(p_name),
          nullif(btrim(coalesce(p_gst_no, '')), ''),
          nullif(btrim(coalesce(p_drug_licence_no, '')), ''),
          nullif(btrim(coalesce(p_address, '')), ''),
          nullif(btrim(coalesce(p_phone, '')), ''),
          v_prefix)
  returning id into v_id;
  return v_id;
end $$;

-- The bill prefix cannot be changed after creation (it is part of every invoice number).
create or replace function update_branch(
  p_id              uuid,
  p_name            text,
  p_gst_no          text,
  p_drug_licence_no text,
  p_address         text,
  p_phone           text
) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if not has_role('owner') then raise exception 'NOT_ALLOWED'; end if;
  if btrim(coalesce(p_name, '')) = '' then raise exception 'INVALID_NAME'; end if;

  update branches
     set name = btrim(p_name),
         gst_no = nullif(btrim(coalesce(p_gst_no, '')), ''),
         drug_licence_no = nullif(btrim(coalesce(p_drug_licence_no, '')), ''),
         address = nullif(btrim(coalesce(p_address, '')), ''),
         phone = nullif(btrim(coalesce(p_phone, '')), '')
   where id = p_id and company_id = auth_company_id();
  if not found then raise exception 'NOT_ALLOWED'; end if;
end $$;

-- Switch a staff member on/off (an off user cannot use the app). Owners cannot switch themselves off.
create or replace function set_staff_active(p_id uuid, p_active boolean) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if not has_role('owner') then raise exception 'NOT_ALLOWED'; end if;
  if p_id = auth.uid() then raise exception 'CANNOT_SELF'; end if;
  update profiles set is_active = p_active where id = p_id and company_id = auth_company_id();
  if not found then raise exception 'NOT_ALLOWED'; end if;
end $$;

revoke execute on function create_branch(text, text, text, text, text, text) from public, anon;
revoke execute on function update_branch(uuid, text, text, text, text, text) from public, anon;
revoke execute on function set_staff_active(uuid, boolean) from public, anon;
grant  execute on function create_branch(text, text, text, text, text, text) to authenticated;
grant  execute on function update_branch(uuid, text, text, text, text, text) to authenticated;
grant  execute on function set_staff_active(uuid, boolean) to authenticated;
