-- Doctors master + Schedule H / H1 / X register. Run once in Supabase SQL Editor
-- (before create_bill_v2.sql).
-- The register is written by create_bill (same transaction as the bill) and can NEVER be edited or deleted.
-- Which fields are legally required, and the exact register format, must be confirmed with your pharmacist / CA.

create table doctors (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies(id),
  name             text not null,
  registration_no  text,
  phone            text,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index uq_doctors_reg on doctors (company_id, lower(registration_no))
  where registration_no is not null and deleted_at is null;
create index idx_doctors_company on doctors (company_id) where deleted_at is null;

create table schedule_register (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid not null references branches(id),
  bill_id          uuid not null,
  bill_item_id     uuid not null unique,
  bill_no          text,
  sale_date        timestamptz not null default now(),
  medicine_id      uuid not null references medicines(id),
  medicine_name    text not null,
  schedule         drug_schedule not null,
  batch_no         text,
  qty              integer not null check (qty > 0),
  doctor_id        uuid references doctors(id),
  doctor_name      text not null,
  doctor_reg_no    text,
  patient_name     text not null,
  patient_address  text,
  patient_age      text,
  created_by       uuid default auth.uid() references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (bill_id, branch_id) references bills(id, branch_id)
);
create index idx_register_branch_date on schedule_register (branch_id, sale_date desc);
create index idx_register_medicine    on schedule_register (medicine_id);
create index idx_register_schedule    on schedule_register (schedule);

create trigger trg_doctors_updated_at before update on doctors
  for each row execute function set_updated_at();
create trigger trg_doctors_audit after insert or update or delete on doctors
  for each row execute function audit_row();
create trigger trg_register_audit after insert or update or delete on schedule_register
  for each row execute function audit_row();

alter table doctors           enable row level security;
alter table schedule_register enable row level security;

create policy doctors_select on doctors for select to authenticated
  using (company_id = auth_company_id());
create policy doctors_insert on doctors for insert to authenticated
  with check (company_id = auth_company_id() and has_role('owner', 'branch_manager', 'billing_staff'));
create policy doctors_update on doctors for update to authenticated
  using (company_id = auth_company_id() and has_role('owner', 'branch_manager', 'billing_staff'))
  with check (company_id = auth_company_id());

create policy register_select on schedule_register for select to authenticated
  using (can_access_branch(branch_id));
create policy register_insert on schedule_register for insert to authenticated
  with check (can_access_branch(branch_id) and has_role('owner', 'branch_manager', 'billing_staff'));

revoke all on doctors, schedule_register from anon;
revoke delete on doctors, schedule_register from authenticated;
revoke update on schedule_register from authenticated;

-- Add a doctor to the master (company comes from the caller's profile)
create or replace function create_doctor(p_name text, p_registration_no text, p_phone text) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_company uuid := auth_company_id();
  v_id uuid;
begin
  if v_company is null then raise exception 'NO_COMPANY'; end if;
  if btrim(coalesce(p_name, '')) = '' then raise exception 'INVALID_NAME'; end if;
  insert into doctors (company_id, name, registration_no, phone)
  values (v_company, btrim(p_name),
          nullif(btrim(coalesce(p_registration_no, '')), ''),
          nullif(btrim(coalesce(p_phone, '')), ''))
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function create_doctor(text, text, text) from public, anon;
grant  execute on function create_doctor(text, text, text) to authenticated;
