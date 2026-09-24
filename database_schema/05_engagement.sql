-- Engagement + requests: likes/views, funding, affiliates, wallets, notifications

create table if not exists public.news_likes (
  id uuid primary key default gen_random_uuid(),
  news_id uuid not null references public.news_stories(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (news_id, registration_id)
);

create table if not exists public.news_views (
  id uuid primary key default gen_random_uuid(),
  news_id uuid not null references public.news_stories(id) on delete cascade,
  registration_id uuid references public.registrations(id) on delete set null,
  visitor_key text,
  created_at timestamptz not null default now()
);

-- project_id currently has no FK in live DB (matches production OpenAPI).
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

create table if not exists public.project_requests (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid references public.registrations(id) on delete set null,
  title text not null,
  description text not null default '',
  short_description text not null default '',
  category text,
  requested_amount numeric(12, 2),
  location text,
  timeline text,
  supporting_notes text,
  bank_name text,
  account_name text,
  account_number text,
  branch text,
  document_path text,
  project_image_path text,
  status text not null default 'pending'
    check (status in ('pending', 'reviewing', 'approved', 'rejected', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_requests (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid references public.registrations(id) on delete set null,
  full_name text not null,
  mobile_number text,
  email text,
  business_name text,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'contacted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'general',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

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

create index if not exists news_likes_news_idx
  on public.news_likes (news_id);

create index if not exists news_views_news_idx
  on public.news_views (news_id);

create index if not exists project_likes_project_idx
  on public.project_likes (project_id);

create index if not exists project_comments_project_idx
  on public.project_comments (project_id, created_at desc);

create index if not exists project_views_project_idx
  on public.project_views (project_id);

create index if not exists project_requests_status_idx
  on public.project_requests (status);

create index if not exists project_requests_registration_id_idx
  on public.project_requests (registration_id);

create index if not exists affiliate_requests_status_idx
  on public.affiliate_requests (status);

create index if not exists notifications_registration_id_idx
  on public.notifications (registration_id, created_at desc);

create index if not exists home_wallet_activity_wallet_idx
  on public.home_wallet_activity (wallet_id, created_at desc);

create unique index if not exists home_wallet_activity_reward_key_idx
  on public.home_wallet_activity (wallet_id, reward_key)
  where reward_key is not null;
