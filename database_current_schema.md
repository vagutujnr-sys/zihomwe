# Zihomwe — current Supabase schema snapshot

Generated from live OpenAPI + table probes on **2026-09-22**.
Authoritative DDL: `database_schema/01_*.sql` … `07_*.sql`.

## Row counts (live)

| Table | Rows |
|-------|-----:|
| registrations | 1 |
| provinces | 11 |
| districts | 65 |
| constituencies | 210 |
| wards | 1970 |
| cells | 2 |
| admin_accounts | 1 |
| news_stories | 4 |
| announcements | 4 |
| member_projects | 4 |
| events | 4 |
| news_likes / news_views | 0 |
| chats / chat_messages | 0 |
| affiliate_requests | 0 |
| project_requests | 0 |
| notifications | 0 |
| home_wallets / home_wallet_activity | 0 |
| project_likes / comments / views | 0 |

## Tables & columns

### `registrations`
`id` uuid PK · `full_name` · `mobile_number` unique · `otp_code` · `location_consent` · `latitude` · `longitude` · `device_id` unique · `cell_id` → cells · `assigned_location` jsonb · `role` · `profile_image_path` · `created_at`

### `provinces`
`id` text PK · `name` unique · `latitude` · `longitude` · `created_at` · `updated_at`

### `districts`
`id` text PK · `province_id` → provinces · `name` · `latitude` · `longitude` · `created_at` · `updated_at`

### `constituencies`
`id` text PK · `province_id` → provinces · `district_id` → districts · `name` unique · `latitude` · `longitude` · `mp_name` · `mp_phone` · `mp_email` · `mp_party` · `mp_image_path` · `created_at` · `updated_at`

### `wards`
`id` text PK · `province_id` → provinces · `district_id` → districts · `constituency_id` → constituencies · `ward_number` · `name` · `latitude` · `longitude` · `municipality` · `created_at` · `updated_at`

### `cells`
`id` text PK · `province_id` → provinces · `district_id` → districts · `constituency_id` → constituencies · `ward_id` → wards · `name` · `address` · `latitude` · `longitude` · `radius_km` · `cell_leader_*` · `is_active` · `created_at` · `updated_at`

### `admin_accounts`
`id` uuid PK · `constituency_id` → constituencies (nullable for super_admin) · `display_name` · `pin_hash` · `theme_color` · `is_active` · `last_login_at` · `role` (`constituency_admin` \| `super_admin`) · `created_at` · `updated_at`

### `news_stories`
`id` uuid PK · `title` · `category` · `excerpt` · `time_label` · `image_url` · `comments_count` · `body` · `constituency_id` → constituencies · `status` · `created_at` · `updated_at`

### `news_likes` / `news_views`
FK → `news_stories` + optional `registrations`

### `announcements`
`id` uuid PK · `title` · `date_label` · `body` · `status` · `created_at` · `updated_at`

### `member_projects`
`id` uuid PK · `title` · `description` · `status` · `progress` · `votes` · `comments` · `image_url` · `category` · `location` · `team` jsonb · `updates` jsonb · `constituency_id` → constituencies · `created_at` · `updated_at`

### `events`
`id` uuid PK · `title` · `category` · `description` · `event_date` · `event_time` · `location` · `address` · `latitude` · `longitude` · `image_url` · `attending` · `status` · `constituency_id` → constituencies · `created_at` · `updated_at`

### `chats` / `chat_messages`
Group/DM headers + messages (FK → chats, optional sender registration)

### `project_requests`
Citizen funding applications (bank fields, docs, status workflow)

### `affiliate_requests`
Affiliate interest form submissions

### `notifications`
Per-registration alerts

### `home_wallets` / `home_wallet_activity`
Points balance + ledger (`reward_key` unique per wallet when set)

### `project_likes` / `project_comments` / `project_views`
Engagement on projects (`project_id` has **no FK** in live DB)

## Storage buckets
`news-images`, `project-images`, `profile-pictures`, `leadership-images` (public); `project-documents` (private)
