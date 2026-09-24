-- Row Level Security policies. Registration reads and writes go through
-- server routes using the service-role client; they are not public data.

alter table public.registrations enable row level security;
alter table public.admin_accounts enable row level security;
alter table public.news_stories enable row level security;
alter table public.news_likes enable row level security;
alter table public.news_views enable row level security;
alter table public.announcements enable row level security;
alter table public.member_projects enable row level security;
alter table public.events enable row level security;
alter table public.chats enable row level security;
alter table public.chat_messages enable row level security;
alter table public.affiliate_requests enable row level security;
alter table public.project_requests enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Allow insert for anon" on public.registrations;
drop policy if exists "Allow read for anon" on public.registrations;

drop policy if exists "Public can read published content" on public.news_stories;
create policy "Public can read published content"
  on public.news_stories
  for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "Public can read news likes" on public.news_likes;
create policy "Public can read news likes"
  on public.news_likes
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can read news views" on public.news_views;
create policy "Public can read news views"
  on public.news_views
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can read published announcements" on public.announcements;
create policy "Public can read published announcements"
  on public.announcements
  for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "Public can read member projects" on public.member_projects;
create policy "Public can read member projects"
  on public.member_projects
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can read published events" on public.events;
create policy "Public can read published events"
  on public.events
  for select
  to anon, authenticated
  using (status = 'published');
