-- REQUIRED for @handles + messaging. Paste into Supabase → SQL Editor → Run.

alter table public.registrations
  add column if not exists handle text;

create unique index if not exists registrations_handle_unique_idx
  on public.registrations (lower(handle))
  where handle is not null;

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
