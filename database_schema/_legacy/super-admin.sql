alter table public.admin_accounts
  alter column constituency_id drop not null;

alter table public.admin_accounts
  add column if not exists role text not null default 'constituency_admin';

alter table public.admin_accounts
  drop constraint if exists admin_accounts_role_check;

alter table public.admin_accounts
  add constraint admin_accounts_role_check
  check (role in ('constituency_admin', 'super_admin'));

alter table public.admin_accounts
  drop constraint if exists admin_accounts_scope_check;

alter table public.admin_accounts
  add constraint admin_accounts_scope_check
  check (
    (role = 'super_admin' and constituency_id is null)
    or (role = 'constituency_admin' and constituency_id is not null)
  );

drop index if exists public.admin_accounts_active_constituency_idx;

create unique index if not exists admin_accounts_active_constituency_idx
  on public.admin_accounts (constituency_id)
  where is_active = true and role = 'constituency_admin';

create unique index if not exists admin_accounts_active_super_admin_idx
  on public.admin_accounts (role)
  where is_active = true and role = 'super_admin';
