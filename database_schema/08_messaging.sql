-- Messaging: handles, chat requests, and 1:1 threads
-- Apply after 01–07 schema files.

alter table public.registrations
  add column if not exists handle text;

create unique index if not exists registrations_handle_unique_idx
  on public.registrations (lower(handle))
  where handle is not null;

comment on column public.registrations.handle is 'Public @handle used to find people for messaging';

create or replace function public.prevent_handle_change()
returns trigger
language plpgsql
as $$
begin
  if old.handle is not null and new.handle is distinct from old.handle then
    raise exception 'A handle cannot be changed once set';
  end if;
  return new;
end;
$$;

drop trigger if exists registrations_handle_immutable on public.registrations;
create trigger registrations_handle_immutable
before update of handle on public.registrations
for each row execute function public.prevent_handle_change();

-- Pending / accepted / rejected message requests
create table if not exists public.chat_requests (
  id uuid primary key default gen_random_uuid(),
  from_registration_id uuid not null references public.registrations(id) on delete cascade,
  to_registration_id uuid not null references public.registrations(id) on delete cascade,
  note text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_requests_not_self check (from_registration_id <> to_registration_id)
);

create unique index if not exists chat_requests_pending_pair_idx
  on public.chat_requests (from_registration_id, to_registration_id)
  where status = 'pending';

create index if not exists chat_requests_to_status_idx
  on public.chat_requests (to_registration_id, status, created_at desc);

create index if not exists chat_requests_from_status_idx
  on public.chat_requests (from_registration_id, status, created_at desc);

-- Extend chats for 1:1 DM threads after a request is accepted
alter table public.chats
  add column if not exists participant_one_id uuid references public.registrations(id) on delete cascade,
  add column if not exists participant_two_id uuid references public.registrations(id) on delete cascade,
  add column if not exists chat_request_id uuid references public.chat_requests(id) on delete set null;

create unique index if not exists chats_dm_pair_idx
  on public.chats (participant_one_id, participant_two_id)
  where participant_one_id is not null and participant_two_id is not null and is_group = false;

create index if not exists chats_participant_one_idx
  on public.chats (participant_one_id, last_message_at desc nulls last);

create index if not exists chats_participant_two_idx
  on public.chats (participant_two_id, last_message_at desc nulls last);

alter table public.chat_requests enable row level security;
