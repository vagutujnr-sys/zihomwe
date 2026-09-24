-- Admin accounts: constituency_admin (scoped) or super_admin (global)

create table if not exists public.admin_accounts (
  id uuid primary key default gen_random_uuid(),
  constituency_id text references public.constituencies(id) on delete restrict,
  display_name text,
  pin_hash text not null,
  theme_color text not null default '#0f766e',
  is_active boolean not null default true,
  last_login_at timestamptz,
  role text not null default 'constituency_admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_accounts_pin_hash_not_blank
    check (length(trim(pin_hash)) > 0),
  constraint admin_accounts_role_check
    check (role in ('constituency_admin', 'super_admin')),
  constraint admin_accounts_scope_check
    check (
      (role = 'super_admin' and constituency_id is null)
      or (role = 'constituency_admin' and constituency_id is not null)
    )
);

create unique index if not exists admin_accounts_active_constituency_idx
  on public.admin_accounts (constituency_id)
  where is_active = true and role = 'constituency_admin';

create unique index if not exists admin_accounts_active_super_admin_idx
  on public.admin_accounts (role)
  where is_active = true and role = 'super_admin';
