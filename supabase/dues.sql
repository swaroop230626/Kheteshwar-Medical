-- Dues (baki list) + reminder log. Run once in Supabase SQL Editor.
-- 1) due_reminders: a note every time you send a reminder (so the same customer is not nagged daily).
-- 2) report_dues(branch): who owes money, how many days it has been due, and when you last reminded.
--
-- "Days due" = days since the OLDEST part of the credit that is still unpaid. Payments are counted against
-- the oldest credit first (FIFO). If the ledger has no entry for an old balance, the date of the customer's
-- first credit bill is used (or the day the customer was added).
-- Read-only function, SECURITY INVOKER (RLS applies). Dates are India time.

create table due_reminders (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid not null,
  customer_id  uuid not null,
  channel      text not null default 'whatsapp' check (channel in ('whatsapp', 'sms', 'call', 'other')),
  amount       numeric(12,2) not null check (amount >= 0),   -- balance at the time of the reminder
  sent_at      timestamptz not null default now(),
  created_by   uuid default auth.uid() references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (customer_id, branch_id) references customers(id, branch_id)
);
create index idx_reminders_customer on due_reminders (customer_id, sent_at desc);
create index idx_reminders_branch   on due_reminders (branch_id);

alter table due_reminders enable row level security;

create policy reminders_select on due_reminders for select to authenticated
  using (can_access_branch(branch_id));
create policy reminders_insert on due_reminders for insert to authenticated
  with check (can_access_branch(branch_id) and has_role('owner', 'branch_manager', 'billing_staff', 'accountant'));

revoke all on due_reminders from anon;
revoke update, delete on due_reminders from authenticated;

create or replace function report_dues(p_branch uuid)
returns table (
  customer_id uuid, customer_name text, phone text, balance numeric,
  oldest_due date, days_overdue int, last_reminded_at timestamptz
)
language sql stable security invoker set search_path = public as $$
  with debits as (
    select l.customer_id as cid, l.entry_date as dt,
           sum(l.debit) over (partition by l.customer_id order by l.entry_date, l.id) as cum
      from credit_ledger l
     where l.debit > 0 and l.branch_id = p_branch
  ),
  paid as (
    select l.customer_id as cid, sum(l.credit) as amt
      from credit_ledger l
     where l.credit > 0 and l.branch_id = p_branch
     group by l.customer_id
  ),
  due as (
    select cu.id as cid, cu.name as cname, cu.phone as cphone, cu.balance as cbal,
           coalesce(
             (select min((d.dt at time zone 'Asia/Kolkata')::date)
                from debits d where d.cid = cu.id and d.cum > coalesce(p.amt, 0)),
             (select min((bl.bill_date at time zone 'Asia/Kolkata')::date)
                from bills bl join bill_payments bp on bp.bill_id = bl.id
               where bl.customer_id = cu.id and bp.method = 'credit' and bl.deleted_at is null),
             (cu.created_at at time zone 'Asia/Kolkata')::date
           ) as oldest
      from customers cu
      left join paid p on p.cid = cu.id
     where cu.branch_id = p_branch and cu.deleted_at is null and cu.balance > 0
  )
  select due.cid, due.cname, due.cphone, due.cbal, due.oldest,
         ((now() at time zone 'Asia/Kolkata')::date - due.oldest)::int,
         (select max(r.sent_at) from due_reminders r where r.customer_id = due.cid)
    from due
   order by 6 desc, due.cbal desc
$$;

revoke execute on function report_dues(uuid) from public, anon;
grant  execute on function report_dues(uuid) to authenticated;
