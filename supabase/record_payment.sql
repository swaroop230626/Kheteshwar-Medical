-- Customers: record a payment received (receipt). Run once in Supabase SQL Editor.
-- One call = one transaction. SECURITY INVOKER: the caller's RLS applies
-- (customer must be visible to the caller; ledger insert allowed for owner / branch_manager / billing_staff / accountant).
--
-- What happens (using the existing triggers, nothing duplicated):
--   * a credit_ledger row (entry_type 'receipt', credit = amount) is inserted
--   * receipt_no is assigned from doc_counters (e.g. KM01-RC-000001)
--   * customers.balance is reduced by the ledger trigger (balance cannot be edited directly)

-- 1) Make the ledger trigger refuse a receipt larger than the balance.
--    Runs under the customer row lock, so two payments at the same moment cannot overpay.
create or replace function ledger_check_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare c customers;
begin
  select * into c from customers where id = new.customer_id and branch_id = new.branch_id for update;
  if not found then raise exception 'Customer not found in this branch'; end if;

  if new.entry_type = 'credit_sale' and c.balance + new.debit > c.credit_limit then
    raise exception 'Credit limit exceeded (limit %, balance %, new %)', c.credit_limit, c.balance, new.debit;
  end if;

  if new.entry_type = 'receipt' and new.credit > c.balance then
    raise exception 'OVERPAYMENT:%', c.balance;
  end if;
  return new;
end $$;

-- 2) The payment function.
create or replace function record_payment(
  p_customer_id uuid,
  p_amount      numeric,
  p_mode        text,
  p_note        text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  c         customers;
  v_amount  numeric(12,2);
  v_receipt text;
  v_balance numeric(12,2);
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;
  if p_mode is null or p_mode not in ('cash', 'upi', 'card') then
    raise exception 'INVALID_MODE';
  end if;
  v_amount := round(p_amount, 2);

  select * into c from customers where id = p_customer_id and deleted_at is null;
  if not found then
    raise exception 'CUSTOMER_NOT_FOUND';
  end if;

  if v_amount > c.balance then
    raise exception 'OVERPAYMENT:%', c.balance;
  end if;

  insert into credit_ledger (branch_id, customer_id, entry_type, credit, payment_method, note)
  values (c.branch_id, c.id, 'receipt', v_amount, p_mode::payment_method,
          nullif(btrim(coalesce(p_note, '')), ''))
  returning receipt_no into v_receipt;

  select balance into v_balance from customers where id = c.id;

  return jsonb_build_object('receipt_no', v_receipt, 'balance', v_balance);
end $$;

revoke execute on function record_payment(uuid, numeric, text, text) from public, anon;
grant  execute on function record_payment(uuid, numeric, text, text) to authenticated;
