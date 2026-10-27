-- Sales return: atomic save. Run once in Supabase SQL Editor (after create_bill.sql).
-- One call = one transaction; any error rolls everything back. SECURITY INVOKER: caller's RLS applies
-- (owner / branch_manager / billing_staff / store_keeper, own branch only).
--
-- Already done by existing triggers, so NOT repeated here:
--   * return_no            <- doc_counters (e.g. KM01-SR-000001), sequential, never reused
--   * stock back to batch  <- sales_return_items trigger adds qty to the SAME batch that was sold,
--                             and rejects returns above (sold qty - already returned)
--   * credit refund        <- sales_returns trigger writes a credit_ledger entry (return_adjustment),
--                             which reduces customers.balance
--
-- DECISION (refund rule): refund = (return qty / sold qty) x the bill line's amounts (GST included).
--   The last return of a line takes exactly what is left, so the paise always add up.
--   p_refund_method:
--     'cash' (or upi/card) -> money handed back, customer balance is NOT touched
--     'credit'             -> refund is deducted from the customer's outstanding balance;
--                             needs a customer on the bill and refund <= current balance

create or replace function return_lines(p_bill uuid, p_items jsonb)
returns table (
  bill_item_id uuid, medicine_name text, qty int, billed int, returned int,
  rate numeric, gst_rate numeric,
  taxable numeric, cgst numeric, sgst numeric, igst numeric, line_total numeric
)
language sql stable security invoker set search_path = public as $$
  select t.bill_item_id, t.medicine_name, t.qty, t.billed, t.returned, t.rate, t.gst_rate,
         t.taxable, t.cgst, t.sgst, t.igst, t.taxable + t.cgst + t.sgst + t.igst
    from (
      select s.bill_item_id, bi.medicine_name, s.qty, bi.qty as billed,
             coalesce(r.qty, 0)::int as returned, bi.mrp as rate, bi.gst_rate,
             case when coalesce(r.qty, 0) + s.qty = bi.qty
                  then bi.taxable_amount - coalesce(r.taxable, 0)
                  else round(bi.taxable_amount * s.qty / bi.qty, 2) end as taxable,
             case when coalesce(r.qty, 0) + s.qty = bi.qty
                  then bi.cgst_amount - coalesce(r.cgst, 0)
                  else round(bi.cgst_amount * s.qty / bi.qty, 2) end as cgst,
             case when coalesce(r.qty, 0) + s.qty = bi.qty
                  then bi.sgst_amount - coalesce(r.sgst, 0)
                  else round(bi.sgst_amount * s.qty / bi.qty, 2) end as sgst,
             case when coalesce(r.qty, 0) + s.qty = bi.qty
                  then bi.igst_amount - coalesce(r.igst, 0)
                  else round(bi.igst_amount * s.qty / bi.qty, 2) end as igst
        from (
          select (x->>'bill_item_id')::uuid as bill_item_id, sum((x->>'qty')::int)::int as qty
            from jsonb_array_elements(p_items) x
           group by 1
        ) s
        join bill_items bi on bi.id = s.bill_item_id and bi.bill_id = p_bill
        left join lateral (
          select sum(sri.qty) as qty, sum(sri.taxable_amount) as taxable, sum(sri.cgst_amount) as cgst,
                 sum(sri.sgst_amount) as sgst, sum(sri.igst_amount) as igst
            from sales_return_items sri
           where sri.bill_item_id = bi.id
        ) r on true
    ) t
$$;

create or replace function create_sales_return(
  p_bill_id       uuid,
  p_items         jsonb,
  p_refund_method text,
  p_reason        text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  b         bills;
  v_total   numeric(12,2);
  v_balance numeric(12,2);
  v_ret     uuid;
  v_no      text;
  v_want    int;
  v_have    int;
  it        record;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_RETURN';
  end if;
  if p_refund_method is null or p_refund_method not in ('cash', 'upi', 'card', 'credit') then
    raise exception 'INVALID_METHOD';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) x
              where (x->>'bill_item_id') is null or coalesce((x->>'qty')::int, 0) <= 0) then
    raise exception 'INVALID_QTY';
  end if;

  -- bill must be visible to the caller (RLS = own branch), and not deleted
  select * into b from bills where id = p_bill_id;
  if not found then raise exception 'BILL_NOT_FOUND'; end if;
  if b.deleted_at is not null then raise exception 'BILL_DELETED'; end if;

  -- every item must belong to this bill
  select count(distinct (x->>'bill_item_id')::uuid) into v_want from jsonb_array_elements(p_items) x;
  select count(*) into v_have from return_lines(p_bill_id, p_items);
  if v_have <> v_want then raise exception 'ITEM_NOT_IN_BILL'; end if;

  -- qty <= sold qty - already returned
  for it in select * from return_lines(p_bill_id, p_items) loop
    if it.qty > it.billed - it.returned then
      raise exception 'RETURN_EXCEEDS:%:%', it.medicine_name, it.billed - it.returned;
    end if;
  end loop;

  select coalesce(sum(line_total), 0) into v_total from return_lines(p_bill_id, p_items);

  if p_refund_method = 'credit' then
    if b.customer_id is null then raise exception 'CREDIT_NEEDS_CUSTOMER'; end if;
    select balance into v_balance from customers where id = b.customer_id;
    if v_balance is null then raise exception 'CUSTOMER_NOT_FOUND'; end if;
    if v_total > v_balance then raise exception 'REFUND_EXCEEDS_BALANCE:%', v_balance; end if;
  end if;

  -- header (return_no from trigger; credit refund -> ledger trigger)
  insert into sales_returns (branch_id, bill_id, reason, refund_method, total_amount)
  values (b.branch_id, b.id, nullif(btrim(coalesce(p_reason, '')), ''), p_refund_method::payment_method, v_total)
  returning id, return_no into v_ret, v_no;

  -- items (trigger puts stock back into the sold batch; medicine_id / batch_id are filled by the trigger)
  insert into sales_return_items (return_id, branch_id, bill_item_id, qty, rate, gst_rate,
                                  taxable_amount, cgst_amount, sgst_amount, igst_amount, line_total)
  select v_ret, b.branch_id, l.bill_item_id, l.qty, l.rate, l.gst_rate,
         l.taxable, l.cgst, l.sgst, l.igst, l.line_total
    from return_lines(p_bill_id, p_items) l;

  return jsonb_build_object('return_id', v_ret, 'return_no', v_no, 'total', v_total, 'refund_method', p_refund_method);
end $$;

revoke execute on function return_lines(uuid, jsonb) from public, anon;
revoke execute on function create_sales_return(uuid, jsonb, text, text) from public, anon;
grant  execute on function return_lines(uuid, jsonb) to authenticated;
grant  execute on function create_sales_return(uuid, jsonb, text, text) to authenticated;
