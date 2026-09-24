-- Storage buckets used by the app (images / documents)

insert into storage.buckets (id, name, public)
values
  ('news-images', 'news-images', true),
  ('project-images', 'project-images', true),
  ('profile-pictures', 'profile-pictures', true),
  ('leadership-images', 'leadership-images', true),
  ('project-documents', 'project-documents', false)
on conflict (id) do update
set public = excluded.public;
