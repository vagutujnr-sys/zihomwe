create table if not exists public.provinces (
  id text primary key,
  name text not null unique,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.districts (
  id text primary key,
  province_id text not null references public.provinces(id) on delete restrict,
  name text not null,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.constituencies (
  id text primary key,
  province_id text not null references public.provinces(id) on delete restrict,
  district_id text references public.districts(id) on delete set null,
  name text not null unique,
  latitude double precision,
  longitude double precision,
  mp_name text,
  mp_phone text,
  mp_email text,
  mp_party text,
  mp_image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wards (
  id text primary key,
  province_id text not null references public.provinces(id) on delete restrict,
  district_id text references public.districts(id) on delete set null,
  constituency_id text not null references public.constituencies(id) on delete cascade,
  ward_number integer,
  name text not null,
  latitude double precision,
  longitude double precision,
  municipality text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cells (
  id text primary key,
  province_id text not null references public.provinces(id) on delete restrict,
  district_id text references public.districts(id) on delete set null,
  constituency_id text references public.constituencies(id) on delete set null,
  ward_id text references public.wards(id) on delete set null,
  name text not null,
  address text not null default '',
  latitude double precision,
  longitude double precision,
  radius_km double precision,
  cell_leader_name text,
  cell_leader_phone text,
  cell_leader_email text,
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.registrations
  add column if not exists cell_id text references public.cells(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'registrations_cell_id_fkey'
      and conrelid = 'public.registrations'::regclass
  ) then
    alter table public.registrations
      add constraint registrations_cell_id_fkey
      foreign key (cell_id) references public.cells(id) on delete set null;
  end if;
end
$$;

create index if not exists registrations_cell_id_idx on public.registrations(cell_id);

alter table public.constituencies
  add column if not exists district_id text,
  add column if not exists mp_name text,
  add column if not exists mp_phone text,
  add column if not exists mp_email text,
  add column if not exists mp_party text;

alter table public.wards
  add column if not exists district_id text,
  add column if not exists ward_number integer,
  add column if not exists municipality text;

alter table public.cells
  add column if not exists province_id text,
  add column if not exists district_id text,
  add column if not exists constituency_id text,
  add column if not exists ward_id text,
  add column if not exists address text,
  add column if not exists radius_km double precision,
  add column if not exists cell_leader_name text,
  add column if not exists cell_leader_phone text,
  add column if not exists cell_leader_email text,
  add column if not exists is_active boolean default true;

create index if not exists provinces_name_idx
  on public.provinces (name);

create index if not exists districts_province_id_idx
  on public.districts (province_id);

create index if not exists constituencies_province_id_idx
  on public.constituencies (province_id);

create index if not exists constituencies_district_id_idx
  on public.constituencies (district_id);

create index if not exists wards_province_id_idx
  on public.wards (province_id);

create index if not exists wards_constituency_id_idx
  on public.wards (constituency_id);

create index if not exists wards_constituency_district_id_idx
  on public.wards (constituency_id, district_id);

create index if not exists cells_province_id_idx
  on public.cells (province_id);

create index if not exists cells_constituency_id_idx
  on public.cells (constituency_id);

create index if not exists cells_ward_id_idx
  on public.cells (ward_id);

create index if not exists cells_constituency_ward_id_idx
  on public.cells (constituency_id, ward_id);

-- Normalize existing cells from the canonical chain:
-- province -> district -> constituency -> ward -> cell.
update public.cells as cell
set
  province_id = coalesce(cell.province_id, ward.province_id, constituency.province_id),
  district_id = coalesce(cell.district_id, ward.district_id, constituency.district_id),
  constituency_id = coalesce(cell.constituency_id, ward.constituency_id),
  updated_at = now()
from public.wards as ward
left join public.constituencies as constituency on constituency.id = ward.constituency_id
where cell.ward_id = ward.id
  and (cell.province_id is null or cell.district_id is null or cell.constituency_id is null);

update public.cells as cell
set
  province_id = coalesce(cell.province_id, constituency.province_id),
  district_id = coalesce(cell.district_id, constituency.district_id),
  updated_at = now()
from public.constituencies as constituency
where cell.constituency_id = constituency.id
  and (cell.province_id is null or cell.district_id is null);

-- Use a parent location as a coordinate fallback only for legacy rows. New
-- cells must be created with their own coordinates by the trigger below.
update public.cells as cell
set latitude = coalesce(cell.latitude, ward.latitude, constituency.latitude),
    longitude = coalesce(cell.longitude, ward.longitude, constituency.longitude),
    updated_at = now()
from public.wards as ward
left join public.constituencies as constituency on constituency.id = ward.constituency_id
where cell.ward_id = ward.id
  and (cell.latitude is null or cell.longitude is null);

-- Rebuild every denormalized cell location field from the canonical parent chain.
update public.cells as cell
set province_id = province.id,
    district_id = district.id,
    constituency_id = constituency.id,
    updated_at = now()
from public.wards as ward
join public.constituencies as constituency on constituency.id = ward.constituency_id
join public.districts as district on district.id = constituency.district_id
join public.provinces as province on province.id = district.province_id
where cell.ward_id = ward.id;

create or replace function public.normalize_cell_location()
returns trigger
language plpgsql
as $$
declare
  parent_ward public.wards%rowtype;
  parent_constituency public.constituencies%rowtype;
  parent_district public.districts%rowtype;
  parent_province public.provinces%rowtype;
begin
  if new.ward_id is null then
    raise exception 'Cell % must be linked to a ward', new.id;
  end if;

  select * into parent_ward from public.wards where id = new.ward_id;
  if parent_ward.id is null then raise exception 'Cell % references an unknown ward', new.id; end if;
  select * into parent_constituency from public.constituencies where id = parent_ward.constituency_id;
  if parent_constituency.id is null then raise exception 'Ward % references an unknown constituency', parent_ward.id; end if;
  select * into parent_district from public.districts where id = parent_constituency.district_id;
  if parent_district.id is null then raise exception 'Constituency % references an unknown district', parent_constituency.id; end if;
  select * into parent_province from public.provinces where id = parent_district.province_id;
  if parent_province.id is null then raise exception 'District % references an unknown province', parent_district.id; end if;

  -- Parent relationships are authoritative; denormalized IDs cannot override them.
  new.province_id := parent_province.id;
  new.district_id := parent_district.id;
  new.constituency_id := parent_constituency.id;

  if new.latitude is null or new.longitude is null then
    raise exception 'Cell % must have latitude and longitude', new.id;
  end if;
  if new.latitude not between -90 and 90 or new.longitude not between -180 and 180 then
    raise exception 'Cell % has invalid coordinates', new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists cells_location_integrity on public.cells;
create trigger cells_location_integrity
before insert or update on public.cells
for each row execute function public.normalize_cell_location();

-- Audit query: rows returned here need manual coordinates/parent links before
-- they can be used for a nearest-cell assignment.
select id, name, province_id, district_id, constituency_id, ward_id, latitude, longitude
from public.cells
where province_id is null
   or district_id is null
   or constituency_id is null
   or ward_id is null
   or latitude is null
   or longitude is null;

comment on column public.constituencies.district_id is 'District containing this constituency';
comment on column public.constituencies.mp_name is 'Member of Parliament assigned to this constituency';
comment on column public.constituencies.mp_phone is 'Member of Parliament contact phone';
comment on column public.constituencies.mp_email is 'Member of Parliament contact email';
comment on column public.wards.constituency_id is 'Constituency containing this ward';
comment on column public.wards.district_id is 'District containing this ward';
comment on column public.cells.ward_id is 'Ward containing this cell';
comment on column public.cells.constituency_id is 'Constituency containing this cell';
