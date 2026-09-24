-- Link ZiHomwe profiles to Supabase Auth and allow Realtime only for participants.
-- Apply in the Supabase SQL editor after 01–10.
-- Phone + 5-digit PIN is the sign-in. Device id is no longer a lock.

alter table public.registrations
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

create index if not exists registrations_auth_user_id_idx
  on public.registrations (auth_user_id);

-- Same browser may be used for more than one phone. Stop treating device_id as unique.
alter table public.registrations drop constraint if exists registrations_device_id_key;

comment on column public.registrations.auth_user_id is 'auth.users.id created when the person chooses a PIN';

-- Resolves the signed-in Supabase user to their ZiHomwe registration.
-- security definer so Realtime policies do not need a public read of every registration.
create or replace function public.current_registration_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.registrations
  where auth_user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.current_registration_id() from public, anon;
grant execute on function public.current_registration_id() to authenticated;

alter table public.chats enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "Participants can read chats" on public.chats;
create policy "Participants can read chats"
  on public.chats
  for select
  to authenticated
  using (
    participant_one_id = public.current_registration_id()
    or participant_two_id = public.current_registration_id()
  );

drop policy if exists "Participants can read messages" on public.chat_messages;
create policy "Participants can read messages"
  on public.chat_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.chats c
      where c.id = chat_messages.chat_id
        and (
          c.participant_one_id = public.current_registration_id()
          or c.participant_two_id = public.current_registration_id()
        )
    )
  );

-- No anon select on chats or chat_messages. The service role bypasses RLS for server writes.

alter table public.chat_messages replica identity full;
alter table public.chats replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chats'
  ) then
    alter publication supabase_realtime add table public.chats;
  end if;
end
$$;
