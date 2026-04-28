-- ============================================================
-- EP-04 P1-5 fix: event_rsvps дээр anon read policy байхгүй учраас
-- EventDetailPage дээрх "{N} оролцогч" counter нь логин-гүй болон
-- өөр гишүүдэд 0 харагдаж байна. PII задлахгүйгээр зөвхөн нэгтгэсэн
-- тоо буцаах security-definer RPC үүсгэнэ.
-- ============================================================

create or replace function public.event_rsvp_counts(p_event_id uuid)
returns table (
  confirmed_count integer,
  waitlist_count  integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event_visible boolean;
begin
  -- Нийтэлсэн / дууссан / цуцлагдсан event-ийн тоог хэн бүхэнд харуулна.
  -- Draft event-ийн тоо нь зөвхөн админ / organizer-т хамаатай —
  -- энэ RPC-ээс null буцаана.
  select exists (
    select 1 from public.events e
    where e.id = p_event_id
      and e.status in ('published', 'completed', 'cancelled')
  ) into v_event_visible;

  if not v_event_visible then
    return;
  end if;

  return query
  select
    (select count(*)::int from public.event_rsvps r
       where r.event_id = p_event_id and r.status = 'confirmed'),
    (select count(*)::int from public.event_rsvps r
       where r.event_id = p_event_id and r.status = 'waitlist');
end;
$$;

grant execute on function public.event_rsvp_counts(uuid)
  to anon, authenticated, service_role;
