create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  mobile_number text not null unique,
  otp_code text not null,
  location_consent boolean not null default false,
  latitude double precision,
  longitude double precision,
  device_id text unique,
  cell_id text,
  assigned_location jsonb,
  role text not null default 'citizen',
  profile_image_path text,
  created_at timestamptz not null default now()
);

alter table public.registrations
  add column if not exists cell_id text;

create index if not exists registrations_cell_id_idx on public.registrations(cell_id);

alter table public.registrations enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'registrations'
      and policyname = 'Allow insert for anon'
  ) then
    create policy "Allow insert for anon"
      on public.registrations
      for insert
      to anon
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'registrations'
      and policyname = 'Allow read for anon'
  ) then
    create policy "Allow read for anon"
      on public.registrations
      for select
      to anon
      using (true);
  end if;
end
$$;
