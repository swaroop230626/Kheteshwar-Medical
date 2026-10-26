-- Billing (POS): atomic bill save. Run once in Supabase SQL Editor (after create_grn.sql).
-- One call = one transaction. Any error rolls everything back.
--
-- SECURITY INVOKER: the caller's RLS applies (owner / branch_manager / billing_staff can bill their branch).
-- Already handled by existing triggers, so NOT repeated here:
--   * bill_no           <- doc_counters (next_doc_number), sequential per branch, never reused
--   * stock decrement   <- bill_items trigger (locks batch row, blocks expired batch, blocks negative stock)
--   * credit sale       <- bill_payments trigger writes credit_ledger; ledger trigger checks credit_limit
--                          and updates customers.balance (balance cannot be edited directly)
--
-- Money rule used here (same as the Excel sheet): GST is ADDED on top of MRP x qty.
--   taxable = round(mrp * qty, 2); gst = round(taxable * gst_rate / 100, 2)
--   cgst = round(gst / 2, 2); sgst = gst - cgst; line_total = taxable + gst
-- MRP, GST rate, medicine name and HSN come from the database, never from the browser.

create or replace function bill_lines(p_branch uuid, p_items jsonb)
returns table (
  batch_id uuid, medicine_id uuid, medicine_name text, hsn_code text,
  qty int, mrp numeric, gst_rate numeric,
  taxable numeric, cgst numeric, sgst numeric, line_total numeric
)
language sql stable security invoker set search_path = public as $$
  select c.batch_id, c.medicine_id, c.name, c.hsn_code, c.qty, c.mrp, c.gst_rate,
         c.taxable, c.cgst, c.gst - c.cgst, c.taxable + c.gst
    from (
      select sb.id as batch_id, sb.medicine_id, m.name, m.hsn_code, s.qty, sb.mrp, m.gst_rate,
             round(s.qty * sb.mrp, 2) as taxable,
             round(round(s.qty * sb.mrp, 2) * m.gst_rate / 100, 2) as gst,
             round(round(round(s.qty * sb.mrp, 2) * m.gst_rate / 100, 2) / 2, 2) as cgst
        from (
          select (x->>'batch_id')::uuid as batch_id, sum((x->>'qty')::int)::int as qty
            from jsonb_array_elements(p_items) x
           group by 1
        ) s
        join stock_batches sb on sb.id = s.batch_id and sb.branch_id = p_branch
        join medicines m on m.id = sb.medicine_id
    ) c
$$;

create or replace function create_bill(
  p_branch              uuid,
  p_customer_id         uuid,
  p_new_customer_name   text,
  p_new_customer_phone  text,
  p_items               jsonb,
  p_payments            jsonb
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

  -- ---- expiry and stock (friendly errors; the stock trigger enforces again with a row lock) ----
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

  -- ---- totals (computed here, not trusted from the browser) ----
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

  -- ---- customer: existing, new (created in the same transaction), or walk-in ----
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

  -- ---- bill header (bill_no is filled by trigger from doc_counters) ----
  insert into bills (branch_id, customer_id, customer_name, subtotal, discount_amount, taxable_amount,
                     cgst_amount, sgst_amount, igst_amount, round_off, total_amount)
  values (p_branch, v_customer, v_cname, v_taxable, 0, v_taxable, v_cgst, v_sgst, 0, 0, v_total)
  returning id, bill_no into v_bill, v_no;

  -- ---- items (stock trigger reduces stock) ----
  insert into bill_items (bill_id, branch_id, medicine_id, batch_id, medicine_name, hsn_code, qty, mrp,
                          discount_pct, gst_rate, taxable_amount, cgst_amount, sgst_amount, igst_amount, line_total)
  select v_bill, p_branch, l.medicine_id, l.batch_id, l.medicine_name, l.hsn_code, l.qty, l.mrp,
         0, l.gst_rate, l.taxable, l.cgst, l.sgst, 0, l.line_total
    from bill_lines(p_branch, p_items) l;

  -- ---- payments (credit payment trigger writes the ledger and updates customer balance) ----
  insert into bill_payments (bill_id, branch_id, method, amount, reference)
  select v_bill, p_branch, (x->>'method')::payment_method, (x->>'amount')::numeric, nullif(x->>'reference', '')
    from jsonb_array_elements(p_payments) x;

  return jsonb_build_object(
    'bill_id', v_bill, 'bill_no', v_no, 'total', v_total,
    'taxable', v_taxable, 'gst', v_cgst + v_sgst
  );
end $$;

revoke execute on function bill_lines(uuid, jsonb) from public, anon;
revoke execute on function create_bill(uuid, uuid, text, text, jsonb, jsonb) from public, anon;
grant  execute on function bill_lines(uuid, jsonb) to authenticated;
grant  execute on function create_bill(uuid, uuid, text, text, jsonb, jsonb) to authenticated;
