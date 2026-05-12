-- ============================================================
-- EP-06 P0-2: dispatch_notification(...)
--
-- Single entry point for every notification. Inserts one row per
-- channel into notification_outbox. The outbox processor renders
-- templates + sends via Resend or in-app insert.
--
-- Gates applied (in order):
--   1. Template exists (looked up by key, locale, channel)
--   2. Email healthy (skip channel='email' if bounced/complained)
--   3. Pause-all (paused_until > now) — non-severe non-transactional suppressed
--   4. Quiet hours — non-severe non-transactional rescheduled
--   5. Daily throttle per category
--   6. User matrix (transactional + force_channels override)
--
-- Returns: queued count, suppressed count, reasons array (for debug).
-- ============================================================

create or replace function public.dispatch_notification(
  p_template_key       text,
  p_recipient_user_id  uuid,
  p_variables          jsonb default '{}'::jsonb,
  p_severity           text default 'normal',
  p_bypass_dnd         boolean default false,
  p_idempotency_key    text default null,
  p_source_epic        text default null,
  p_source_event       text default null,
  p_source_target_id   uuid default null,
  p_force_channels     text[] default null
) returns table (queued integer, suppressed integer, reasons jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefs               record;
  v_email               text;
  v_email_health        text;
  v_template_exists_email   boolean;
  v_template_exists_in_app  boolean;
  v_locale              text;
  v_now                 timestamptz := now();
  v_today               date;
  v_idem                text;
  v_max_per_day         integer;
  v_count_today         integer;
  v_category            text;
  v_throttle_limits     jsonb := jsonb_build_object(
    'transactional',   1000,
    'event_lifecycle', 10,
    'weather',         5,
    'social',          20,
    'marketing',       2,
    'system',          10
  );
  v_in_quiet_hours      boolean := false;
  v_local_time          time;
  v_scheduled           timestamptz;
  v_qh_end_today        timestamptz;
  v_reasons             jsonb := '[]'::jsonb;
  v_queued              integer := 0;
  v_suppressed          integer := 0;
  v_force_email         boolean;
  v_force_in_app        boolean;
  v_email_allowed       boolean;
  v_in_app_allowed      boolean;
begin
  -- 0. Load prefs + email
  select np.*, au.email
    into v_prefs
    from public.notification_preferences np
    join auth.users au on au.id = np.user_id
   where np.user_id = p_recipient_user_id;

  if not found then
    return query select 0, 0, jsonb_build_array(jsonb_build_object('error','no_prefs_row'));
    return;
  end if;

  v_email  := v_prefs.email;
  v_locale := v_prefs.preferred_locale;
  v_today  := (v_now at time zone v_prefs.timezone)::date;

  -- 1. Lookup template category from any version
  select category into v_category
  from public.notification_templates
  where key = p_template_key
  limit 1;

  if v_category is null then
    return query select 0, 0,
      jsonb_build_array(jsonb_build_object('error','template_not_found','key',p_template_key));
    return;
  end if;

  v_max_per_day := coalesce((v_throttle_limits->>v_category)::int, 10);

  -- 2. Pause-all (skip non-severe, non-transactional)
  if v_prefs.paused_until is not null
     and v_prefs.paused_until > v_now
     and p_severity <> 'severe'
     and v_category <> 'transactional' then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('reason','paused'));
    return query select 0, 1, v_reasons;
    return;
  end if;

  -- 3. Quiet hours (defer non-severe, non-transactional to next active window)
  if v_prefs.quiet_hours_start is not null and v_prefs.quiet_hours_end is not null then
    v_local_time := (v_now at time zone v_prefs.timezone)::time;
    if v_prefs.quiet_hours_start <= v_prefs.quiet_hours_end then
      v_in_quiet_hours := v_local_time between v_prefs.quiet_hours_start and v_prefs.quiet_hours_end;
    else
      -- e.g. 22:00 - 07:00 wraps midnight
      v_in_quiet_hours := v_local_time >= v_prefs.quiet_hours_start
                       or v_local_time <= v_prefs.quiet_hours_end;
    end if;
  end if;

  v_scheduled := v_now;
  if v_in_quiet_hours
     and not p_bypass_dnd
     and v_category <> 'transactional'
     and not (p_severity = 'severe' and v_prefs.allow_severe_during_dnd)
  then
    -- Quiet hours end (in user TZ) → UTC. If end ≤ start, end is "tomorrow morning".
    v_qh_end_today := ((v_today + v_prefs.quiet_hours_end) at time zone v_prefs.timezone);
    if v_qh_end_today <= v_now then
      v_qh_end_today := v_qh_end_today + interval '1 day';
    end if;
    v_scheduled := v_qh_end_today;
  end if;

  -- 4. Daily throttle (transactional bypasses)
  select coalesce(count, 0)
    into v_count_today
    from public.notification_throttle
    where user_id = p_recipient_user_id and category = v_category and day = v_today;

  if v_count_today >= v_max_per_day and v_category <> 'transactional' then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'reason','throttled','count',v_count_today,'cap',v_max_per_day));
    return query select 0, 1, v_reasons;
    return;
  end if;

  -- 5. Email health
  select status into v_email_health
    from public.notification_email_health where email = v_email;
  v_email_health := coalesce(v_email_health, 'healthy');

  -- 6. Template existence per channel
  select exists (
    select 1 from public.notification_templates
    where key = p_template_key and channel = 'email' and is_active = true
      and locale in (v_locale, 'mn')
  ) into v_template_exists_email;

  select exists (
    select 1 from public.notification_templates
    where key = p_template_key and channel = 'in_app' and is_active = true
      and locale in (v_locale, 'mn')
  ) into v_template_exists_in_app;

  -- 7. Channel matrix (with force_channels override + transactional bypass)
  v_force_email  := p_force_channels is not null and 'email'  = any(p_force_channels);
  v_force_in_app := p_force_channels is not null and 'in_app' = any(p_force_channels);

  v_email_allowed := v_template_exists_email
    and v_email_health = 'healthy'
    and v_email is not null
    and (
      v_force_email
      or v_category = 'transactional'
      or coalesce((v_prefs.matrix #>> array[v_category, 'email'])::boolean, false)
    );

  v_in_app_allowed := v_template_exists_in_app
    and (
      v_force_in_app
      or v_category = 'transactional'
      or coalesce((v_prefs.matrix #>> array[v_category, 'in_app'])::boolean, false)
    );

  -- 8. Insert outbox rows (idempotency-aware)
  if v_email_allowed then
    v_idem := coalesce(p_idempotency_key,
      p_template_key || ':' || p_recipient_user_id::text || ':email')
      || ':' || v_now::text;
    -- Use override key as-is when explicitly provided (so callers can dedupe across runs)
    if p_idempotency_key is not null then
      v_idem := p_idempotency_key || ':email';
    end if;

    insert into public.notification_outbox(
      idempotency_key, template_key, category, channel,
      recipient_user_id, recipient_email, recipient_locale,
      variables, severity, bypass_dnd,
      status, scheduled_for,
      source_epic, source_event, source_target_id
    ) values (
      v_idem, p_template_key, v_category, 'email',
      p_recipient_user_id, v_email, v_locale,
      p_variables, p_severity, p_bypass_dnd,
      case when v_scheduled > v_now then 'scheduled' else 'queued' end, v_scheduled,
      p_source_epic, p_source_event, p_source_target_id
    ) on conflict (idempotency_key) do nothing;

    if found then v_queued := v_queued + 1; end if;
  elsif v_template_exists_email and v_email_health <> 'healthy' then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'reason','email_unhealthy','status',v_email_health));
  end if;

  if v_in_app_allowed then
    v_idem := coalesce(p_idempotency_key,
      p_template_key || ':' || p_recipient_user_id::text || ':in_app')
      || ':' || v_now::text;
    if p_idempotency_key is not null then
      v_idem := p_idempotency_key || ':in_app';
    end if;

    insert into public.notification_outbox(
      idempotency_key, template_key, category, channel,
      recipient_user_id, recipient_locale,
      variables, severity, bypass_dnd,
      status, scheduled_for,
      source_epic, source_event, source_target_id
    ) values (
      v_idem, p_template_key, v_category, 'in_app',
      p_recipient_user_id, v_locale,
      p_variables, p_severity, p_bypass_dnd,
      case when v_scheduled > v_now then 'scheduled' else 'queued' end, v_scheduled,
      p_source_epic, p_source_event, p_source_target_id
    ) on conflict (idempotency_key) do nothing;

    if found then v_queued := v_queued + 1; end if;
  end if;

  -- 9. Bump throttle counter
  if v_queued > 0 then
    insert into public.notification_throttle(user_id, category, day, count)
    values (p_recipient_user_id, v_category, v_today, 1)
    on conflict (user_id, category, day) do update set count = notification_throttle.count + 1;
  end if;

  return query select v_queued, v_suppressed, v_reasons;
end;
$$;

grant execute on function public.dispatch_notification(
  text, uuid, jsonb, text, boolean, text, text, text, uuid, text[]
) to authenticated, service_role;
