-- Purchases: atomic GRN save. Run once in Supabase SQL Editor.
-- One call = one transaction: if anything fails, nothing is saved.
-- security invoker => the caller's RLS policies still apply (owner / branch_manager / store_keeper only).
-- grn_no comes from the existing doc_counters trigger (e.g. KM01-GRN-000001).
-- Stock batches are created by the existing grn_items trigger.

create or replace function create_grn(
  p_branch       uuid,
  p_supplier     text,
  p_invoice_no   text,
  p_invoice_date date,
  p_items        jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_grn uuid;
  it    record;
begin
  if coalesce(btrim(p_supplier), '') = '' or coalesce(btrim(p_invoice_no), '') = '' or p_invoice_date is null then
    raise exception 'MISSING_HEADER';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'NO_ITEMS';
  end if;

  -- same medicine + batch twice in one form
  if exists (
    select 1 from jsonb_array_elements(p_items) x
     group by x->>'medicine_id', lower(btrim(x->>'batch_no'))
    having count(*) > 1
  ) then
    raise exception 'DUPLICATE_IN_FORM';
  end if;

  for it in
    select (x->>'medicine_id')::uuid   as medicine_id,
           btrim(x->>'batch_no')       as batch_no,
           (x->>'expiry_date')::date   as expiry_date,
           (x->>'qty')::int            as qty,
           (x->>'purchase_rate')::numeric as rate,
           (x->>'mrp')::numeric        as mrp,
           (x->>'gst_rate')::numeric   as gst_rate
      from jsonb_array_elements(p_items) x
  loop
    if it.medicine_id is null or it.batch_no is null or it.batch_no = ''
       or it.qty is null or it.qty <= 0
       or it.rate is null or it.rate < 0
       or it.mrp is null or it.mrp < 0
       or it.gst_rate is null or it.gst_rate not between 0 and 40 then
      raise exception 'INVALID_ITEM';
    end if;

    if it.expiry_date is null or it.expiry_date < current_date then
      raise exception 'EXPIRED';
    end if;

    if exists (
      select 1 from stock_batches sb
       where sb.branch_id = p_branch
         and sb.medicine_id = it.medicine_id
         and lower(sb.batch_no) = lower(it.batch_no)
    ) then
      raise exception 'BATCH_EXISTS:%', it.batch_no;
    end if;
  end loop;

  insert into grns (branch_id, supplier_name, invoice_no, invoice_date)
  values (p_branch, btrim(p_supplier), btrim(p_invoice_no), p_invoice_date)
  returning id into v_grn;

  insert into grn_items (grn_id, branch_id, medicine_id, batch_no, expiry_date, qty,
                         purchase_rate, mrp, gst_rate, discount_pct,
                         taxable_amount, gst_amount, line_total)
  select v_grn, p_branch, t.medicine_id, t.batch_no, t.expiry_date, t.qty,
         t.rate, t.mrp, t.gst_rate, 0,
         t.taxable, t.gst, t.taxable + t.gst
    from (
      select p.*,
             round(p.qty * p.rate, 2)                                as taxable,
             round(round(p.qty * p.rate, 2) * p.gst_rate / 100, 2)   as gst
        from (
          select (x->>'medicine_id')::uuid   as medicine_id,
                 btrim(x->>'batch_no')       as batch_no,
                 (x->>'expiry_date')::date   as expiry_date,
                 (x->>'qty')::int            as qty,
                 (x->>'purchase_rate')::numeric as rate,
                 (x->>'mrp')::numeric        as mrp,
                 (x->>'gst_rate')::numeric   as gst_rate
            from jsonb_array_elements(p_items) x
        ) p
    ) t;

  update grns g
     set subtotal     = s.taxable,
         gst_amount   = s.gst,
         total_amount = s.total
    from (select coalesce(sum(taxable_amount), 0) as taxable,
                 coalesce(sum(gst_amount), 0)     as gst,
                 coalesce(sum(line_total), 0)     as total
            from grn_items where grn_id = v_grn) s
   where g.id = v_grn;

  return v_grn;
end $$;

revoke execute on function create_grn(uuid, text, text, date, jsonb) from public, anon;
grant  execute on function create_grn(uuid, text, text, date, jsonb) to authenticated;
