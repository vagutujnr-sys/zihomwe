-- Quoted replies on chat messages. Apply in the Supabase SQL editor.

alter table public.chat_messages
  add column if not exists reply_to_message_id uuid references public.chat_messages(id) on delete set null,
  add column if not exists reply_excerpt text;
