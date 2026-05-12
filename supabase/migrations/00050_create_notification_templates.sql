-- ============================================================
-- EP-06 P0-1: Notifications & Template Management — schema
--   notification_templates    versioned templates per (key, locale, channel)
--   notification_outbox       every send goes through here (queued/sent/failed/dead/suppressed)
--   notification_preferences  per-user channel × category matrix + quiet hours + pause + locale
--   notification_email_health bounce / complaint state per email
--   notification_throttle     daily category counters
-- ============================================================

-- ------------------------------------------------------------
-- 1. notification_templates
-- ------------------------------------------------------------
create table public.notification_templates (
  id              uuid primary key default gen_random_uuid(),
  key             text not null,
  locale          text not null check (locale in ('mn','en')),
  channel         text not null check (channel in ('email','in_app','web_push')),
  category        text not null check (category in
                    ('transactional','event_lifecycle','weather','social','marketing','system')),
  version         integer not null default 1,
  is_active       boolean not null default false,

  subject_md      text,
  body_md         text not null,
  plaintext_md    text,
  variables       jsonb not null default '[]'::jsonb,
  description     text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (key, locale, channel, version)
);

-- Hot path: lookup the active template for a (key, locale, channel)
create index notification_templates_active_idx
  on public.notification_templates(key, locale, channel)
  where is_active = true;

-- Only ONE active version per (key, locale, channel)
create unique index notification_templates_one_active_per_kvc
  on public.notification_templates(key, locale, channel)
  where is_active = true;

create trigger notification_templates_updated_at
  before update on public.notification_templates
  for each row execute function update_updated_at();

alter table public.notification_templates enable row level security;

create policy "admins read all templates"
  on public.notification_templates for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "admins manage templates"
  on public.notification_templates for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ------------------------------------------------------------
-- 2. notification_outbox
-- ------------------------------------------------------------
create table public.notification_outbox (
  id                  uuid primary key default gen_random_uuid(),
  idempotency_key     text not null unique,
  template_key        text not null,
  category            text not null,
  channel             text not null check (channel in ('email','in_app','web_push')),
  recipient_user_id   uuid references auth.users(id) on delete cascade,
  recipient_email     text,
  recipient_locale    text not null default 'mn',

  variables           jsonb not null default '{}'::jsonb,

  severity            text not null default 'normal'
    check (severity in ('normal','high','severe')),
  bypass_dnd          boolean not null default false,

  status              text not null default 'queued'
    check (status in ('queued','scheduled','sending','sent','failed','dead','suppressed')),
  scheduled_for       timestamptz not null default now(),
  attempted_at        timestamptz,
  sent_at             timestamptz,
  retry_count         integer not null default 0,
  last_error          text,
  provider_message_id text,

  source_epic         text,
  source_event        text,
  source_target_id    uuid,

  created_at          timestamptz not null default now()
);

create index outbox_due_idx
  on public.notification_outbox(scheduled_for)
  where status in ('queued','scheduled');
create index outbox_recipient_idx
  on public.notification_outbox(recipient_user_id, created_at desc);
create index outbox_status_idx
  on public.notification_outbox(status, created_at);

alter table public.notification_outbox enable row level security;

create policy "users read own outbox rows"
  on public.notification_outbox for select
  using (auth.uid() = recipient_user_id);

create policy "admins read all outbox"
  on public.notification_outbox for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

do $$ begin
  alter publication supabase_realtime add table public.notification_outbox;
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- 3. notification_preferences
-- ------------------------------------------------------------
create table public.notification_preferences (
  user_id                  uuid primary key references auth.users(id) on delete cascade,
  preferred_locale         text not null default 'mn' check (preferred_locale in ('mn','en')),
  timezone                 text not null default 'Asia/Ulaanbaatar',
  quiet_hours_start        time,
  quiet_hours_end          time,
  allow_severe_during_dnd  boolean not null default true,
  paused_until             timestamptz,
  matrix                   jsonb not null default jsonb_build_object(
    'transactional',   jsonb_build_object('email', true,  'in_app', true),
    'event_lifecycle', jsonb_build_object('email', true,  'in_app', true),
    'weather',         jsonb_build_object('email', true,  'in_app', true),
    'social',          jsonb_build_object('email', false, 'in_app', true),
    'marketing',       jsonb_build_object('email', false, 'in_app', false),
    'system',          jsonb_build_object('email', true,  'in_app', true)
  ),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function update_updated_at();

alter table public.notification_preferences enable row level security;

create policy "users manage own notif prefs"
  on public.notification_preferences for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "admins read all notif prefs"
  on public.notification_preferences for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create or replace function public.ensure_notification_prefs()
returns trigger language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_preferences(user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_create_notification_prefs on public.profiles;
create trigger profiles_create_notification_prefs
  after insert on public.profiles
  for each row execute function public.ensure_notification_prefs();

-- Backfill
insert into public.notification_preferences(user_id)
  select id from public.profiles
  on conflict (user_id) do nothing;

-- ------------------------------------------------------------
-- 4. notification_email_health (bounce / complaint state)
-- ------------------------------------------------------------
create table public.notification_email_health (
  email             text primary key,
  status            text not null check (status in ('healthy','bounced','complained','unsubscribed')),
  reason            text,
  last_event_at     timestamptz not null default now(),
  bounce_count      integer not null default 0
);

alter table public.notification_email_health enable row level security;

create policy "admins read email health"
  on public.notification_email_health for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ------------------------------------------------------------
-- 5. notification_throttle (anti-spam, daily cap per category)
-- ------------------------------------------------------------
create table public.notification_throttle (
  user_id     uuid not null references auth.users(id) on delete cascade,
  category    text not null,
  day         date not null,
  count       integer not null default 0,
  primary key (user_id, category, day)
);

alter table public.notification_throttle enable row level security;

create policy "users read own throttle"
  on public.notification_throttle for select
  using (auth.uid() = user_id);

create policy "admins read all throttle"
  on public.notification_throttle for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ------------------------------------------------------------
-- 6. Loosen notifications.type check — template keys (e.g.
--    'event.rsvp_confirmed', 'membership.approved') flow through
-- ------------------------------------------------------------
do $$ begin
  alter table public.notifications drop constraint if exists notifications_type_check;
exception when others then null; end $$;
-- No new constraint: template keys are free-form, validated by templates table.

-- Optional: ensure the legacy `message` column is renamed-friendly.
-- The dispatcher writes to `message` (existing column).
