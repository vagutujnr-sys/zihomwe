-- Notification payload for deep-links (chatId, callId, etc.)
-- Apply in Supabase SQL Editor

alter table public.notifications
  add column if not exists data jsonb not null default '{}'::jsonb;

create index if not exists notifications_unread_idx
  on public.notifications (registration_id, created_at desc)
  where read_at is null;
