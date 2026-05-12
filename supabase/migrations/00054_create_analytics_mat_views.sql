-- ============================================================
-- EP-07 P0-1: Analytics materialized views
--   mv_event_metrics       — per-event aggregates + computed rates
--   mv_member_weekly       — new/active members per week
--   mv_member_reliability  — 90-day rolling attended/no_show ratio
--   mv_cohort_retention    — signup-month × months-since cells
--   mv_event_weather_impact— weather snapshot joined to past events
-- ============================================================

-- ------------------------------------------------------------
-- 1. mv_event_metrics
-- ------------------------------------------------------------
create materialized view public.mv_event_metrics as
with rsvp_counts as (
  select
    e.id           as event_id,
    e.title,
    e.organizer_id,
    e.discipline,
    e.skill_level,
    e.visibility,
    e.meet_at,
    e.capacity,
    e.fee_amount,
    count(*) filter (where r.status in ('confirmed','attended','no_show','pending_payment')) as rsvps_total,
    count(*) filter (where r.status = 'confirmed')        as confirmed_count,
    count(*) filter (where r.status = 'attended')         as attended_count,
    count(*) filter (where r.status = 'no_show')          as no_show_count,
    count(*) filter (where r.status = 'cancelled')        as cancelled_count,
    count(*) filter (where r.status = 'waitlist')         as waitlist_count,
    count(*) filter (where r.status = 'pending_payment')  as pending_payment_count,
    coalesce(sum(r.guest_count) filter (where r.status in ('confirmed','attended')), 0) as guests_total,
    count(*) filter (where r.status = 'attended' and r.checked_in_late = true)  as late_arrival_count,
    count(*) filter (where r.status = 'attended' and r.checked_in_late = false) as on_time_count
  from public.events e
  left join public.event_rsvps r on r.event_id = e.id
  group by e.id
)
select
  rc.*,
  case when rsvps_total > 0
       then attended_count::numeric / rsvps_total
       else null end as attendance_rate,
  case when (attended_count + no_show_count) > 0
       then attended_count::numeric / (attended_count + no_show_count)
       else null end as show_up_rate,
  case when attended_count > 0
       then on_time_count::numeric / attended_count
       else null end as on_time_rate,
  case when capacity is not null and capacity > 0
       then (confirmed_count + attended_count)::numeric / capacity
       else null end as fill_rate
from rsvp_counts rc;

create unique index mv_event_metrics_event_idx     on public.mv_event_metrics(event_id);
create index        mv_event_metrics_meet_at_idx   on public.mv_event_metrics(meet_at desc);
create index        mv_event_metrics_organizer_idx on public.mv_event_metrics(organizer_id);
create index        mv_event_metrics_discipline_idx on public.mv_event_metrics(discipline);

-- ------------------------------------------------------------
-- 2. mv_member_weekly
-- ------------------------------------------------------------
create materialized view public.mv_member_weekly as
with bounds as (
  select
    coalesce(date_trunc('week', (select min(created_at) from public.profiles)),
             date_trunc('week', now()))            as min_week,
    date_trunc('week', now())                      as max_week
),
weeks as (
  select date_trunc('week', d) as week_start
  from bounds, generate_series(bounds.min_week, bounds.max_week, interval '1 week') d
),
new_members as (
  select date_trunc('week', created_at) as week_start, count(*)::int as new_count
  from public.profiles
  group by 1
),
active_members as (
  select date_trunc('week', r.created_at) as week_start,
         count(distinct r.user_id)::int as active_count
  from public.event_rsvps r
  where r.status in ('confirmed','attended','no_show')
  group by 1
)
select
  w.week_start,
  coalesce(nm.new_count, 0)    as new_members,
  coalesce(am.active_count, 0) as active_members
from weeks w
left join new_members  nm on nm.week_start = w.week_start
left join active_members am on am.week_start = w.week_start;

create unique index mv_member_weekly_week_idx on public.mv_member_weekly(week_start);

-- ------------------------------------------------------------
-- 3. mv_member_reliability  (90-day rolling)
-- ------------------------------------------------------------
create materialized view public.mv_member_reliability as
with stats as (
  select
    p.id   as user_id,
    p.full_name,
    p.role,
    count(*) filter (where r.status = 'attended'  and r.created_at >= now() - interval '90 days') as attended_90d,
    count(*) filter (where r.status = 'no_show'   and r.created_at >= now() - interval '90 days') as no_show_90d,
    count(*) filter (where r.status = 'cancelled' and r.created_at >= now() - interval '90 days') as cancelled_90d,
    max(r.updated_at) filter (where r.status in ('attended','no_show')) as last_event_at
  from public.profiles p
  left join public.event_rsvps r on r.user_id = p.id
  group by p.id, p.full_name, p.role
)
select
  s.*,
  case
    when (s.attended_90d + s.no_show_90d) < 3 then 'unknown'
    when s.attended_90d::numeric / nullif(s.attended_90d + s.no_show_90d, 0) >= 0.9 then 'reliable'
    when s.attended_90d::numeric / nullif(s.attended_90d + s.no_show_90d, 0) >= 0.7 then 'mostly_reliable'
    else 'unreliable'
  end as reliability_label
from stats s;

create unique index mv_member_reliability_user_idx        on public.mv_member_reliability(user_id);
create index        mv_member_reliability_last_event_idx  on public.mv_member_reliability(last_event_at desc nulls first);
create index        mv_member_reliability_label_idx       on public.mv_member_reliability(reliability_label);

-- ------------------------------------------------------------
-- 4. mv_cohort_retention
-- ------------------------------------------------------------
create materialized view public.mv_cohort_retention as
with cohorts as (
  select
    p.id                                  as user_id,
    date_trunc('month', p.created_at)::date as cohort_month
  from public.profiles p
),
cohort_sizes as (
  select cohort_month, count(*)::int as cohort_size
  from cohorts
  group by 1
),
activity as (
  select
    c.cohort_month,
    c.user_id,
    date_trunc('month', r.created_at)::date as activity_month
  from cohorts c
  join public.event_rsvps r on r.user_id = c.user_id
  where r.status in ('attended','confirmed','no_show')
)
select
  a.cohort_month,
  a.activity_month,
  ((extract(year from age(a.activity_month, a.cohort_month)) * 12)
    + extract(month from age(a.activity_month, a.cohort_month)))::int as months_since,
  count(distinct a.user_id)::int as active_users,
  cs.cohort_size
from activity a
join cohort_sizes cs on cs.cohort_month = a.cohort_month
group by a.cohort_month, a.activity_month, cs.cohort_size;

create unique index mv_cohort_retention_idx
  on public.mv_cohort_retention(cohort_month, activity_month);

-- ------------------------------------------------------------
-- 5. mv_event_weather_impact (past events only)
-- ------------------------------------------------------------
create materialized view public.mv_event_weather_impact as
select
  m.event_id,
  m.meet_at,
  m.discipline,
  m.attendance_rate,
  m.on_time_rate,
  m.fill_rate,
  ws.temp_c,
  ws.feels_like_c,
  ws.wind_speed_ms,
  ws.aqi_us,
  ws.precip_amount_mm,
  ws.uv_index
from public.mv_event_metrics m
join public.events e on e.id = m.event_id
left join lateral (
  select *
  from public.weather_snapshots ws
  where e.meet_lat is not null and e.meet_lng is not null
    and ws.lat_grid = round(e.meet_lat::numeric * 20) / 20
    and ws.lng_grid = round(e.meet_lng::numeric * 20) / 20
    and ws.hour_bucket = date_trunc('hour', e.meet_at)
  order by ws.fetched_at desc
  limit 1
) ws on true
where m.meet_at < now();

create unique index mv_event_weather_impact_idx on public.mv_event_weather_impact(event_id);
create index        mv_event_weather_impact_aqi on public.mv_event_weather_impact(aqi_us);

-- ------------------------------------------------------------
-- Permissions: only service_role + the SECURITY DEFINER read functions
-- access these directly. authenticated callers go through functions.
-- ------------------------------------------------------------
revoke all on public.mv_event_metrics        from public, anon, authenticated;
revoke all on public.mv_member_weekly        from public, anon, authenticated;
revoke all on public.mv_member_reliability   from public, anon, authenticated;
revoke all on public.mv_cohort_retention     from public, anon, authenticated;
revoke all on public.mv_event_weather_impact from public, anon, authenticated;
