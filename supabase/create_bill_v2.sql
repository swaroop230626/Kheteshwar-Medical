-- Billing v2: prescription details for Schedule H / H1 / X medicines.
-- Run once in Supabase SQL Editor AFTER schedule_register.sql.
-- It REPLACES create_bill (new last parameter p_rx). Everything else works exactly as before:
-- atomic, SECURITY INVOKER, totals computed here, bill_no / stock / credit handled by existing triggers.
--
-- p_rx (only needed when the cart has a Schedule H, H1 or X medicine), JSON object:
--   { "doctor_id": uuid | null, "doctor_name": text, "doctor_reg_no": text,
--     "patient_name": text, "patient_address": text, "patient_age": text }
-- Rules (confirm the exact legal requirement with your pharmacist / CA):
--   * H, H1, X : doctor name and patient name are required
--   * H1, X    : doctor registration number and patient address are also required
--   * One register row per scheduled bill item is written in the same transaction; a new doctor is added to the master.

drop function if exists create_bill(uuid, uuid, text, text, jsonb, jsonb);

create or replace function create_bill(
  p_branch              uuid,
  p_customer_id         uuid,
  p_new_customer_name   text,
  p_new_customer_phone  text,
  p_items               jsonb,
  p_payments            jsonb,
  p_rx                  jsonb default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_customer  uuid;
  v_cname     text;
  v_bill      uuid;
  v_no        text;
  v_taxable   numeric(12,2);
  v_cgst      numeric(12,2);
  v_sgst      numeric(12,2);
  v_total     numeric(12,2);
  v_paid      numeric(12,2);
  v_credit    numeric(12,2);
  v_want      int;
  v_have      int;
  it          record;
  -- prescription
  v_sched     int;
  v_strict    boolean;
  v_company   uuid;
  v_doc       uuid;
  v_doc_name  text;
  v_doc_reg   text;
  v_patient   text;
  v_addr      text;
  v_age       text;
begin
  -- ---- cart ----
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  if exists (select 1 from jsonb_array_elements(p_items) x
              where (x->>'batch_id') is null or coalesce((x->>'qty')::int, 0) <= 0) then
    raise exception 'INVALID_ITEM';
  end if;

  select count(distinct (x->>'batch_id')::uuid) into v_want from jsonb_array_elements(p_items) x;
  select count(*) into v_have from bill_lines(p_branch, p_items);
  if v_have <> v_want then
    raise exception 'BATCH_NOT_FOUND';
  end if;

  -- ---- expiry and stock ----
  for it in
    select l.medicine_name, l.qty, sb.batch_no, sb.expiry_date, sb.qty_on_hand
      from bill_lines(p_branch, p_items) l
      join stock_batches sb on sb.id = l.batch_id
  loop
    if it.expiry_date < current_date then
      raise exception 'EXPIRED_BATCH:%:%', it.medicine_name, it.batch_no;
    end if;
    if it.qty > it.qty_on_hand then
      raise exception 'INSUFFICIENT_STOCK:%:%', it.medicine_name, it.qty_on_hand;
    end if;
  end loop;

  -- ---- prescription (Schedule H / H1 / X) ----
  select count(*) filter (where m.schedule in ('H', 'H1', 'X')),
         coalesce(bool_or(m.schedule in ('H1', 'X')), false)
    into v_sched, v_strict
    from bill_lines(p_branch, p_items) l
    join medicines m on m.id = l.medicine_id;

  if v_sched > 0 then
    if p_rx is null or jsonb_typeof(p_rx) <> 'object' then
      raise exception 'RX_REQUIRED';
    end if;
    v_doc_name := btrim(coalesce(p_rx->>'doctor_name', ''));
    v_doc_reg  := nullif(btrim(coalesce(p_rx->>'doctor_reg_no', '')), '');
    v_patient  := btrim(coalesce(p_rx->>'patient_name', ''));
    v_addr     := nullif(btrim(coalesce(p_rx->>'patient_address', '')), '');
    v_age      := nullif(btrim(coalesce(p_rx->>'patient_age', '')), '');

    if coalesce(p_rx->>'doctor_id', '') <> '' then
      select d.id, d.name, d.registration_no into v_doc, v_doc_name, v_doc_reg
        from doctors d
       where d.id = (p_rx->>'doctor_id')::uuid and d.deleted_at is null;
      if v_doc is null then raise exception 'RX_DOCTOR'; end if;
    end if;

    if coalesce(v_doc_name, '') = '' then raise exception 'RX_DOCTOR'; end if;
    if v_patient = '' then raise exception 'RX_PATIENT'; end if;
    if v_strict and v_doc_reg is null then raise exception 'RX_REG_REQUIRED'; end if;
    if v_strict and v_addr is null then raise exception 'RX_ADDRESS_REQUIRED'; end if;
  end if;

  -- ---- totals ----
  select coalesce(sum(taxable), 0), coalesce(sum(cgst), 0), coalesce(sum(sgst), 0), coalesce(sum(line_total), 0)
    into v_taxable, v_cgst, v_sgst, v_total
    from bill_lines(p_branch, p_items);

  -- ---- payments ----
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'PAYMENT_MISMATCH:0:%', v_total;
  end if;
  if exists (select 1 from jsonb_array_elements(p_payments) x where coalesce((x->>'amount')::numeric, 0) <= 0) then
    raise exception 'INVALID_PAYMENT';
  end if;

  select coalesce(sum((x->>'amount')::numeric), 0),
         coalesce(sum((x->>'amount')::numeric) filter (where x->>'method' = 'credit'), 0)
    into v_paid, v_credit
    from jsonb_array_elements(p_payments) x;

  if v_paid <> v_total then
    raise exception 'PAYMENT_MISMATCH:%:%', v_paid, v_total;
  end if;

  -- ---- customer ----
  if p_customer_id is not null then
    select c.id, c.name into v_customer, v_cname
      from customers c
     where c.id = p_customer_id and c.branch_id = p_branch and c.deleted_at is null;
    if v_customer is null then
      raise exception 'CUSTOMER_NOT_FOUND';
    end if;
  elsif coalesce(btrim(p_new_customer_name), '') <> '' then
    insert into customers (branch_id, name, phone)
    values (p_branch, btrim(p_new_customer_name), nullif(btrim(coalesce(p_new_customer_phone, '')), ''))
    returning id, name into v_customer, v_cname;
  end if;

  if v_credit > 0 and v_customer is null then
    raise exception 'CREDIT_NEEDS_CUSTOMER';
  end if;

  -- ---- bill header ----
  insert into bills (branch_id, customer_id, customer_name, subtotal, discount_amount, taxable_amount,
                     cgst_amount, sgst_amount, igst_amount, round_off, total_amount)
  values (p_branch, v_customer, v_cname, v_taxable, 0, v_taxable, v_cgst, v_sgst, 0, 0, v_total)
  returning id, bill_no into v_bill, v_no;

  -- ---- items ----
  insert into bill_items (bill_id, branch_id, medicine_id, batch_id, medicine_name, hsn_code, qty, mrp,
                          discount_pct, gst_rate, taxable_amount, cgst_amount, sgst_amount, igst_amount, line_total)
  select v_bill, p_branch, l.medicine_id, l.batch_id, l.medicine_name, l.hsn_code, l.qty, l.mrp,
         0, l.gst_rate, l.taxable, l.cgst, l.sgst, 0, l.line_total
    from bill_lines(p_branch, p_items) l;

  -- ---- payments ----
  insert into bill_payments (bill_id, branch_id, method, amount, reference)
  select v_bill, p_branch, (x->>'method')::payment_method, (x->>'amount')::numeric, nullif(x->>'reference', '')
    from jsonb_array_elements(p_payments) x;

  -- ---- Schedule register + doctor master ----
  if v_sched > 0 then
    v_company := auth_company_id();
    if v_company is null then raise exception 'NO_COMPANY'; end if;

    if v_doc is null then
      if v_doc_reg is not null then
        select d.id into v_doc from doctors d
         where d.company_id = v_company and lower(d.registration_no) = lower(v_doc_reg) and d.deleted_at is null;
      end if;
      if v_doc is null then
        insert into doctors (company_id, name, registration_no)
        values (v_company, v_doc_name, v_doc_reg)
        returning id into v_doc;
      end if;
    end if;

    insert into schedule_register (branch_id, bill_id, bill_item_id, bill_no, medicine_id, medicine_name, schedule,
                                   batch_no, qty, doctor_id, doctor_name, doctor_reg_no,
                                   patient_name, patient_address, patient_age)
    select p_branch, v_bill, bi.id, v_no, bi.medicine_id, bi.medicine_name, m.schedule,
           sb.batch_no, bi.qty, v_doc, v_doc_name, v_doc_reg, v_patient, v_addr, v_age
      from bill_items bi
      join medicines m on m.id = bi.medicine_id
      join stock_batches sb on sb.id = bi.batch_id
     where bi.bill_id = v_bill and m.schedule in ('H', 'H1', 'X');
  end if;

  return jsonb_build_object(
    'bill_id', v_bill, 'bill_no', v_no, 'total', v_total,
    'taxable', v_taxable, 'gst', v_cgst + v_sgst
  );
end $$;

revoke execute on function create_bill(uuid, uuid, text, text, jsonb, jsonb, jsonb) from public, anon;
grant  execute on function create_bill(uuid, uuid, text, text, jsonb, jsonb, jsonb) to authenticated;
