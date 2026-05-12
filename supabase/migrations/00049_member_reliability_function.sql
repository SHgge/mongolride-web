-- ============================================================
-- EP-09 P0-3: member_reliability — trailing 90-day attended/no_show ratio.
-- Surfaced to admins only at the calling layer (UI gates display).
-- ============================================================

create or replace function public.member_reliability(p_user_id uuid)
returns table (
  attended_count       integer,
  no_show_count        integer,
  reliability_label    text,
  last_event_at        timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_attended integer;
  v_no_show  integer;
  v_total    integer;
  v_ratio    numeric;
  v_last     timestamptz;
begin
  select count(*) filter (where r.status = 'attended'),
         count(*) filter (where r.status = 'no_show'),
         max(r.updated_at)
    into v_attended, v_no_show, v_last
    from public.event_rsvps r
    join public.events e on e.id = r.event_id
   where r.user_id = p_user_id
     and r.created_at >= now() - interval '90 days'
     and r.status in ('attended','no_show');

  v_total := coalesce(v_attended, 0) + coalesce(v_no_show, 0);

  attended_count := coalesce(v_attended, 0);
  no_show_count  := coalesce(v_no_show, 0);
  last_event_at  := v_last;

  if v_total < 3 then
    reliability_label := 'unknown';
  else
    v_ratio := v_attended::numeric / nullif(v_total, 0);
    reliability_label := case
      when v_ratio >= 0.9 then 'reliable'
      when v_ratio >= 0.7 then 'mostly_reliable'
      else 'unreliable'
    end;
  end if;

  return next;
end;
$$;

grant execute on function public.member_reliability(uuid) to authenticated;
