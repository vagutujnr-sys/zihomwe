-- Published app content: news, announcements, projects, events, chats

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
  status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date_label text,
  body text,
  status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
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
  status text not null default 'published'
    check (status in ('draft', 'published', 'cancelled', 'completed')),
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

create index if not exists events_constituency_id_idx
  on public.events (constituency_id);

create index if not exists projects_constituency_id_idx
  on public.member_projects (constituency_id);

create index if not exists chat_messages_chat_id_idx
  on public.chat_messages (chat_id);
