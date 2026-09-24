create table if not exists public.news_stories (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'Community',
  excerpt text not null default '',
  time_label text,
  image_url text,
  comments_count integer not null default 0,
  body text,
  constituency_id text references public.constituencies(id) on delete set null,
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.news_stories
  add column if not exists constituency_id text references public.constituencies(id) on delete set null;

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

alter table public.news_likes enable row level security;
alter table public.news_views enable row level security;

drop policy if exists "Public can read news likes" on public.news_likes;
create policy "Public can read news likes" on public.news_likes for select to anon, authenticated using (true);

drop policy if exists "Public can read news views" on public.news_views;
create policy "Public can read news views" on public.news_views for select to anon, authenticated using (true);

insert into storage.buckets (id, name, public)
values ('news-images', 'news-images', true)
on conflict (id) do update set public = true;

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date_label text,
  body text,
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  status text not null default 'Planning',
  progress integer not null default 0 check (progress between 0 and 100),
  votes integer not null default 0,
  comments integer not null default 0,
  image_url text,
  category text not null default 'Funded Member Project',
  location text,
  team jsonb not null default '[]'::jsonb,
  updates jsonb not null default '[]'::jsonb,
  constituency_id text references public.constituencies(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'Community',
  description text not null default '',
  event_date date,
  event_time time,
  location text,
  address text,
  latitude double precision,
  longitude double precision,
  image_url text,
  attending integer not null default 0,
  status text not null default 'published' check (status in ('draft', 'published', 'cancelled', 'completed')),
  constituency_id text references public.constituencies(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_group boolean not null default false,
  last_message text,
  last_message_at timestamptz,
  unread_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_registration_id uuid references public.registrations(id) on delete set null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.affiliate_requests (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid references public.registrations(id) on delete set null,
  full_name text not null,
  mobile_number text,
  email text,
  business_name text,
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'contacted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'approved', 'rejected', 'completed')),
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

create index if not exists events_constituency_id_idx on public.events(constituency_id);
create index if not exists projects_constituency_id_idx on public.member_projects(constituency_id);
create index if not exists chat_messages_chat_id_idx on public.chat_messages(chat_id);
create index if not exists affiliate_requests_status_idx on public.affiliate_requests(status);
create index if not exists project_requests_status_idx on public.project_requests(status);
create index if not exists notifications_registration_id_idx on public.notifications(registration_id, created_at desc);
create index if not exists home_wallet_activity_wallet_idx on public.home_wallet_activity(wallet_id, created_at desc);
create unique index if not exists home_wallet_activity_reward_key_idx on public.home_wallet_activity(wallet_id, reward_key) where reward_key is not null;
create index if not exists project_likes_project_idx on public.project_likes(project_id);
create index if not exists project_comments_project_idx on public.project_comments(project_id, created_at desc);
create index if not exists project_views_project_idx on public.project_views(project_id);
create index if not exists news_likes_news_idx on public.news_likes(news_id);
create index if not exists news_views_news_idx on public.news_views(news_id);

alter table public.news_stories enable row level security;
alter table public.announcements enable row level security;
alter table public.member_projects enable row level security;
alter table public.events enable row level security;
alter table public.chats enable row level security;
alter table public.chat_messages enable row level security;
alter table public.affiliate_requests enable row level security;
alter table public.project_requests enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Public can read published content" on public.news_stories;
create policy "Public can read published content" on public.news_stories for select to anon, authenticated using (status = 'published');

drop policy if exists "Public can read published announcements" on public.announcements;
create policy "Public can read published announcements" on public.announcements for select to anon, authenticated using (status = 'published');

drop policy if exists "Public can read member projects" on public.member_projects;
create policy "Public can read member projects" on public.member_projects for select to anon, authenticated using (true);

drop policy if exists "Public can read published events" on public.events;
create policy "Public can read published events" on public.events for select to anon, authenticated using (status = 'published');
