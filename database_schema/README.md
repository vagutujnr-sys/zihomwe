# Zihomwe database schema

Fresh schema dump reflecting the **live Supabase `public` schema** as of 2026-09-22.

Apply in order in the Supabase SQL editor (or `psql`) on an empty project:

| Order | File | Purpose |
|------:|------|---------|
| 1 | `01_locations.sql` | Province → district → constituency → ward → cell |
| 2 | `02_registrations.sql` | Citizen registrations (FK → cells) |
| 3 | `03_admin.sql` | Constituency + super admin accounts |
| 4 | `04_content.sql` | News, announcements, projects, events, chats |
| 5 | `05_engagement.sql` | Likes/views, funding requests, wallets, notifications |
| 6 | `06_storage.sql` | Storage buckets used by the app |
| 8 | `08_messaging.sql` | @handles, chat requests, DM thread columns |
| 9 | `09_chat_calls.sql` | Read receipts, blocks, call sessions/signals |
| 10 | `10_notification_data.sql` | Notification `data` jsonb for chat deep-links |
| 11 | `11_supabase_auth.sql` | Link profiles to Supabase Auth, drop device lock, chat Realtime policies |

Optional seeds (after schema):

- `seed_super_admin.sql` — creates the super-admin PIN account
- `seed_content.sql` — sample news / announcements / projects / events

Legacy incremental migration scripts (pre-consolidation) live in `_legacy/`.

## Live inventory (verified)

Core tables plus messaging:
`registrations.handle`, `chat_requests`, and DM fields on `chats` (`participant_one_id`, `participant_two_id`, `chat_request_id`).

## Chat delivery

Sign-in is a phone number plus a 5-digit PIN. That creates a Supabase Auth user (`phone` `+263…`, password derived from the PIN) and stores `registrations.auth_user_id`. Device id is recorded only as a last-seen value. It does not block a second phone or a second browser.

Apply `11_supabase_auth.sql` before expecting Realtime. It allows `authenticated` select on `chats` and `chat_messages` only when `current_registration_id()` is a participant, and adds those tables to the `supabase_realtime` publication. There is still no anon select on those tables.

The open thread subscribes to `chat_messages` for that chat. The 20-second poll in `OPEN_THREAD_POLL_MS` runs only while that socket is not subscribed.
