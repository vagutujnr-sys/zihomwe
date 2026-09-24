-- Run this after database_schema/application-content.sql
-- This inserts realistic published content so the home, news, projects,
-- and dashboard pages can populate from Supabase.

insert into public.news_stories (
  title,
  category,
  excerpt,
  time_label,
  image_url,
  comments_count,
  body,
  status
)
values
  (
    'Community water kiosk opens in Ward 7',
    'Community',
    'Residents now have improved access to clean water after the new kiosk was commissioned this week.',
    '2 hours ago',
    'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1200&q=80',
    18,
    'The new community water kiosk in Ward 7 is expected to reduce long queues and improve daily access to safe water for families, small businesses and schools nearby. Local leaders and residents attended the launch and praised the effort as a practical step toward healthier living.',
    'published'
  ),
  (
    'Youth entrepreneurship forum announced for Friday',
    'Youth',
    'Young entrepreneurs will meet to pitch ideas, learn about funding, and connect with local business mentors.',
    'Today',
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
    12,
    'Organisers have announced a youth entrepreneurship forum aimed at helping young people turn ideas into viable businesses. The event will include live pitch sessions, mentoring, and guidance on funding opportunities and digital marketing.',
    'published'
  ),
  (
    'Rural road rehabilitation starts in Chigwembere',
    'Infrastructure',
    'Road work is underway to improve access for transport, trade and school travel in the area.',
    'Yesterday',
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80',
    9,
    'The rehabilitation project includes drainage improvement and grading on the main access route. Community leaders say the work is expected to reduce travel delays and make goods movement more reliable for local traders.',
    'published'
  ),
  (
    'Health outreach brings mobile clinic to township',
    'Health',
    'Residents completed screening and counselling at the mobile community health outreach session.',
    '3 days ago',
    'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1200&q=80',
    15,
    'The outreach team delivered screenings, health education, and referral support to families in the township. Community members welcomed the service and requested more frequent visits to underserved areas.',
    'published'
  );

insert into public.announcements (
  title,
  date_label,
  body,
  status
)
values
  (
    'Community clean-up drive this Saturday',
    'Saturday, 9:00 AM',
    'Residents are invited to join a neighbourhood clean-up campaign focused on drainage and waste collection.',
    'published'
  ),
  (
    'Market access support window opens',
    'Next Monday',
    'Local small business owners can apply for support to improve market access and product visibility.',
    'published'
  ),
  (
    'School feeding committee meeting',
    'Wednesday, 2:00 PM',
    'Parents, teachers and ward leaders are meeting to review nutrition support and school participation.',
    'published'
  ),
  (
    'Public consultation on local development priorities',
    'Friday, 10:30 AM',
    'Community members are invited to share ideas and priorities for the next local development plan.',
    'published'
  );

insert into public.member_projects (
  title,
  description,
  status,
  progress,
  votes,
  comments,
  image_url,
  category,
  location,
  team,
  updates,
  constituency_id
)
values
  (
    'Road rehabilitation at Chigwembere',
    'Reconstruction of the main road and drainage channels to improve safety, travel time and access for residents.',
    'In Progress',
    68,
    134,
    22,
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80',
    'Funded Member Project',
    'Chigwembere',
    '[{"name":"A. Banda","role":"Project lead","avatar":""},{"name":"J. Nkhoma","role":"Engineer","avatar":""},{"name":"T. Moyo","role":"Community liaison","avatar":""}]'::jsonb,
    '[{"date":"2026-08-01","text":"Site inspection completed"},{"date":"2026-08-12","text":"Materials delivered"},{"date":"2026-08-18","text":"Drainage work underway"}]'::jsonb,
    null
  ),
  (
    'School feeding support',
    'Support for nutritious school meals and kitchen supplies for learners in remote areas.',
    'Planning',
    34,
    86,
    10,
    'https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=1200&q=80',
    'Member Project',
    'Kasungu rural',
    '[{"name":"K. Phiri","role":"Coordinator","avatar":""},{"name":"L. Ngoma","role":"Nutrition lead","avatar":""}]'::jsonb,
    '[{"date":"2026-08-08","text":"Needs assessment done"},{"date":"2026-08-15","text":"Procurement plan approved"}]'::jsonb,
    null
  ),
  (
    'Poultry enterprise support',
    'A member-led poultry initiative to improve income generation and household nutrition.',
    'Completed',
    100,
    210,
    35,
    'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1200&q=80',
    'Funded Member Project',
    'Ward 8',
    '[{"name":"M. Mbewe","role":"Entrepreneur","avatar":""},{"name":"C. Mwale","role":"Trainer","avatar":""}]'::jsonb,
    '[{"date":"2026-07-10","text":"Training completed"},{"date":"2026-07-28","text":"First production cycle launched"}]'::jsonb,
    null
  ),
  (
    'Solar irrigation for gardens',
    'A solar-powered irrigation system to support food production and reduce energy costs.',
    'In Progress',
    57,
    98,
    17,
    'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1200&q=80',
    'Agriculture',
    'Village cluster 3',
    '[{"name":"S. Chilima","role":"Agriculture lead","avatar":""},{"name":"R. Kachipapa","role":"Systems technician","avatar":""}]'::jsonb,
    '[{"date":"2026-08-04","text":"Solar panels installed"},{"date":"2026-08-16","text":"Water line testing in progress"}]'::jsonb,
    null
  );

insert into public.events (
  title,
  category,
  description,
  event_date,
  event_time,
  location,
  address,
  latitude,
  longitude,
  image_url,
  attending,
  status,
  constituency_id
)
values
  (
    'Community clean-up drive',
    'Community',
    'Residents are joining together to clean drains, trim grass and sort waste around the township.',
    '2026-08-24',
    '08:30:00',
    'Township Grounds',
    'Main Road, Township',
    -13.9626,
    33.7741,
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80',
    120,
    'published',
    null
  ),
  (
    'Farmers market day',
    'Economic',
    'Local producers and traders will showcase crops, livestock products and food items for the community.',
    '2026-08-27',
    '09:00:00',
    'Market Square',
    'Market Square Road',
    -13.9650,
    33.7820,
    'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=80',
    84,
    'published',
    null
  ),
  (
    'Youth business mentoring session',
    'Youth',
    'Young people will receive guidance on entrepreneurship, idea validation and business planning.',
    '2026-08-30',
    '10:00:00',
    'Innovation Hub',
    'Mchenga Road',
    -13.9672,
    33.7891,
    'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80',
    64,
    'published',
    null
  ),
  (
    'Women in agriculture forum',
    'Women',
    'A networking and learning session for women in farming, food processing and small business management.',
    '2026-09-02',
    '14:00:00',
    'Community Hall',
    'Nkhoma Avenue',
    -13.9599,
    33.7704,
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
    72,
    'published',
    null
  );
