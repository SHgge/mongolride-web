-- ============================================================
-- EP-07 P0-2 + P0-3 + P0-4
--   refresh_analytics_views   — refresh all 5 mat views
--   is_admin                  — small helper used by every read fn
--   kpi_summary               — KPI cards + delta vs prior window
--   event_analytics_list      — admin OR organizer scope
--   member_growth_series      — admin only
--   cohort_retention_grid     — admin only
--   weather_impact_scatter    — admin only
--   at_risk_members           — admin only
--   log_analytics_drilldown   — write audit_log entry
-- ============================================================

-- ------------------------------------------------------------
-- Refresh function
-- ------------------------------------------------------------
create or replace function public.refresh_analytics_views()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.mv_event_metrics;
  refresh materialized view concurrently public.mv_member_weekly;
  refresh materialized view concurrently public.mv_member_reliability;
  refresh materialized view concurrently public.mv_cohort_retention;
  refresh materialized view concurrently public.mv_event_weather_impact;
exception
  -- "concurrently" requires populated views; on first run fall back to plain refresh.
  when feature_not_supported then
    refresh materialized view public.mv_event_metrics;
    refresh materialized view public.mv_member_weekly;
    refresh materialized view public.mv_member_reliability;
    refresh materialized view public.mv_cohort_retention;
    refresh materialized view public.mv_event_weather_impact;
end;
$$;

grant execute on function public.refresh_analytics_views() to service_role;

-- ------------------------------------------------------------
-- is_admin helper
-- ------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- ------------------------------------------------------------
-- kpi_summary
-- ------------------------------------------------------------
create or replace function public.kpi_summary(
  p_from timestamptz default now() - interval '30 days',
  p_to   timestamptz default now()
) returns table (
  total_events             integer,
  total_rsvps              integer,
  fill_rate_avg            numeric,
  attendance_rate_avg      numeric,
  on_time_rate_avg         numeric,
  active_members           integer,
  prev_total_events        integer,
  prev_total_rsvps         integer,
  prev_fill_rate_avg       numeric,
  prev_attendance_rate_avg numeric,
  prev_on_time_rate_avg    numeric,
  prev_active_members      integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_window     interval;
  v_prev_from  timestamptz;
  v_prev_to    timestamptz;
begin
  if not is_admin() then
    raise exception 'Forbidden' using errcode = 'P0001';
  end if;

  v_window    := p_to - p_from;
  v_prev_from := p_from - v_window;
  v_prev_to   := p_from;

  return query
  with cur as (
    select
      count(*)::int                  as total_events,
      coalesce(sum(rsvps_total), 0)::int as total_rsvps,
      avg(fill_rate)                 as fill_rate_avg,
      avg(attendance_rate)           as attendance_rate_avg,
      avg(on_time_rate)              as on_time_rate_avg
    from public.mv_event_metrics
    where meet_at between p_from and p_to
  ),
  prev as (
    select
      count(*)::int                  as total_events,
      coalesce(sum(rsvps_total), 0)::int as total_rsvps,
      avg(fill_rate)                 as fill_rate_avg,
      avg(attendance_rate)           as attendance_rate_avg,
      avg(on_time_rate)              as on_time_rate_avg
    from public.mv_event_metrics
    where meet_at between v_prev_from and v_prev_to
  ),
  active as (
    select count(distinct user_id)::int as cur_active
    from public.event_rsvps
    where created_at between p_from and p_to
      and status in ('confirmed','attended','no_show')
  ),
  active_prev as (
    select count(distinct user_id)::int as prev_active
    from public.event_rsvps
    where created_at between v_prev_from and v_prev_to
      and status in ('confirmed','attended','no_show')
  )
  select cur.total_events, cur.total_rsvps, cur.fill_rate_avg,
         cur.attendance_rate_avg, cur.on_time_rate_avg, active.cur_active,
         prev.total_events, prev.total_rsvps, prev.fill_rate_avg,
         prev.attendance_rate_avg, prev.on_time_rate_avg, active_prev.prev_active
  from cur, prev, active, active_prev;
end;
$$;

grant execute on function public.kpi_summary(timestamptz, timestamptz) to authenticated;

-- ------------------------------------------------------------
-- event_analytics_list  (admin OR organizer/co-organizer)
-- ------------------------------------------------------------
create or replace function public.event_analytics_list(
  p_from        timestamptz default now() - interval '30 days',
  p_to          timestamptz default now(),
  p_discipline  text default null,
  p_organizer   uuid default null,
  p_limit       integer default 100,
  p_offset      integer default 0
) returns table (
  event_id           uuid,
  title              text,
  meet_at            timestamptz,
  discipline         text,
  capacity           integer,
  rsvps_total        integer,
  attended_count     integer,
  no_show_count      integer,
  late_arrival_count integer,
  fill_rate          numeric,
  attendance_rate    numeric,
  on_time_rate       numeric,
  weather_aqi        integer,
  weather_temp_c     numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select
    m.event_id,
    e.title,
    m.meet_at,
    m.discipline,
    m.capacity,
    m.rsvps_total,
    m.attended_count,
    m.no_show_count,
    m.late_arrival_count,
    m.fill_rate,
    m.attendance_rate,
    m.on_time_rate,
    w.aqi_us,
    w.temp_c
  from public.mv_event_metrics m
  join public.events e on e.id = m.event_id
  left join public.mv_event_weather_impact w on w.event_id = m.event_id
  where m.meet_at between p_from and p_to
    and (p_discipline is null or m.discipline = p_discipline)
    and (p_organizer  is null or m.organizer_id = p_organizer)
    and (
      is_admin()
      or m.organizer_id = auth.uid()
      or auth.uid() = any(e.co_organizer_ids)
    )
  order by m.meet_at desc
  limit greatest(1, least(p_limit, 1000))
  offset greatest(0, p_offset);
end;
$$;

grant execute on function public.event_analytics_list(timestamptz, timestamptz, text, uuid, integer, integer)
  to authenticated;

-- ------------------------------------------------------------
-- member_growth_series (admin only)
-- ------------------------------------------------------------
create or replace function public.member_growth_series(
  p_from timestamptz default now() - interval '90 days',
  p_to   timestamptz default now()
) returns table (week_start timestamptz, new_members integer, active_members integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Forbidden' using errcode = 'P0001';
  end if;
  return query
  select w.week_start, w.new_members, w.active_members
  from public.mv_member_weekly w
  where w.week_start between p_from and p_to
  order by w.week_start;
end;
$$;

grant execute on function public.member_growth_series(timestamptz, timestamptz) to authenticated;

-- ------------------------------------------------------------
-- cohort_retention_grid (admin only)
-- ------------------------------------------------------------
create or replace function public.cohort_retention_grid(
  p_from timestamptz default now() - interval '12 months'
) returns table (cohort_month date, months_since integer, retention_pct numeric, cohort_size integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Forbidden' using errcode = 'P0001';
  end if;
  return query
  select
    c.cohort_month,
    c.months_since,
    round(c.active_users::numeric / nullif(c.cohort_size, 0) * 100, 1) as retention_pct,
    c.cohort_size
  from public.mv_cohort_retention c
  where c.cohort_month >= p_from::date
  order by c.cohort_month, c.months_since;
end;
$$;

grant execute on function public.cohort_retention_grid(timestamptz) to authenticated;

-- ------------------------------------------------------------
-- weather_impact_scatter (admin only)
-- ------------------------------------------------------------
create or replace function public.weather_impact_scatter(
  p_metric text default 'aqi'
) returns table (event_id uuid, x numeric, y numeric, label text, meet_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Forbidden' using errcode = 'P0001';
  end if;
  if p_metric not in ('aqi','temp','wind') then
    raise exception 'Invalid metric: %', p_metric using errcode = 'P0001';
  end if;

  return query
  select
    w.event_id,
    case p_metric
      when 'aqi'  then w.aqi_us::numeric
      when 'temp' then w.temp_c
      when 'wind' then w.wind_speed_ms
    end as x,
    w.attendance_rate as y,
    e.title as label,
    w.meet_at
  from public.mv_event_weather_impact w
  join public.events e on e.id = w.event_id
  where (case p_metric
           when 'aqi'  then w.aqi_us
           when 'temp' then w.temp_c
           when 'wind' then w.wind_speed_ms
         end) is not null
    and w.attendance_rate is not null
  order by w.meet_at desc
  limit 500;
end;
$$;

grant execute on function public.weather_impact_scatter(text) to authenticated;

-- ------------------------------------------------------------
-- at_risk_members (admin only) — members to follow up with
-- ------------------------------------------------------------
create or replace function public.at_risk_members(p_limit int default 50)
returns table (
  user_id           uuid,
  full_name         text,
  role              text,
  attended_90d      bigint,
  no_show_90d       bigint,
  cancelled_90d     bigint,
  last_event_at     timestamptz,
  reliability_label text,
  reason            text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Forbidden' using errcode = 'P0001';
  end if;
  return query
  select
    m.user_id, m.full_name, m.role,
    m.attended_90d, m.no_show_90d, m.cancelled_90d,
    m.last_event_at, m.reliability_label,
    case
      when m.reliability_label = 'unreliable' then 'unreliable'
      when m.last_event_at is null then 'never_attended'
      when m.last_event_at < now() - interval '60 days' then 'inactive_60d'
      else 'other'
    end as reason
  from public.mv_member_reliability m
  where m.reliability_label = 'unreliable'
     or m.last_event_at is null
     or m.last_event_at < now() - interval '60 days'
  order by m.last_event_at nulls first, m.no_show_90d desc
  limit greatest(1, least(p_limit, 500));
end;
$$;

grant execute on function public.at_risk_members(int) to authenticated;

-- ------------------------------------------------------------
-- day_of_week_heatmap (admin only) — attendance avg per (dow, hour)
-- ------------------------------------------------------------
create or replace function public.day_of_week_heatmap(
  p_from timestamptz default now() - interval '180 days'
) returns table (dow integer, hour integer, attendance_rate_avg numeric, event_count integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Forbidden' using errcode = 'P0001';
  end if;
  return query
  select
    extract(dow from (m.meet_at at time zone 'Asia/Ulaanbaatar'))::int as dow,
    extract(hour from (m.meet_at at time zone 'Asia/Ulaanbaatar'))::int as hour,
    avg(m.attendance_rate) as attendance_rate_avg,
    count(*)::int as event_count
  from public.mv_event_metrics m
  where m.meet_at between p_from and now()
    and m.attendance_rate is not null
  group by dow, hour
  order by dow, hour;
end;
$$;

grant execute on function public.day_of_week_heatmap(timestamptz) to authenticated;

-- ------------------------------------------------------------
-- notification_health (admin only) — sent / bounced / dead from outbox
-- ------------------------------------------------------------
create or replace function public.notification_health()
returns table (
  sent_today      integer,
  sent_yesterday  integer,
  failed_today    integer,
  dead_open       integer,
  bounced_emails  integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Ulaanbaatar')::date;
begin
  if not is_admin() then
    raise exception 'Forbidden' using errcode = 'P0001';
  end if;
  return query
  with t as (
    select status, sent_at, created_at
    from public.notification_outbox
    where created_at >= now() - interval '3 days'
  )
  select
    (select count(*)::int from t where status = 'sent'
       and (sent_at at time zone 'Asia/Ulaanbaatar')::date = v_today),
    (select count(*)::int from t where status = 'sent'
       and (sent_at at time zone 'Asia/Ulaanbaatar')::date = v_today - 1),
    (select count(*)::int from t where status = 'failed'
       and (created_at at time zone 'Asia/Ulaanbaatar')::date = v_today),
    (select count(*)::int from public.notification_outbox where status = 'dead'),
    (select count(*)::int from public.notification_email_health where status in ('bounced','complained'));
end;
$$;

grant execute on function public.notification_health() to authenticated;

-- ------------------------------------------------------------
-- log_analytics_drilldown (PII drill-down audit)
-- ------------------------------------------------------------
create or replace function public.log_analytics_drilldown(
  p_view_key  text,
  p_target_id uuid default null,
  p_filters   jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Forbidden' using errcode = 'P0001';
  end if;
  insert into public.audit_log(actor_id, action, target_id, details)
  values (auth.uid(), 'analytics.drilldown_viewed', p_target_id,
          jsonb_build_object('view', p_view_key, 'filters', p_filters));
end;
$$;

grant execute on function public.log_analytics_drilldown(text, uuid, jsonb) to authenticated;
