-- ============================================================
-- Membership approval workflow устгах
-- "Guest" role нь бүртгэлгүй хэрэглэгчид (anon) хамаарна — DB-д бичигдэхгүй.
-- Бүх бүртгэлтэй хэрэглэгч шууд member болно.
-- ============================================================

-- 1. Холбогдох trigger, function, table-уудыг устгах
drop trigger if exists membership_requests_cooldown on public.membership_requests;
drop function if exists public.enforce_request_cooldown();
drop function if exists public.approve_membership_request(uuid);
drop function if exists public.reject_membership_request(uuid, text);
drop table if exists public.membership_requests cascade;

-- 2. Одоо байгаа 'guest' role-той хэрэглэгчдийг 'member' болгох
update public.profiles set role = 'member' where role = 'guest';

-- 3. handle_new_user trigger member үүсгэдэг болгох (аль хэдийн default member ч баталгаажуулна)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'member'
  );
  return new;
end;
$$ language plpgsql security definer;

-- 4. (membership_requests cascade-аар хамт устгасан тул policy ч устсан)

-- 5. notifications type CHECK constraint-аас membership types арилгах
do $$
begin
  alter table public.notifications drop constraint if exists notifications_type_check;
exception when others then null;
end $$;

alter table public.notifications add constraint notifications_type_check
  check (type in ('event', 'sos', 'marketplace', 'route', 'system', 'achievement'));

-- Note: Хуучин 'membership.approved'/'membership.rejected' notifications үлдсэн бол энэ
-- constraint check-д унана. Хэрэв байвал тэдгээрийг 'system' болгож хувиргах:
update public.notifications
set type = 'system'
where type in ('membership.approved', 'membership.rejected');
