create table if not exists public.admin_accounts (
  id uuid primary key default gen_random_uuid(),
  constituency_id text not null references public.constituencies(id) on delete restrict,
  display_name text,
  pin_hash text not null,
  theme_color text not null default '#0f766e',
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_accounts_pin_hash_not_blank check (length(trim(pin_hash)) > 0)
);

create unique index if not exists admin_accounts_active_constituency_idx
  on public.admin_accounts (constituency_id)
  where is_active = true;

alter table public.admin_accounts enable row level security;
