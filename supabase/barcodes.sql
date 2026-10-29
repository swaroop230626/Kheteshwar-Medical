-- Barcodes: scan a medicine box or a single strip. Run once in Supabase SQL Editor.
-- One medicine can have many barcodes (box, strip, different makers). Each barcode says:
--   kind  = 'single' (one strip/unit) or 'box' (a whole box)
--   units = how many sellable units one scan means (single = 1, box = units inside the box)
-- A barcode belongs to the company, so every branch uses the same one.

create table medicine_barcodes (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id),
  medicine_id  uuid not null references medicines(id),
  barcode      text not null check (length(barcode) between 1 and 100),
  kind         text not null check (kind in ('single', 'box')),
  units        integer not null default 1 check (units >= 1),
  created_by   uuid default auth.uid() references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (company_id, barcode)
);
create index idx_barcodes_medicine on medicine_barcodes (medicine_id);

create trigger trg_barcodes_updated_at before update on medicine_barcodes
  for each row execute function set_updated_at();
create trigger trg_barcodes_audit after insert or update or delete on medicine_barcodes
  for each row execute function audit_row();

alter table medicine_barcodes enable row level security;

create policy barcodes_select on medicine_barcodes for select to authenticated
  using (company_id = auth_company_id());
create policy barcodes_insert on medicine_barcodes for insert to authenticated
  with check (company_id = auth_company_id() and has_role('owner', 'branch_manager', 'store_keeper', 'billing_staff'));
-- a wrongly linked barcode can be removed by those who manage the medicine master
create policy barcodes_delete on medicine_barcodes for delete to authenticated
  using (company_id = auth_company_id() and has_role('owner', 'branch_manager', 'store_keeper'));

revoke all on medicine_barcodes from anon;
revoke update on medicine_barcodes from authenticated;

create or replace function link_barcode(p_medicine_id uuid, p_barcode text, p_kind text, p_units int) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_company uuid := auth_company_id();
  v_code    text := btrim(coalesce(p_barcode, ''));
  v_units   int  := p_units;
  v_name    text;
  v_id      uuid;
begin
  if v_company is null then raise exception 'NO_COMPANY'; end if;
  if v_code = '' or length(v_code) > 100 then raise exception 'INVALID_BARCODE'; end if;
  if p_kind is null or p_kind not in ('single', 'box') then raise exception 'INVALID_KIND'; end if;
  if p_kind = 'single' then v_units := 1; end if;
  if v_units is null or v_units < 1 then raise exception 'INVALID_UNITS'; end if;

  perform 1 from medicines m where m.id = p_medicine_id and m.company_id = v_company and m.deleted_at is null;
  if not found then raise exception 'MEDICINE_NOT_FOUND'; end if;

  select m.name into v_name
    from medicine_barcodes b join medicines m on m.id = b.medicine_id
   where b.company_id = v_company and b.barcode = v_code;
  if v_name is not null then raise exception 'BARCODE_EXISTS:%', v_name; end if;

  insert into medicine_barcodes (company_id, medicine_id, barcode, kind, units)
  values (v_company, p_medicine_id, v_code, p_kind, v_units)
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function link_barcode(uuid, text, text, int) from public, anon;
grant  execute on function link_barcode(uuid, text, text, int) to authenticated;
