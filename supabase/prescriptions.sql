-- Prescription photos. Run once in Supabase SQL Editor (after schedule_register.sql).
-- Photos go to a PRIVATE storage bucket; a table row links every photo to its bill.
-- Path rule: <branch_id>/<bill_id>/<file>. Access follows the branch rules:
--   owner = all branches of the company, everyone else = own branch only.
--   Upload: owner / branch_manager / billing_staff. View: anyone allowed in that branch.
--   Photos cannot be edited or deleted from the app.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prescriptions', 'prescriptions', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create table prescription_files (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null,
  bill_id       uuid not null,
  storage_path  text not null unique,
  file_name     text,
  size_bytes    integer,
  created_by    uuid default auth.uid() references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (bill_id, branch_id) references bills(id, branch_id),
  check (storage_path like (branch_id::text || '/' || bill_id::text || '/%'))
);
create index idx_rxfiles_bill   on prescription_files (bill_id);
create index idx_rxfiles_branch on prescription_files (branch_id);

create trigger trg_rxfiles_audit after insert or update or delete on prescription_files
  for each row execute function audit_row();

alter table prescription_files enable row level security;

create policy rxfiles_select on prescription_files for select to authenticated
  using (can_access_branch(branch_id));
create policy rxfiles_insert on prescription_files for insert to authenticated
  with check (can_access_branch(branch_id) and has_role('owner', 'branch_manager', 'billing_staff'));

revoke all on prescription_files from anon;
revoke update, delete on prescription_files from authenticated;

-- Storage rules: the first folder of the path must be a branch the user may access.
create policy "prescriptions_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'prescriptions'
    and case when (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
         then public.can_access_branch(((storage.foldername(name))[1])::uuid)
         else false end
    and public.has_role('owner', 'branch_manager', 'billing_staff')
  );

create policy "prescriptions_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'prescriptions'
    and case when (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
         then public.can_access_branch(((storage.foldername(name))[1])::uuid)
         else false end
  );
