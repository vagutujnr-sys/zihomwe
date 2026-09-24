-- Chat blocks, read receipts, and WebRTC call sessions
-- Apply after 08_messaging.sql

-- Read receipts on messages
alter table public.chat_messages
  add column if not exists read_at timestamptz;

create index if not exists chat_messages_unread_idx
  on public.chat_messages (chat_id, sender_registration_id, read_at)
  where read_at is null;

create index if not exists chat_messages_chat_created_idx
  on public.chat_messages (chat_id, created_at);

-- Per-thread last-read markers (optional convenience)
alter table public.chats
  add column if not exists participant_one_last_read_at timestamptz,
  add column if not exists participant_two_last_read_at timestamptz;

-- Block list
create table if not exists public.chat_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.registrations(id) on delete cascade,
  blocked_id uuid not null references public.registrations(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint chat_blocks_not_self check (blocker_id <> blocked_id),
  unique (blocker_id, blocked_id)
);

create index if not exists chat_blocks_blocker_idx on public.chat_blocks (blocker_id);
create index if not exists chat_blocks_blocked_idx on public.chat_blocks (blocked_id);

-- Voice / video call sessions
create table if not exists public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  caller_id uuid not null references public.registrations(id) on delete cascade,
  callee_id uuid not null references public.registrations(id) on delete cascade,
  call_type text not null check (call_type in ('audio', 'video')),
  status text not null default 'ringing'
    check (status in ('ringing', 'active', 'ended', 'declined', 'missed', 'failed')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists call_sessions_callee_status_idx
  on public.call_sessions (callee_id, status, created_at desc);

create index if not exists call_sessions_caller_status_idx
  on public.call_sessions (caller_id, status, created_at desc);

create index if not exists call_sessions_chat_idx
  on public.call_sessions (chat_id, created_at desc);

-- Signaling fallback (offer / answer / ice) when Realtime is delayed
create table if not exists public.call_signals (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.call_sessions(id) on delete cascade,
  sender_id uuid not null references public.registrations(id) on delete cascade,
  signal_type text not null check (signal_type in ('offer', 'answer', 'ice', 'hangup')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists call_signals_call_created_idx
  on public.call_signals (call_id, created_at);

alter table public.chat_blocks enable row level security;
alter table public.call_sessions enable row level security;
alter table public.call_signals enable row level security;
