-- Reports: daily sales and GST summary. Run once in Supabase SQL Editor.
-- Read-only, SECURITY INVOKER (caller's RLS applies: only the caller's branch).
-- Dates are India time (Asia/Kolkata), so a bill made at 11 pm stays on that day.
-- Cancelled (deleted) bills are never counted. Returns are shown separately and subtracted.

create or replace function report_daily_sales(p_branch uuid, p_from date, p_to date)
returns table (
  sale_date date, bill_count int, sales_total numeric, returns_total numeric, net_total numeric,
  cash_total numeric, upi_total numeric, card_total numeric, credit_total numeric
)
language sql stable security invoker set search_path = public as $$
  with b as (
    select (bl.bill_date at time zone 'Asia/Kolkata')::date as d, bl.id, bl.total_amount
      from bills bl
     where bl.branch_id = p_branch and bl.deleted_at is null
       and (bl.bill_date at time zone 'Asia/Kolkata')::date between p_from and p_to
  ),
  s as (select b.d, count(*)::int as cnt, sum(b.total_amount) as amt from b group by b.d),
  p as (
    select b.d,
           sum(bp.amount) filter (where bp.method = 'cash')   as cash_amt,
           sum(bp.amount) filter (where bp.method = 'upi')    as upi_amt,
           sum(bp.amount) filter (where bp.method = 'card')   as card_amt,
           sum(bp.amount) filter (where bp.method = 'credit') as credit_amt
      from b join bill_payments bp on bp.bill_id = b.id
     group by b.d
  ),
  r as (
    select (sr.return_date at time zone 'Asia/Kolkata')::date as d, sum(sr.total_amount) as amt
      from sales_returns sr
     where sr.branch_id = p_branch
       and (sr.return_date at time zone 'Asia/Kolkata')::date between p_from and p_to
     group by 1
  ),
  days as (select s.d from s union select r.d from r)
  select days.d,
         coalesce(s.cnt, 0),
         coalesce(s.amt, 0),
         coalesce(r.amt, 0),
         coalesce(s.amt, 0) - coalesce(r.amt, 0),
         coalesce(p.cash_amt, 0), coalesce(p.upi_amt, 0), coalesce(p.card_amt, 0), coalesce(p.credit_amt, 0)
    from days
    left join s on s.d = days.d
    left join p on p.d = days.d
    left join r on r.d = days.d
   order by days.d desc
$$;

-- One row per GST rate for sales and one per rate for returns ("kind"); the app shows net = sales - returns.
create or replace function report_gst_summary(p_branch uuid, p_from date, p_to date)
returns table (
  kind text, gst_rate numeric, taxable numeric, cgst numeric, sgst numeric, igst numeric, total numeric
)
language sql stable security invoker set search_path = public as $$
  select 'sales'::text, bi.gst_rate,
         sum(bi.taxable_amount), sum(bi.cgst_amount), sum(bi.sgst_amount), sum(bi.igst_amount), sum(bi.line_total)
    from bill_items bi
    join bills bl on bl.id = bi.bill_id
   where bl.branch_id = p_branch and bl.deleted_at is null
     and (bl.bill_date at time zone 'Asia/Kolkata')::date between p_from and p_to
   group by bi.gst_rate
  union all
  select 'returns'::text, sri.gst_rate,
         sum(sri.taxable_amount), sum(sri.cgst_amount), sum(sri.sgst_amount), sum(sri.igst_amount), sum(sri.line_total)
    from sales_return_items sri
    join sales_returns sr on sr.id = sri.return_id
   where sr.branch_id = p_branch
     and (sr.return_date at time zone 'Asia/Kolkata')::date between p_from and p_to
   group by sri.gst_rate
  order by 2, 1
$$;

revoke execute on function report_daily_sales(uuid, date, date) from public, anon;
revoke execute on function report_gst_summary(uuid, date, date) from public, anon;
grant  execute on function report_daily_sales(uuid, date, date) to authenticated;
grant  execute on function report_gst_summary(uuid, date, date) to authenticated;
