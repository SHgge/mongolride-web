-- Existing notifications table-ийг extend хийх:
-- 1. Membership type-ууд CHECK constraint-д нэмэх
-- 2. Realtime publication-д нэмэх (Realtime бүртгэгдээгүй бол)

-- Old check constraint устгаж шинээр үүсгэх (membership types нэмсэн)
do $$
begin
  alter table public.notifications drop constraint if exists notifications_type_check;
exception when others then null;
end $$;

alter table public.notifications add constraint notifications_type_check
  check (type in (
    'event', 'sos', 'marketplace', 'route', 'system', 'achievement',
    'membership.approved', 'membership.rejected'
  ));

-- Realtime: enable for notifications (idempotent)
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

-- Storage policies for club-assets bucket (bucket нь Dashboard-аас үүсгэгдэх)
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('club-assets', 'club-assets', true);
exception when unique_violation then null;
end $$;

drop policy if exists "public read club assets" on storage.objects;
drop policy if exists "admins upload club assets" on storage.objects;
drop policy if exists "admins update club assets" on storage.objects;
drop policy if exists "admins delete club assets" on storage.objects;

create policy "public read club assets"
  on storage.objects for select
  using (bucket_id = 'club-assets');

create policy "admins upload club assets"
  on storage.objects for insert
  with check (
    bucket_id = 'club-assets'
    and exists (select 1 from public.profiles
                where id = auth.uid() and role = 'admin')
  );

create policy "admins update club assets"
  on storage.objects for update
  using (
    bucket_id = 'club-assets'
    and exists (select 1 from public.profiles
                where id = auth.uid() and role = 'admin')
  );

create policy "admins delete club assets"
  on storage.objects for delete
  using (
    bucket_id = 'club-assets'
    and exists (select 1 from public.profiles
                where id = auth.uid() and role = 'admin')
  );
