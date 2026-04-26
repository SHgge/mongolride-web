create or replace function public.enforce_request_cooldown()
returns trigger
language plpgsql
as $$
declare
  cooldown_days integer;
  last_rejection timestamptz;
  next_eligible  timestamptz;
begin
  select rejection_cooldown_days into cooldown_days
  from public.club_settings where id = 1;

  select decided_at into last_rejection
  from public.membership_requests
  where user_id = new.user_id
    and status = 'rejected'
    and decided_at > now() - (cooldown_days || ' days')::interval
  order by decided_at desc
  limit 1;

  if last_rejection is not null then
    next_eligible := last_rejection + (cooldown_days || ' days')::interval;
    raise exception 'Та % хүртэл дахин хүсэлт явуулах боломжгүй',
      to_char(next_eligible, 'YYYY-MM-DD')
      using errcode = 'P0003';
  end if;

  return new;
end;
$$;

drop trigger if exists membership_requests_cooldown on public.membership_requests;

create trigger membership_requests_cooldown
  before insert on public.membership_requests
  for each row
  execute function public.enforce_request_cooldown();
