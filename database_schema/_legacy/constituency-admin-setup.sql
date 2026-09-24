alter table public.constituencies
  add column if not exists mp_name text,
  add column if not exists mp_phone text,
  add column if not exists mp_email text,
  add column if not exists mp_image_path text,
  add column if not exists mp_party text;

comment on column public.constituencies.mp_name is 'Member of Parliament assigned to this constituency';
comment on column public.constituencies.mp_phone is 'Member of Parliament contact phone';
comment on column public.constituencies.mp_email is 'Member of Parliament contact email';
comment on column public.constituencies.mp_party is 'Member of Parliament party';
