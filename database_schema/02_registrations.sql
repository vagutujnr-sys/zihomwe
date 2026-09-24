-- Citizen registrations (device-bound phone accounts)

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  mobile_number text not null unique,
  otp_code text not null,
  location_consent boolean not null default false,
  latitude double precision,
  longitude double precision,
  device_id text unique,
  cell_id text references public.cells(id) on delete set null,
  assigned_location jsonb,
  role text not null default 'citizen',
  profile_image_path text,
  created_at timestamptz not null default now()
);

create index if not exists registrations_cell_id_idx
  on public.registrations (cell_id);
