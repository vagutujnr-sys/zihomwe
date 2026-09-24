-- Run this once in the Supabase SQL editor for an existing project_requests table.
-- CREATE TABLE IF NOT EXISTS does not add columns to tables created earlier.

alter table public.project_requests
  add column if not exists registration_id uuid references public.registrations(id) on delete set null,
  add column if not exists timeline text,
  add column if not exists short_description text not null default '',
  add column if not exists supporting_notes text,
  add column if not exists bank_name text,
  add column if not exists account_name text,
  add column if not exists account_number text,
  add column if not exists branch text,
  add column if not exists document_path text;

insert into storage.buckets (id, name, public)
values ('project-images', 'project-images', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('profile-pictures', 'profile-pictures', true)
on conflict (id) do update set public = true;

alter table public.project_requests
  add column if not exists project_image_path text;

alter table public.registrations
  add column if not exists profile_image_path text;

insert into storage.buckets (id, name, public)
values ('project-documents', 'project-documents', false)
on conflict (id) do nothing;

create index if not exists project_requests_status_idx on public.project_requests(status);
create index if not exists project_requests_registration_id_idx on public.project_requests(registration_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'general',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_registration_id_idx on public.notifications(registration_id, created_at desc);

create table if not exists public.home_wallets (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.registrations(id) on delete cascade,
  points_balance integer not null default 0 check (points_balance >= 0),
  lifetime_points integer not null default 0 check (lifetime_points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.home_wallet_activity (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.home_wallets(id) on delete cascade,
  title text not null,
  description text,
  points integer not null,
  reward_key text,
  created_at timestamptz not null default now()
);

alter table public.home_wallet_activity
  add column if not exists reward_key text;

create index if not exists home_wallet_activity_wallet_idx on public.home_wallet_activity(wallet_id, created_at desc);
create unique index if not exists home_wallet_activity_reward_key_idx on public.home_wallet_activity(wallet_id, reward_key) where reward_key is not null;

create table if not exists public.project_likes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (project_id, registration_id)
);

create table if not exists public.project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.project_views (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  registration_id uuid references public.registrations(id) on delete set null,
  visitor_key text,
  created_at timestamptz not null default now()
);

create index if not exists project_likes_project_idx on public.project_likes(project_id);
create index if not exists project_comments_project_idx on public.project_comments(project_id, created_at desc);
create index if not exists project_views_project_idx on public.project_views(project_id);

-- Review duplicate phone records before enforcing uniqueness. Do not delete accounts automatically.
select mobile_number, count(*) as account_count
from public.registrations
group by mobile_number
having count(*) > 1;
