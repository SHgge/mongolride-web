-- ======================================================
-- Singleton club_settings row
-- ======================================================
create table public.club_settings (
  id                       smallint primary key default 1,
  name                     text not null,
  description              text default '',
  logo_path                text,
  contact_email            text,
  contact_phone            text,
  facebook_url             text,
  instagram_url            text,
  website_url              text,
  rejection_cooldown_days  integer not null default 30,
  updated_at               timestamptz not null default now(),
  constraint club_settings_singleton check (id = 1)
);

insert into public.club_settings (id, name, description, contact_email, contact_phone)
values (1, 'MongolRide', 'Монголын дугуйчдын хамгийн том нийгэмлэг', 'info@mongolride.mn', '+976 9911-2233')
on conflict (id) do nothing;

alter table public.club_settings enable row level security;

create policy "anyone reads club settings"
  on public.club_settings for select
  using (true);

create policy "admins update club settings"
  on public.club_settings for update
  using (
    exists (select 1 from public.profiles
            where id = auth.uid() and role = 'admin')
  );

-- ======================================================
-- Membership requests
-- ======================================================
create table public.membership_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  status      text not null default 'pending'
              check (status in ('pending', 'approved', 'rejected')),
  motivation  text check (motivation is null or length(motivation) <= 500),
  reason      text check (reason is null or length(reason) <= 500),
  decided_at  timestamptz,
  decided_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- DB-enforced "one pending request per user"
create unique index membership_requests_one_pending_per_user
  on public.membership_requests(user_id)
  where status = 'pending';

create index membership_requests_status_idx  on public.membership_requests(status);
create index membership_requests_user_idx    on public.membership_requests(user_id);
create index membership_requests_created_idx on public.membership_requests(created_at desc);

alter table public.membership_requests enable row level security;

create policy "guest inserts own request"
  on public.membership_requests for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.profiles
                where id = auth.uid() and role = 'guest')
  );

create policy "users read own requests"
  on public.membership_requests for select
  using (auth.uid() = user_id);

create policy "admins read all requests"
  on public.membership_requests for select
  using (
    exists (select 1 from public.profiles
            where id = auth.uid() and role = 'admin')
  );
-- Updates only via security-definer functions in 00026
