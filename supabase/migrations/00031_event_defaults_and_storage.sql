-- ============================================================
-- EP-03: Discipline-aware defaults trigger + event-assets storage bucket
-- ============================================================

-- Discipline-aware defaults trigger
create or replace function public.apply_event_discipline_defaults()
returns trigger
language plpgsql
as $$
declare
  v_hour_meet integer;
begin
  -- Auto-add 'lights' for commute or dawn/dusk rides
  v_hour_meet := extract(hour from new.roll_out_at at time zone 'Asia/Ulaanbaatar');
  if (new.discipline = 'commute' or v_hour_meet < 7 or v_hour_meet >= 19)
     and not ('lights' = any(new.required_gear)) then
    new.required_gear := array_append(new.required_gear, 'lights');
  end if;

  -- Always require helmet
  if not ('helmet' = any(new.required_gear)) then
    new.required_gear := array_append(new.required_gear, 'helmet');
  end if;

  -- MTB defaults to dirt-heavy if surface left blank
  if new.discipline = 'mtb' and new.surface_asphalt_pct is null
     and new.surface_gravel_pct is null and new.surface_dirt_pct is null then
    new.surface_dirt_pct := 60;
    new.surface_gravel_pct := 30;
    new.surface_asphalt_pct := 10;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists events_apply_defaults on public.events;
create trigger events_apply_defaults
  before insert or update on public.events
  for each row
  execute function public.apply_event_discipline_defaults();

-- Storage bucket: event-assets
do $$ begin
  insert into storage.buckets (id, name, public)
  values ('event-assets', 'event-assets', true);
exception when unique_violation then null; end $$;

drop policy if exists "public read event assets" on storage.objects;
drop policy if exists "admins write event assets" on storage.objects;
drop policy if exists "admins update event assets" on storage.objects;
drop policy if exists "admins delete event assets" on storage.objects;

create policy "public read event assets"
  on storage.objects for select
  using (bucket_id = 'event-assets');

create policy "admins write event assets"
  on storage.objects for insert
  with check (
    bucket_id = 'event-assets'
    and exists (select 1 from public.profiles
                where id = auth.uid() and role = 'admin')
  );

create policy "admins update event assets"
  on storage.objects for update
  using (
    bucket_id = 'event-assets'
    and exists (select 1 from public.profiles
                where id = auth.uid() and role = 'admin')
  );

create policy "admins delete event assets"
  on storage.objects for delete
  using (
    bucket_id = 'event-assets'
    and exists (select 1 from public.profiles
                where id = auth.uid() and role = 'admin')
  );
