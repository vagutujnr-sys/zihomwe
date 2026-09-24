insert into public.admin_accounts (
  constituency_id,
  display_name,
  pin_hash,
  role,
  theme_color,
  is_active
)
values (
  null,
  'Super Administrator',
  '92350389886410d8ea5ee74e173d1715:1d334c17c1b667edaac9a21edf6480a52f8574c3694abb1ef2dd2261728c6c941a05633606c3a38c0449c0e1e6d3b71e585ae4086296268894148dedb85d81eb',
  'super_admin',
  '#0f766e',
  true
)
on conflict do nothing;
