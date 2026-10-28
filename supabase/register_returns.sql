-- Returns in the Schedule register. Run once in Supabase SQL Editor (after schedule_register.sql).
-- Every time a Schedule H / H1 / X item is returned, a "return" line is added to the register
-- automatically (a trigger on sales_return_items), copying the doctor and patient of the original sale.
-- Register lines are never edited: a sale stays, and the return appears as its own line.
-- Sales made before the register existed have no register line, so their returns get none either.

alter table schedule_register add column entry_type     text not null default 'sale'
  check (entry_type in ('sale', 'return'));
alter table schedule_register add column return_id      uuid references sales_returns(id);
alter table schedule_register add column return_no      text;
alter table schedule_register add column return_item_id uuid unique;
alter table schedule_register add constraint chk_register_return
  check ((entry_type = 'sale' and return_id is null) or (entry_type = 'return' and return_id is not null));

-- one SALE line per bill item (several RETURN lines are allowed)
alter table schedule_register drop constraint if exists schedule_register_bill_item_id_key;
create unique index uq_register_sale_item on schedule_register (bill_item_id) where entry_type = 'sale';
create index idx_register_return on schedule_register (return_id);

-- security definer: a store keeper may do returns but may not write the register directly
create or replace function register_return_line() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into schedule_register (
    branch_id, bill_id, bill_item_id, bill_no, sale_date, medicine_id, medicine_name, schedule, batch_no, qty,
    doctor_id, doctor_name, doctor_reg_no, patient_name, patient_address, patient_age,
    entry_type, return_id, return_no, return_item_id)
  select s.branch_id, s.bill_id, s.bill_item_id, s.bill_no, now(), s.medicine_id, s.medicine_name, s.schedule, s.batch_no, new.qty,
         s.doctor_id, s.doctor_name, s.doctor_reg_no, s.patient_name, s.patient_address, s.patient_age,
         'return', new.return_id, (select sr.return_no from sales_returns sr where sr.id = new.return_id), new.id
    from schedule_register s
   where s.bill_item_id = new.bill_item_id and s.entry_type = 'sale';
  return new;
end $$;

create trigger trg_return_register after insert on sales_return_items
  for each row execute function register_return_line();
